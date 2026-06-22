import { createHash } from 'node:crypto'
import { attachRelations } from '../utils/relations.js'
import { UUID_RE, SORTABLE, VALID_PLATFORMS, VALID_STATUSES } from '../utils/constants.js'

export default async function productRoutes(fastify, options) {
  const { sql, redis } = fastify

  // List products with filtering and pagination
  fastify.get('/', async (request, reply) => {
    const {
      platform,
      categoryId,
      status = 'ACTIVE',
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      order = 'desc'
    } = request.query

    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100)
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const skip = (safePage - 1) * safeLimit
    const sortColumn = SORTABLE[sortBy] || 'created_at'
    const sortOrder = order === 'asc' ? sql`asc` : sql`desc`
    const safeStatus = status || 'ACTIVE'

    if (categoryId && !UUID_RE.test(categoryId)) {
      reply.code(400)
      return { error: 'Invalid categoryId' }
    }

    if (!VALID_STATUSES.includes(safeStatus)) {
      reply.code(400)
      return { error: 'Invalid status' }
    }

    if (platform && !VALID_PLATFORMS.includes(platform)) {
      reply.code(400)
      return { error: 'Invalid platform' }
    }

    const conditions = [sql`status = ${safeStatus}`]
    if (platform) conditions.push(sql`platform = ${platform}`)
    if (categoryId) conditions.push(sql`category_id = ${categoryId}`)
    if (minPrice) conditions.push(sql`price >= ${parseFloat(minPrice)}`)
    if (maxPrice) conditions.push(sql`price <= ${parseFloat(maxPrice)}`)

    // conditions always has at least the status element, so reduce is safe without an empty-array guard
    const whereClause = conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} and ${c}`)

    const cacheKey = `products:list:${JSON.stringify({ platform, categoryId, status, page, limit, minPrice, maxPrice, sortBy, order })}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const [products, [{ count: total }]] = await Promise.all([
      sql`
        select * from products
        where ${whereClause}
        order by ${sql(sortColumn)} ${sortOrder}
        limit ${safeLimit}
        offset ${skip}
      `,
      sql`select count(*)::int as count from products where ${whereClause}`
    ])

    const result = {
      products: await attachRelations(sql, products, { latestLinkOnly: true }),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    }

    await redis.setex(cacheKey, 300, JSON.stringify(result))

    return result
  })

  // Get single product by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params

    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Product not found' }
    }

    const cached = await redis.get(`product:${id}`)
    if (cached) {
      return JSON.parse(cached)
    }

    const [product] = await sql`select * from products where id = ${id}`

    if (!product) {
      reply.code(404)
      return { error: 'Product not found' }
    }

    const [[category], links, reviews, variants] = await Promise.all([
      product.categoryId
        ? sql`select * from categories where id = ${product.categoryId}`
        : Promise.resolve([null]),
      sql`select * from affiliate_links where product_id = ${id}`,
      sql`select * from reviews where product_id = ${id} order by created_at desc`,
      sql`
        select * from product_variants
        where product_id = ${id}
        order by variant_type, sort_order, value
      `
    ])

    const result = {
      ...product,
      category: category || null,
      affiliateLinks: links,
      reviews,
      variants
    }

    await redis.setex(`product:${id}`, 3600, JSON.stringify(result))

    return result
  })

  // Track an affiliate link click
  // POST /products/:id/click  body: { affiliateLinkId }
  fastify.post('/:id/click', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
      },
      body: {
        type: 'object',
        required: ['affiliateLinkId'],
        properties: {
          affiliateLinkId: { type: 'string', format: 'uuid' },
          referrer: { type: 'string', maxLength: 2048 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const { affiliateLinkId } = request.body

    // Rate limit: 10 clicks per (affiliate_link_id, IP) per minute via Redis.
    // MULTI/EXEC makes the INCR+EXPIRE atomic — EXPIRE uses NX so it only sets
    // the TTL on the first increment, preventing key leaks on process crash.
    const clientIp = request.headers['cf-connecting-ip']
      || request.headers['x-forwarded-for']?.split(',')[0].trim()
      || request.socket.remoteAddress
      || 'unknown'
    // Hash the IP so IPv6 colons don't collide with the key delimiter.
    const ipKey = createHash('sha256').update(clientIp).digest('hex').slice(0, 16)
    const rateLimitKey = `click:rl:${affiliateLinkId}:${ipKey}`
    const [[, count]] = await redis.multi()
      .incr(rateLimitKey)
      .expire(rateLimitKey, 60, 'NX')
      .exec()
    if (count > 10) {
      reply.code(429)
      return { error: 'Too many requests' }
    }

    // Verify the affiliate link belongs to this product so callers can't log
    // clicks against arbitrary link/product combinations.
    const [link] = await sql`
      select id from affiliate_links
      where id = ${affiliateLinkId} and product_id = ${id}
    `

    if (!link) {
      reply.code(404)
      return { error: 'Affiliate link not found for this product' }
    }

    // Collect lightweight attribution metadata — no PII stored.
    const userAgent = request.headers['user-agent'] || ''
    // Body referrer takes precedence (useful for SPAs where Referer header is stripped);
    // fall back to the browser-supplied Referer header.
    const referrer = request.body.referrer
      ?? request.headers['referer']
      ?? request.headers['referrer']
      ?? null
    const ipCountry = request.headers['cf-ipcountry'] || request.headers['x-country'] || null

    // Hash the UA for rough unique-visitor metrics without storing raw strings.
    const userAgentHash = userAgent
      ? createHash('sha256').update(userAgent).digest('hex')
      : null

    await sql`
      insert into clicks (affiliate_link_id, product_id, user_agent_hash, referrer, ip_country)
      values (${affiliateLinkId}, ${id}, ${userAgentHash}, ${referrer}, ${ipCountry})
    `

    reply.code(204)
  })

  // Write operations live in backend/src/routes/admin/products.js
}

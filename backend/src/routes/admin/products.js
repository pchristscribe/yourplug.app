import { adminAuth, csrfProtection } from '../../middleware/adminAuth.js'
import { attachRelations } from '../../utils/relations.js'
import { UUID_RE, ADMIN_SORTABLE, VALID_PLATFORMS, VALID_STATUSES } from '../../utils/constants.js'
import {
  createProductSchema,
  updateProductSchema,
  bulkStatusProductsSchema,
  bulkDeleteProductsSchema
} from '../../schemas/product.js'

// ioredis del does not accept globs — use cursor scan to avoid blocking O(N) KEYS
async function delPattern(redis, pattern) {
  let cursor = '0'
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    // ioredis.del accepts an array directly; spreading an unbounded list risks V8 arg limit
    if (keys.length) await redis.del(keys)
    cursor = next
  } while (cursor !== '0')
}

const PRODUCT_FIELDS = [
  'externalId', 'platform', 'title', 'description', 'imageUrl', 'price',
  'currency', 'status', 'categoryId', 'rating', 'reviewCount', 'tags', 'metadata'
]

const TO_COLUMN = {
  externalId: 'external_id',
  imageUrl: 'image_url',
  categoryId: 'category_id',
  reviewCount: 'review_count'
}

const toColumn = (key) => TO_COLUMN[key] || key


async function loadProductFull(sql, id) {
  const [product] = await sql`select * from products where id = ${id}`
  if (!product) return null

  const [[category], links, reviews] = await Promise.all([
    product.categoryId
      ? sql`select * from categories where id = ${product.categoryId}`
      : Promise.resolve([null]),
    sql`select * from affiliate_links where product_id = ${id}`,
    sql`select * from reviews where product_id = ${id} order by created_at desc`
  ])

  return {
    ...product,
    category: category || null,
    affiliateLinks: links,
    reviews
  }
}

export default async function adminProductRoutes(fastify, options) {
  const { sql, redis } = fastify

  fastify.addHook('onRequest', adminAuth)
  fastify.addHook('onRequest', csrfProtection)

  // List products
  fastify.get('/', async (request, reply) => {
    const {
      platform,
      categoryId,
      status,
      page = 1,
      limit = 50,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = request.query

    const safeLimit = Math.min(parseInt(limit, 10) || 50, 200)
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const skip = (safePage - 1) * safeLimit
    const sortColumn = ADMIN_SORTABLE[sortBy] || 'created_at'
    const sortOrder = order === 'asc' ? sql`asc` : sql`desc`
    const searchPattern = search ? `%${search.replace(/[%_\\]/g, '\\$&')}%` : null

    if (categoryId && !UUID_RE.test(categoryId)) {
      reply.code(400)
      return { error: 'Invalid categoryId' }
    }

    if (platform && !VALID_PLATFORMS.includes(platform)) {
      reply.code(400)
      return { error: 'Invalid platform' }
    }

    if (status && !VALID_STATUSES.includes(status)) {
      reply.code(400)
      return { error: 'Invalid status' }
    }

    const conditions = []
    if (platform) conditions.push(sql`platform = ${platform}`)
    if (categoryId) conditions.push(sql`category_id = ${categoryId}`)
    if (status) conditions.push(sql`status = ${status}`)
    if (searchPattern) {
      conditions.push(sql`(
        title ilike ${searchPattern}
        or description ilike ${searchPattern}
        or external_id ilike ${searchPattern}
      )`)
    }

    // conditions.length === 0 guard keeps reduce safe; sql`true` is the identity element
    const whereClause = conditions.length === 0
      ? sql`true`
      : conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} and ${c}`)

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

    return {
      products: await attachRelations(sql, products),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    }
  })

  // Get single product
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Product not found' }
    }
    const product = await loadProductFull(sql, id)
    if (!product) {
      reply.code(404)
      return { error: 'Product not found' }
    }
    return product
  })

  // Create product
  fastify.post('/', { schema: createProductSchema }, async (request, reply) => {
    const data = request.body
    const insertObj = Object.fromEntries(
      PRODUCT_FIELDS
        .filter(k => data[k] !== undefined)
        .map(k => [toColumn(k), data[k]])
    )

    try {
      const [created] = await sql`
        insert into products ${sql(insertObj)}
        returning *
      `

      const [category] = created.categoryId
        ? await sql`select * from categories where id = ${created.categoryId}`
        : [null]

      try {
        await delPattern(redis, 'products:list:*')
      } catch (cacheErr) {
        request.log.error({ err: cacheErr }, 'Redis cache eviction failed — stale data possible')
      }

      reply.code(201)
      return { ...created, category: category || null }
    } catch (error) {
      if (error.code === '23505') {
        reply.code(409)
        return {
          error: 'Conflict',
          message: 'Product with this platform and external ID already exists'
        }
      }
      if (error.code === '23503') {
        reply.code(422)
        return { error: 'Referenced category does not exist' }
      }
      throw error
    }
  })

  // Update product
  fastify.patch('/:id', { schema: updateProductSchema }, async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Product not found' }
    }
    const data = request.body
    const updateObj = Object.fromEntries(
      PRODUCT_FIELDS
        .filter(k => data[k] !== undefined)
        .map(k => [toColumn(k), data[k]])
    )

    if (Object.keys(updateObj).length === 0) {
      const product = await loadProductFull(sql, id)
      if (!product) {
        reply.code(404)
        return { error: 'Product not found' }
      }
      return product
    }

    let updated
    try {
      const rows = await sql`
        update products
        set ${sql(updateObj)}
        where id = ${id}
        returning *
      `
      updated = rows[0]
    } catch (error) {
      if (error.code === '23503') {
        reply.code(422)
        return { error: 'Referenced category does not exist' }
      }
      throw error
    }

    if (!updated) {
      reply.code(404)
      return { error: 'Product not found' }
    }

    const [[category], links] = await Promise.all([
      updated.categoryId
        ? sql`select * from categories where id = ${updated.categoryId}`
        : Promise.resolve([null]),
      sql`select * from affiliate_links where product_id = ${id}`
    ])

    try {
      await redis.del(`product:${id}`)
      await delPattern(redis, 'products:list:*')
    } catch (cacheErr) {
      request.log.error({ err: cacheErr }, 'Redis cache eviction failed — stale data possible')
    }

    return {
      ...updated,
      category: category || null,
      affiliateLinks: links
    }
  })

  // Delete product
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params

    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Product not found' }
    }

    const result = await sql`delete from products where id = ${id}`

    if (Number(result.count) === 0) {
      reply.code(404)
      return { error: 'Product not found' }
    }

    try {
      await redis.del(`product:${id}`)
      await delPattern(redis, 'products:list:*')
    } catch (cacheErr) {
      request.log.error({ err: cacheErr }, 'Redis cache eviction failed — stale data possible')
    }

    reply.code(204)
    return
  })

  // Bulk update status
  fastify.post('/bulk/status', { schema: bulkStatusProductsSchema }, async (request, reply) => {
    const { productIds, status } = request.body

    if (productIds.some(id => !UUID_RE.test(id))) {
      reply.code(400)
      return { error: 'Invalid product ID format' }
    }

    const result = await sql`
      update products
      set status = ${status}
      where id in ${sql(productIds)}
    `

    try {
      await delPattern(redis, 'products:list:*')
      await Promise.all(productIds.map(id => redis.del(`product:${id}`)))
    } catch (cacheErr) {
      request.log.error({ err: cacheErr }, 'Redis cache eviction failed — stale data possible')
    }

    return {
      success: true,
      updated: result.count
    }
  })

  // Bulk delete
  fastify.post('/bulk/delete', { schema: bulkDeleteProductsSchema }, async (request, reply) => {
    const { productIds } = request.body

    if (productIds.some(id => !UUID_RE.test(id))) {
      reply.code(400)
      return { error: 'Invalid product ID format' }
    }

    const result = await sql`
      delete from products where id in ${sql(productIds)}
    `

    try {
      await delPattern(redis, 'products:list:*')
      await Promise.all(productIds.map(id => redis.del(`product:${id}`)))
    } catch (cacheErr) {
      request.log.error({ err: cacheErr }, 'Redis cache eviction failed — stale data possible')
    }

    return {
      success: true,
      deleted: result.count
    }
  })

  // Dashboard stats
  fastify.get('/stats/dashboard', async (request, reply) => {
    const [
      [{ count: totalProducts }],
      [{ count: activeProducts }],
      [{ count: outOfStock }],
      [{ count: totalCategories }],
      [{ count: totalReviews }],
      recentProducts
    ] = await Promise.all([
      sql`select count(*)::int as count from products`,
      sql`select count(*)::int as count from products where status = 'ACTIVE'`,
      sql`select count(*)::int as count from products where status = 'OUT_OF_STOCK'`,
      sql`select count(*)::int as count from categories`,
      sql`select count(*)::int as count from reviews`,
      sql`select * from products order by created_at desc limit 5`
    ])

    return {
      stats: {
        totalProducts,
        activeProducts,
        inactiveProducts: totalProducts - activeProducts,
        outOfStock,
        totalCategories,
        totalReviews
      },
      recentProducts: await attachRelations(sql, recentProducts)
    }
  })
}

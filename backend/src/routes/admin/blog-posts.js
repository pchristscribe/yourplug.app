import { adminAuth } from '../../middleware/adminAuth.js'
import { UUID_RE } from '../../utils/constants.js'

const SLUG_RE     = /^[a-z0-9-]+$/
const VALID_STATUSES = ['draft', 'published', 'archived']
const SORTABLE    = { createdAt: 'created_at', updatedAt: 'updated_at', publishedAt: 'published_at', title: 'title' }

const WRITABLE_FIELDS = [
  'slug', 'title', 'excerpt', 'content', 'featured_image',
  'seo_title', 'seo_description', 'author_name', 'status'
]

const TO_COLUMN = {
  featuredImage:  'featured_image',
  seoTitle:       'seo_title',
  seoDescription: 'seo_description',
  authorName:     'author_name',
  publishedAt:    'published_at'
}
const toColumn = (k) => TO_COLUMN[k] || k

function invalidSlug(slug) {
  return typeof slug === 'string' && !SLUG_RE.test(slug)
}

export default async function adminBlogPostRoutes(fastify, _options) {
  const { sql, redis } = fastify

  fastify.addHook('onRequest', adminAuth)

  const bustCache = async (slug) => {
    await Promise.all([
      redis.del(`blog:slug:${slug}`),
      // Pattern-delete list cache keys — scan so we don't block
      redis.scan(0, 'MATCH', 'blog:list:*', 'COUNT', 100).then(([, keys]) =>
        keys.length ? redis.del(keys) : null
      )
    ])
  }

  // ── List (all statuses, admin view) ──────────────────────────────────────

  fastify.get('/', async (request, reply) => {
    const { status, search, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = request.query

    if (status && !VALID_STATUSES.includes(status)) {
      reply.code(400); return { error: 'Invalid status' }
    }

    const safeLimit  = Math.min(parseInt(limit, 10) || 20, 100)
    const safePage   = Math.max(1, parseInt(page, 10) || 1)
    const skip       = (safePage - 1) * safeLimit
    const sortColumn = SORTABLE[sortBy] || 'created_at'
    const sortOrder  = order === 'asc' ? sql`asc` : sql`desc`
    const searchPat  = search ? `%${search.replace(/[%_\\]/g, '\\$&')}%` : null

    const conditions = []
    if (status)    conditions.push(sql`status = ${status}`)
    if (searchPat) conditions.push(sql`(title ilike ${searchPat} or excerpt ilike ${searchPat})`)

    const where = conditions.length
      ? conditions.reduce((a, c, i) => i === 0 ? c : sql`${a} and ${c}`)
      : sql`true`

    const [posts, [{ count: total }]] = await Promise.all([
      sql`
        select id, slug, title, excerpt, author_name, status, published_at, created_at, updated_at
        from blog_posts
        where ${where}
        order by ${sql(sortColumn)} ${sortOrder}
        limit ${safeLimit} offset ${skip}
      `,
      sql`select count(*)::int as count from blog_posts where ${where}`
    ])

    return { posts, pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } }
  })

  // ── Get single (by id) ───────────────────────────────────────────────────

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'Post not found' } }

    const [post] = await sql`select * from blog_posts where id = ${id}`
    if (!post) { reply.code(404); return { error: 'Post not found' } }

    const [linkedProducts, linkedCategories] = await Promise.all([
      sql`
        select p.id, p.title, p.image_url, bpp.display_order
        from blog_post_products bpp
        join products p on p.id = bpp.product_id
        where bpp.blog_post_id = ${id}
        order by bpp.display_order
      `,
      sql`
        select c.id, c.name, c.slug
        from blog_post_categories bpc
        join categories c on c.id = bpc.category_id
        where bpc.blog_post_id = ${id}
      `
    ])

    return { ...post, linkedProducts, linkedCategories }
  })

  // ── Create ────────────────────────────────────────────────────────────────

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['slug', 'title', 'content'],
        properties: {
          slug:           { type: 'string', minLength: 1, maxLength: 200 },
          title:          { type: 'string', minLength: 1, maxLength: 300 },
          excerpt:        { type: 'string', maxLength: 500 },
          content:        { type: 'string', minLength: 1 },
          featured_image: { type: 'string', maxLength: 2048 },
          seo_title:      { type: 'string', maxLength: 60 },
          seo_description:{ type: 'string', maxLength: 160 },
          author_name:    { type: 'string', maxLength: 100 },
          status:         { type: 'string', enum: VALID_STATUSES },
          productIds:     { type: 'array', items: { type: 'string', format: 'uuid' } },
          categoryIds:    { type: 'array', items: { type: 'string', format: 'uuid' } }
        },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { productIds = [], categoryIds = [], ...data } = request.body

    if (invalidSlug(data.slug)) {
      reply.code(400); return { error: 'Slug must be lowercase alphanumeric with hyphens' }
    }

    const insertObj = Object.fromEntries(
      WRITABLE_FIELDS.filter(k => data[k] !== undefined).map(k => [toColumn(k), data[k]])
    )

    try {
      const [post] = await sql`insert into blog_posts ${sql(insertObj)} returning *`

      if (productIds.length) {
        await sql`
          insert into blog_post_products (blog_post_id, product_id, display_order)
          values ${sql(productIds.map((pid, i) => [post.id, pid, i]))}
        `
      }
      if (categoryIds.length) {
        await sql`
          insert into blog_post_categories (blog_post_id, category_id)
          values ${sql(categoryIds.map(cid => [post.id, cid]))}
        `
      }

      await bustCache(post.slug)
      reply.code(201)
      return post
    } catch (err) {
      if (err.code === '23505') { reply.code(409); return { error: 'Slug already exists' } }
      throw err
    }
  })

  // ── Update (PATCH) ────────────────────────────────────────────────────────

  fastify.patch('/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          slug:           { type: 'string', minLength: 1, maxLength: 200 },
          title:          { type: 'string', minLength: 1, maxLength: 300 },
          excerpt:        { type: 'string', maxLength: 500 },
          content:        { type: 'string', minLength: 1 },
          featured_image: { type: 'string', maxLength: 2048 },
          seo_title:      { type: 'string', maxLength: 60 },
          seo_description:{ type: 'string', maxLength: 160 },
          author_name:    { type: 'string', maxLength: 100 },
          status:         { type: 'string', enum: VALID_STATUSES },
          productIds:     { type: 'array', items: { type: 'string', format: 'uuid' } },
          categoryIds:    { type: 'array', items: { type: 'string', format: 'uuid' } }
        },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'Post not found' } }

    const { productIds, categoryIds, ...data } = request.body

    if (data.slug && invalidSlug(data.slug)) {
      reply.code(400); return { error: 'Slug must be lowercase alphanumeric with hyphens' }
    }

    const updateObj = Object.fromEntries(
      WRITABLE_FIELDS.filter(k => data[k] !== undefined).map(k => [toColumn(k), data[k]])
    )

    let post
    if (Object.keys(updateObj).length) {
      ;[post] = await sql`update blog_posts set ${sql(updateObj)} where id = ${id} returning *`
      if (!post) { reply.code(404); return { error: 'Post not found' } }
    } else {
      ;[post] = await sql`select * from blog_posts where id = ${id}`
      if (!post) { reply.code(404); return { error: 'Post not found' } }
    }

    // Replace product associations if provided
    if (Array.isArray(productIds)) {
      await sql`delete from blog_post_products where blog_post_id = ${id}`
      if (productIds.length) {
        await sql`
          insert into blog_post_products (blog_post_id, product_id, display_order)
          values ${sql(productIds.map((pid, i) => [id, pid, i]))}
        `
      }
    }

    // Replace category associations if provided
    if (Array.isArray(categoryIds)) {
      await sql`delete from blog_post_categories where blog_post_id = ${id}`
      if (categoryIds.length) {
        await sql`
          insert into blog_post_categories (blog_post_id, category_id)
          values ${sql(categoryIds.map(cid => [id, cid]))}
        `
      }
    }

    await bustCache(post.slug)
    return post
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'Post not found' } }

    const [post] = await sql`select slug from blog_posts where id = ${id}`
    if (!post) { reply.code(404); return { error: 'Post not found' } }

    await sql`delete from blog_posts where id = ${id}`
    await bustCache(post.slug)
    reply.code(204)
  })

  // ── Publish / unpublish shortcuts ─────────────────────────────────────────

  fastify.post('/:id/publish', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'Post not found' } }

    const [post] = await sql`
      update blog_posts
      set status = 'published', published_at = coalesce(published_at, now())
      where id = ${id}
      returning *
    `
    if (!post) { reply.code(404); return { error: 'Post not found' } }
    await bustCache(post.slug)
    return post
  })

  fastify.post('/:id/unpublish', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'Post not found' } }

    const [post] = await sql`
      update blog_posts set status = 'draft'
      where id = ${id}
      returning *
    `
    if (!post) { reply.code(404); return { error: 'Post not found' } }
    await bustCache(post.slug)
    return post
  })
}

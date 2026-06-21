import { UUID_RE } from '../utils/constants.js'

const CACHE_TTL = 600 // 10 minutes

export default async function blogPostRoutes(fastify, _options) {
  const { sql, redis } = fastify

  // List published posts
  // GET /api/blog-posts?page=1&limit=10&categoryId=<uuid>
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 10, categoryId } = request.query

    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50)
    const safePage  = Math.max(1, parseInt(page, 10) || 1)
    const skip      = (safePage - 1) * safeLimit

    if (categoryId && !UUID_RE.test(categoryId)) {
      reply.code(400)
      return { error: 'Invalid categoryId' }
    }

    const cacheKey = `blog:list:${JSON.stringify({ page: safePage, limit: safeLimit, categoryId })}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const baseCondition = sql`bp.status = 'published'`
    const categoryJoin  = categoryId
      ? sql`
          join blog_post_categories bpc
            on bpc.blog_post_id = bp.id and bpc.category_id = ${categoryId}
        `
      : sql``

    const [posts, [{ count: total }]] = await Promise.all([
      sql`
        select bp.id, bp.slug, bp.title, bp.excerpt, bp.featured_image,
               bp.author_name, bp.published_at, bp.seo_title, bp.seo_description
        from blog_posts bp
        ${categoryJoin}
        where ${baseCondition}
        order by bp.published_at desc
        limit ${safeLimit}
        offset ${skip}
      `,
      sql`
        select count(distinct bp.id)::int as count
        from blog_posts bp
        ${categoryJoin}
        where ${baseCondition}
      `
    ])

    const result = {
      data: posts,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    }

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result))
    return result
  })

  // Get single post by slug (includes linked products and categories)
  // GET /api/blog-posts/:slug
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params

    // Slugs are alphanumeric + hyphens; reject anything suspicious
    if (!/^[a-z0-9-]+$/.test(slug)) {
      reply.code(404)
      return { error: 'Post not found' }
    }

    const cacheKey = `blog:slug:${slug}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const [post] = await sql`
      select * from blog_posts
      where slug = ${slug} and status = 'published'
    `

    if (!post) {
      reply.code(404)
      return { error: 'Post not found' }
    }

    const [linkedProducts, linkedCategories] = await Promise.all([
      sql`
        select p.id, p.title, p.image_url, p.price, p.rating,
               bpp.display_order
        from blog_post_products bpp
        join products p on p.id = bpp.product_id and p.status = 'ACTIVE'
        where bpp.blog_post_id = ${post.id}
        order by bpp.display_order
      `,
      sql`
        select c.id, c.name, c.slug, c.image_url
        from blog_post_categories bpc
        join categories c on c.id = bpc.category_id
        where bpc.blog_post_id = ${post.id}
      `
    ])

    const result = { ...post, linkedProducts, linkedCategories }
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result))
    return result
  })
}

import { UUID_RE } from '../../utils/constants.js'
import { listListingsSchema } from '../../schemas/consignment.js'

const SORTABLE = {
  askingPrice: 'asking_price',
  createdAt: 'created_at',
}

export default async function consignmentListingRoutes(fastify) {
  const { sql } = fastify

  fastify.get('/', { schema: listListingsSchema }, async (request, reply) => {
    const {
      category,
      condition,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20,
    } = request.query

    const safeLimit = Math.min(parseInt(limit, 10) || 20, 50)
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const skip = (safePage - 1) * safeLimit
    const sortColumn = SORTABLE[sortBy] || 'created_at'
    const sortOrder = order === 'asc' ? sql`asc` : sql`desc`

    const conditions = [sql`l.status = 'APPROVED'`]
    if (category) conditions.push(sql`l.category = ${category}::consignment_category`)
    if (condition) conditions.push(sql`l.condition = ${condition}::consignment_condition`)
    if (minPrice) conditions.push(sql`l.asking_price >= ${parseFloat(minPrice)}`)
    if (maxPrice) conditions.push(sql`l.asking_price <= ${parseFloat(maxPrice)}`)

    const whereClause = conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} and ${c}`)

    const [listings, [{ count: total }]] = await Promise.all([
      sql`
        select
          l.id,
          l.title,
          l.condition,
          l.category,
          l.asking_price,
          l.created_at,
          sp.display_name as seller_display_name,
          (
            select ci.public_url
            from consignment_images ci
            where ci.listing_id = l.id and ci.is_primary = true
            limit 1
          ) as primary_image_url
        from consignment_listings l
        left join seller_profiles sp on sp.id = l.seller_id
        where ${whereClause}
        order by ${sql(sortColumn)} ${sortOrder}
        limit ${safeLimit} offset ${skip}
      `,
      sql`
        select count(*) from consignment_listings l where ${whereClause}
      `,
    ])

    return {
      data: listings,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: parseInt(total, 10),
        pages: Math.ceil(parseInt(total, 10) / safeLimit),
      },
    }
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const [listing] = await sql`
      select
        l.*,
        sp.display_name as seller_display_name,
        sp.total_sales as seller_total_sales
      from consignment_listings l
      left join seller_profiles sp on sp.id = l.seller_id
      where l.id = ${id} and l.status = 'APPROVED'
    `

    if (!listing) {
      reply.code(404)
      return { error: 'Listing not found' }
    }

    const images = await sql`
      select id, public_url, is_primary, sort_order
      from consignment_images
      where listing_id = ${id}
      order by sort_order asc, created_at asc
    `

    return { ...listing, images }
  })
}

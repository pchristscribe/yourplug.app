import { adminAuth, csrfProtection } from '../../middleware/adminAuth.js'
import { UUID_RE } from '../../utils/constants.js'

export default async function adminConsignmentRoutes(fastify) {
  const { sql } = fastify

  fastify.addHook('onRequest', adminAuth)
  fastify.addHook('onRequest', csrfProtection)

  fastify.get('/listings', async (request) => {
    const {
      moderationStatus,
      page = 1,
      limit = 20,
    } = request.query

    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100)
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const skip = (safePage - 1) * safeLimit

    const conditions = []
    if (moderationStatus) {
      conditions.push(sql`l.moderation_status = ${moderationStatus}::moderation_decision`)
    }

    const whereClause = conditions.length > 0
      ? conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} and ${c}`)
      : sql`true`

    const [listings, [{ count: total }]] = await Promise.all([
      sql`
        select
          l.*,
          sp.display_name as seller_display_name,
          (
            select json_build_object('publicUrl', ci.public_url, 'id', ci.id)
            from consignment_images ci
            where ci.listing_id = l.id and ci.is_primary = true
            limit 1
          ) as primary_image
        from consignment_listings l
        left join seller_profiles sp on sp.id = l.seller_id
        where ${whereClause}
        order by l.created_at desc
        limit ${safeLimit} offset ${skip}
      `,
      sql`select count(*) from consignment_listings l where ${whereClause}`,
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

  fastify.patch('/listings/:id/approve', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const [listing] = await sql`
      update consignment_listings
      set moderation_status = 'APPROVED'::moderation_decision,
          status = 'APPROVED'::listing_status,
          moderation_at = now()
      where id = ${id}
      returning *
    `
    if (!listing) {
      reply.code(404)
      return { error: 'Listing not found' }
    }
    return listing
  })

  fastify.patch('/listings/:id/reject', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const { reason } = request.body || {}
    if (!reason?.trim()) {
      reply.code(400)
      return { error: 'Rejection reason is required' }
    }

    const [listing] = await sql`
      update consignment_listings
      set moderation_status = 'REJECTED'::moderation_decision,
          status = 'REJECTED'::listing_status,
          moderation_reason = ${reason},
          moderation_at = now()
      where id = ${id}
      returning *
    `
    if (!listing) {
      reply.code(404)
      return { error: 'Listing not found' }
    }
    return listing
  })

  fastify.get('/moderation-logs/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const logs = await sql`
      select
        ml.*,
        ci.public_url as image_url
      from consignment_moderation_logs ml
      left join consignment_images ci on ci.id = ml.image_id
      where ml.listing_id = ${id}
      order by ml.created_at asc
    `
    return logs
  })
}

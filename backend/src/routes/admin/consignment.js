import { adminAuth, csrfProtection } from '../../middleware/adminAuth.js'
import { getSignedUrl } from '../../lib/imageStorage.js'
import { adminListListingsSchema, uuidParamsSchema, rejectListingSchema } from '../../schemas/consignment.js'

export default async function adminConsignmentRoutes(fastify) {
  const { sql } = fastify

  fastify.addHook('onRequest', adminAuth)
  fastify.addHook('onRequest', csrfProtection)

  fastify.get('/listings', { schema: adminListListingsSchema }, async (request) => {
    const { moderationStatus, page, limit } = request.query

    const safeLimit = limit
    const safePage = page
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
            select json_build_object('storagePath', ci.storage_path, 'id', ci.id)
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

    const signedListings = await Promise.all(
      listings.map(async (l) => ({
        ...l,
        primaryImage: l.primaryImage?.storagePath
          ? { ...l.primaryImage, publicUrl: await getSignedUrl(l.primaryImage.storagePath) }
          : l.primaryImage,
      }))
    )

    return {
      data: signedListings,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: parseInt(total, 10),
        pages: Math.ceil(parseInt(total, 10) / safeLimit),
      },
    }
  })

  // Approve/reject only apply to listings actually awaiting a decision.
  // Guarding the transition in SQL prevents e.g. re-approving a REJECTED
  // listing or racing a second moderator on an already-decided one.
  fastify.patch('/listings/:id/approve', { schema: uuidParamsSchema }, async (request, reply) => {
    const { id } = request.params

    const [listing] = await sql`
      update consignment_listings
      set moderation_status = 'APPROVED'::moderation_decision,
          status = 'APPROVED'::listing_status,
          moderation_reason = null,
          moderation_at = now()
      where id = ${id}
        and moderation_status in ('PENDING', 'FLAGGED')
      returning *
    `
    if (!listing) {
      const [exists] = await sql`select moderation_status from consignment_listings where id = ${id}`
      if (!exists) {
        reply.code(404)
        return { error: 'Listing not found' }
      }
      reply.code(409)
      return { error: `Listing is ${exists.moderationStatus}; only pending or flagged listings can be approved` }
    }
    return listing
  })

  fastify.patch('/listings/:id/reject', { schema: rejectListingSchema }, async (request, reply) => {
    const { id } = request.params
    const { reason } = request.body

    const [listing] = await sql`
      update consignment_listings
      set moderation_status = 'REJECTED'::moderation_decision,
          status = 'REJECTED'::listing_status,
          moderation_reason = ${reason},
          moderation_at = now()
      where id = ${id}
        and moderation_status in ('PENDING', 'FLAGGED')
      returning *
    `
    if (!listing) {
      const [exists] = await sql`select moderation_status from consignment_listings where id = ${id}`
      if (!exists) {
        reply.code(404)
        return { error: 'Listing not found' }
      }
      reply.code(409)
      return { error: `Listing is ${exists.moderationStatus}; only pending or flagged listings can be rejected` }
    }
    return listing
  })

  fastify.get('/moderation-logs/:id', { schema: uuidParamsSchema }, async (request) => {
    const { id } = request.params

    const logs = await sql`
      select
        ml.*,
        ci.storage_path as image_path
      from consignment_moderation_logs ml
      left join consignment_images ci on ci.id = ml.image_id
      where ml.listing_id = ${id}
      order by ml.created_at asc
    `
    const signedLogs = await Promise.all(
      logs.map(async (log) => ({
        ...log,
        imageUrl: log.imagePath ? await getSignedUrl(log.imagePath) : null,
      }))
    )
    // Wrap in an object to match the list-response contract used by every
    // other list endpoint (and to keep the shape extensible).
    return { data: signedLogs }
  })
}

import { userAuth } from '../../middleware/userAuth.js'
import { uploadImage, deleteImage } from '../../lib/imageStorage.js'
import { createConnectedAccount, createOnboardingLink } from '../../lib/stripe.js'
import { moderateImage, runFullModeration } from '../../lib/moderation.js'
import { extractExifDate, checkFreshness } from '../../lib/imageFreshness.js'
import { createListingSchema, updateListingSchema, offerActionSchema } from '../../schemas/consignment.js'
import { UUID_RE } from '../../utils/constants.js'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/webp', 'image/png'])

export default async function consignmentSellerRoutes(fastify) {
  const { sql } = fastify

  fastify.addHook('onRequest', userAuth)

  // ── Listings ──────────────────────────────────────────────────────────────

  fastify.get('/listings', async (request) => {
    const listings = await sql`
      select
        l.*,
        coalesce(
          json_agg(ci order by ci.sort_order asc) filter (where ci.id is not null),
          '[]'
        ) as images
      from consignment_listings l
      left join consignment_images ci on ci.listing_id = l.id
      where l.seller_id = ${request.userId}
      group by l.id
      order by l.created_at desc
    `
    return listings
  })

  fastify.post('/listings', { schema: createListingSchema }, async (request, reply) => {
    const { title, description = '', condition, category, askingPrice } = request.body

    const [listing] = await sql`
      insert into consignment_listings
        (seller_id, title, description, condition, category, asking_price)
      values
        (${request.userId}, ${title}, ${description}, ${condition}::consignment_condition,
         ${category}::consignment_category, ${askingPrice})
      returning *
    `

    reply.code(201)
    return listing
  })

  fastify.patch('/listings/:id', { schema: updateListingSchema }, async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const [listing] = await sql`
      select id, status, seller_id from consignment_listings where id = ${id}
    `
    if (!listing || listing.sellerId !== request.userId) {
      reply.code(404)
      return { error: 'Listing not found' }
    }
    if (!['DRAFT', 'REJECTED'].includes(listing.status)) {
      reply.code(422)
      return { error: 'Only DRAFT or REJECTED listings can be edited' }
    }

    const fields = request.body
    const updates = []
    if (fields.title !== undefined) updates.push(sql`title = ${fields.title}`)
    if (fields.description !== undefined) updates.push(sql`description = ${fields.description}`)
    if (fields.condition !== undefined) updates.push(sql`condition = ${fields.condition}::consignment_condition`)
    if (fields.category !== undefined) updates.push(sql`category = ${fields.category}::consignment_category`)
    if (fields.askingPrice !== undefined) updates.push(sql`asking_price = ${fields.askingPrice}`)

    if (updates.length === 0) {
      reply.code(400)
      return { error: 'No valid fields to update' }
    }

    const [updated] = await sql`
      update consignment_listings
      set ${updates.reduce((acc, u, i) => i === 0 ? u : sql`${acc}, ${u}`)}
      where id = ${id} and seller_id = ${request.userId}
      returning *
    `
    return updated
  })

  fastify.delete('/listings/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const [listing] = await sql`
      select id, status, seller_id from consignment_listings where id = ${id}
    `
    if (!listing || listing.sellerId !== request.userId) {
      reply.code(404)
      return { error: 'Listing not found' }
    }
    if (!['DRAFT', 'REJECTED'].includes(listing.status)) {
      reply.code(422)
      return { error: 'Only DRAFT or REJECTED listings can be deleted' }
    }

    const images = await sql`select storage_path from consignment_images where listing_id = ${id}`
    await Promise.all(images.map(img => deleteImage(img.storagePath).catch(() => {})))
    await sql`delete from consignment_listings where id = ${id}`
    reply.code(204)
  })

  fastify.post('/listings/:id/submit', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const [listing] = await sql`
      select id, status, seller_id from consignment_listings where id = ${id}
    `
    if (!listing || listing.sellerId !== request.userId) {
      reply.code(404)
      return { error: 'Listing not found' }
    }
    if (!['DRAFT', 'REJECTED'].includes(listing.status)) {
      reply.code(422)
      return { error: 'Listing cannot be submitted in its current state' }
    }

    const imageCount = await sql`select count(*) from consignment_images where listing_id = ${id}`
    if (parseInt(imageCount[0].count, 10) === 0) {
      reply.code(422)
      return { error: 'At least one image is required before submitting' }
    }

    // Clear stale moderation metadata immediately — the owner read returns
    // these fields, so a resubmitted listing must not show the old rejection
    // reason while the async moderation job runs. The WHERE clause repeats
    // the status guard atomically so two concurrent submits can't both pass
    // and both kick off runFullModeration for the same listing.
    const [submitted] = await sql`
      update consignment_listings
      set status = 'PENDING_MODERATION',
          moderation_status = 'PENDING',
          moderation_reason = null,
          moderation_at = null
      where id = ${id} and status in ('DRAFT', 'REJECTED')
      returning id
    `
    if (!submitted) {
      reply.code(422)
      return { error: 'Listing cannot be submitted in its current state' }
    }

    runFullModeration(sql, id).catch(err => fastify.log.error({ err, listingId: id }, 'moderation failed'))

    return { message: 'Submitted for moderation' }
  })

  // ── Image upload ──────────────────────────────────────────────────────────

  fastify.post('/listings/:id/images', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const [listing] = await sql`
      select id, title, category, seller_id from consignment_listings where id = ${id}
    `
    if (!listing || listing.sellerId !== request.userId) {
      reply.code(404)
      return { error: 'Listing not found' }
    }

    let data
    try {
      data = await request.file({ limits: { fileSize: MAX_IMAGE_BYTES } })
    } catch (err) {
      if (err.code === 'FST_FILES_LIMIT' || err.statusCode === 413) {
        reply.code(413)
        return { error: 'File too large (max 5MB)' }
      }
      throw err
    }

    if (!data) {
      reply.code(400)
      return { error: 'No file uploaded' }
    }

    const mimeType = data.mimetype
    if (!ALLOWED_MIME.has(mimeType)) {
      await data.toBuffer().catch(() => {})
      reply.code(422)
      return { error: 'Invalid file type. Allowed: JPEG, WebP, PNG' }
    }

    const chunks = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const capturedAt = extractExifDate(buffer)
    const { freshnessOk, freshnessDeltaSec, tooOld } = checkFreshness(capturedAt)
    if (tooOld) {
      reply.code(422)
      return { error: 'IMAGE_TOO_OLD', message: 'Photo must be taken within 15 minutes of upload' }
    }

    const { storagePath, publicUrl } = await uploadImage(buffer, mimeType, id)

    // Lock the listing row so concurrent uploads for the same new listing
    // can't both observe count === 0 and both insert as primary.
    const [image] = await sql.begin(async (tx) => {
      await tx`select id from consignment_listings where id = ${id} for update`
      const existingCount = await tx`select count(*) from consignment_images where listing_id = ${id}`
      const isPrimary = parseInt(existingCount[0].count, 10) === 0

      return tx`
        insert into consignment_images
          (listing_id, storage_path, public_url, is_primary, exif_captured_at, freshness_delta_sec, freshness_ok)
        values
          (${id}, ${storagePath}, ${publicUrl}, ${isPrimary}, ${capturedAt}, ${freshnessDeltaSec}, ${freshnessOk})
        returning *
      `
    })

    moderateImage(sql, { ...image, listingId: id }, listing).catch(err =>
      fastify.log.error({ err, imageId: image.id }, 'image moderation failed')
    )

    reply.code(201)
    return image
  })

  fastify.delete('/images/:imageId', async (request, reply) => {
    const { imageId } = request.params
    if (!UUID_RE.test(imageId)) {
      reply.code(400)
      return { error: 'Invalid image ID' }
    }

    const [image] = await sql`
      select ci.id, ci.storage_path, ci.listing_id, ci.is_primary, l.seller_id
      from consignment_images ci
      join consignment_listings l on l.id = ci.listing_id
      where ci.id = ${imageId}
    `
    if (!image || image.sellerId !== request.userId) {
      reply.code(404)
      return { error: 'Image not found' }
    }

    await deleteImage(image.storagePath).catch(() => {})
    await sql`delete from consignment_images where id = ${imageId}`

    // Promote the next image to primary ONLY if the deleted one was primary —
    // unconditional promotion could leave two rows with is_primary = true.
    if (image.isPrimary) {
      await sql`
        update consignment_images
        set is_primary = true
        where listing_id = ${image.listingId}
          and id = (
            select id from consignment_images
            where listing_id = ${image.listingId}
            order by sort_order asc, created_at asc
            limit 1
          )
      `
    }

    reply.code(204)
  })

  // ── Stripe Connect ────────────────────────────────────────────────────────

  fastify.post('/stripe/onboard', async (request, reply) => {
    let [profile] = await sql`
      select id, stripe_account_id, stripe_onboarding_done
      from seller_profiles
      where id = ${request.userId}
    `

    if (!profile) {
      const [user] = await sql`select email from auth.users where id = ${request.userId}`
      // Stable per-user key: two concurrent onboarding requests for the same
      // seller resolve to the same Stripe account instead of orphaning one.
      const account = await createConnectedAccount(user?.email || '', `connect-account:${request.userId}`)
      ;[profile] = await sql`
        insert into seller_profiles (id, stripe_account_id)
        values (${request.userId}, ${account.id})
        on conflict (id) do update set stripe_account_id = ${account.id}
        returning *
      `
    }

    if (profile.stripeOnboardingDone) {
      return { alreadyOnboarded: true }
    }

    const baseUrl = process.env.MARKETPLACE_URL || 'http://localhost:3003'
    const link = await createOnboardingLink(
      profile.stripeAccountId,
      `${baseUrl}/account/stripe?onboard=success`,
      `${baseUrl}/account/stripe?onboard=refresh`
    )

    return { url: link.url }
  })

  fastify.get('/stripe/status', async (request) => {
    const [profile] = await sql`
      select stripe_onboarding_done, stripe_account_id
      from seller_profiles
      where id = ${request.userId}
    `
    return {
      onboarded: profile?.stripeOnboardingDone ?? false,
      hasAccount: Boolean(profile?.stripeAccountId),
    }
  })

  // ── Offer management (seller perspective) ────────────────────────────────

  fastify.patch('/offers/:id', { schema: offerActionSchema }, async (request, reply) => {
    const { id } = request.params
    const { action } = request.body

    const [offer] = await sql`
      select o.id, o.status, o.listing_id, o.expires_at, l.seller_id
      from consignment_offers o
      join consignment_listings l on l.id = o.listing_id
      where o.id = ${id}
    `
    if (!offer || offer.sellerId !== request.userId) {
      reply.code(404)
      return { error: 'Offer not found' }
    }
    if (offer.status !== 'PENDING') {
      reply.code(422)
      return { error: 'Only PENDING offers can be accepted or rejected' }
    }
    if (action === 'ACCEPTED' && new Date(offer.expiresAt) <= new Date()) {
      reply.code(422)
      return { error: 'This offer has expired' }
    }

    // Both updates must succeed or fail together — otherwise a failure after
    // the accept but before the sibling-rejection could leave two offers
    // acceptable on the same listing (double sale).
    const [updated] = await sql.begin(async (tx) => {
      const [row] = await tx`
        update consignment_offers
        set status = ${action}::offer_status
        where id = ${id}
        returning *
      `
      if (action === 'ACCEPTED') {
        await tx`
          update consignment_offers
          set status = 'REJECTED'::offer_status
          where listing_id = ${offer.listingId} and id != ${id} and status = 'PENDING'
        `
      }
      return [row]
    })

    return updated
  })
}

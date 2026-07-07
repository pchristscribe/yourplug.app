import { userAuth } from '../../middleware/userAuth.js'
import { createCheckoutSession } from '../../lib/stripe.js'
import { createOfferSchema, createTransactionSchema } from '../../schemas/consignment.js'
import { UUID_RE } from '../../utils/constants.js'

export default async function consignmentOfferRoutes(fastify) {
  const { sql } = fastify

  fastify.addHook('onRequest', userAuth)

  fastify.get('/', async (request) => {
    const offers = await sql`
      select
        o.*,
        l.title as listing_title,
        l.asking_price as listing_asking_price,
        (
          select ci.public_url
          from consignment_images ci
          where ci.listing_id = l.id and ci.is_primary = true
          limit 1
        ) as listing_primary_image
      from consignment_offers o
      join consignment_listings l on l.id = o.listing_id
      where o.buyer_id = ${request.userId}
      order by o.created_at desc
    `
    return { data: offers }
  })

  fastify.post('/listings/:id/offers', { schema: createOfferSchema }, async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid listing ID' }
    }

    const [listing] = await sql`
      select id, status, seller_id from consignment_listings where id = ${id}
    `
    if (!listing || listing.status !== 'APPROVED') {
      reply.code(404)
      return { error: 'Listing not found' }
    }
    if (listing.sellerId === request.userId) {
      reply.code(422)
      return { error: 'You cannot make an offer on your own listing' }
    }

    const existingPending = await sql`
      select id from consignment_offers
      where listing_id = ${id} and buyer_id = ${request.userId} and status = 'PENDING'
    `
    if (existingPending.length > 0) {
      reply.code(422)
      return { error: 'You already have a pending offer on this listing' }
    }

    const { amount, message } = request.body
    const [offer] = await sql`
      insert into consignment_offers (listing_id, buyer_id, amount, message)
      values (${id}, ${request.userId}, ${amount}, ${message || null})
      returning *
    `

    reply.code(201)
    return offer
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(400)
      return { error: 'Invalid offer ID' }
    }

    const [offer] = await sql`
      select id, status, buyer_id from consignment_offers where id = ${id}
    `
    if (!offer || offer.buyerId !== request.userId) {
      reply.code(404)
      return { error: 'Offer not found' }
    }
    if (offer.status !== 'PENDING') {
      reply.code(422)
      return { error: 'Only PENDING offers can be withdrawn' }
    }

    await sql`update consignment_offers set status = 'WITHDRAWN' where id = ${id}`
    reply.code(204)
  })

  fastify.post('/transactions', { schema: createTransactionSchema }, async (request, reply) => {
    const { offerId } = request.body

    const [offer] = await sql`
      select o.*, l.title, l.platform_fee_pct, l.id as listing_id
      from consignment_offers o
      join consignment_listings l on l.id = o.listing_id
      where o.id = ${offerId} and o.buyer_id = ${request.userId} and o.status = 'ACCEPTED'
    `
    if (!offer) {
      reply.code(404)
      return { error: 'Accepted offer not found' }
    }

    const [sellerProfile] = await sql`
      select stripe_account_id, stripe_onboarding_done
      from seller_profiles
      where id = (
        select seller_id from consignment_listings where id = ${offer.listingId}
      )
    `
    if (!sellerProfile?.stripeAccountId || !sellerProfile.stripeOnboardingDone) {
      reply.code(422)
      return { error: 'Seller has not completed Stripe onboarding' }
    }

    // Idempotency: one transaction per offer (unique offer_id). A repeat
    // call must not create a second checkout session or duplicate row.
    const [existing] = await sql`
      select id, payment_status from consignment_transactions where offer_id = ${offerId}
    `
    if (existing && existing.paymentStatus !== 'PENDING') {
      reply.code(422)
      return { error: 'This offer has already been paid' }
    }

    const [buyer] = await sql`select email from auth.users where id = ${request.userId}`

    const platformFeePct = parseFloat(offer.platformFeePct || 0.15)
    const listing = {
      id: offer.listingId,
      title: offer.title,
      platformFeePct,
    }

    // Safe to call repeatedly: keyed with idempotencyKey checkout-session:<offerId>,
    // so Stripe returns the same session instead of creating a new one.
    const session = await createCheckoutSession({
      listing,
      offer: { id: offer.id, amount: parseFloat(offer.amount) },
      sellerStripeAccountId: sellerProfile.stripeAccountId,
      buyerEmail: buyer.email,
    })

    const salePrice = parseFloat(offer.amount)
    const platformFee = Math.round(salePrice * 100 * platformFeePct) / 100
    const sellerPayout = salePrice - platformFee

    await sql`
      insert into consignment_transactions
        (listing_id, offer_id, seller_id, buyer_id, sale_price, platform_fee, seller_payout, stripe_payment_intent)
      values (
        ${offer.listingId},
        ${offerId},
        (select seller_id from consignment_listings where id = ${offer.listingId}),
        ${request.userId},
        ${salePrice},
        ${platformFee},
        ${sellerPayout},
        ${session.payment_intent}
      )
      on conflict (offer_id) do update
        set stripe_payment_intent = excluded.stripe_payment_intent
    `

    return { checkoutUrl: session.url }
  })
}

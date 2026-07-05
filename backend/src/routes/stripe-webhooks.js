import { constructWebhookEvent } from '../lib/stripe.js'

export default async function stripeWebhookRoutes(fastify) {
  const { sql } = fastify

  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body)
  })

  fastify.post('/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature']
    const secret = process.env.STRIPE_WEBHOOK_SECRET

    if (!sig || !secret) {
      reply.code(400)
      return { error: 'Missing signature or webhook secret' }
    }

    let event
    try {
      event = constructWebhookEvent(request.body, sig, secret)
    } catch (err) {
      reply.code(400)
      return { error: `Webhook verification failed: ${err.message}` }
    }

    try {
      switch (event.type) {
        case 'account.updated': {
          const account = event.data.object
          if (account.charges_enabled && account.payouts_enabled) {
            await sql`
              update seller_profiles
              set stripe_onboarding_done = true
              where stripe_account_id = ${account.id}
            `
          }
          break
        }

        case 'checkout.session.completed': {
          const session = event.data.object
          const paymentIntent = session.payment_intent
          if (paymentIntent) {
            await sql`
              update consignment_transactions
              set payment_status = 'AWAITING_SHIPMENT'::payment_status
              where stripe_payment_intent = ${paymentIntent}
            `
          }
          break
        }

        case 'payment_intent.succeeded': {
          const pi = event.data.object
          await sql`
            update consignment_transactions
            set payment_status = 'AWAITING_SHIPMENT'::payment_status
            where stripe_payment_intent = ${pi.id}
              and payment_status = 'PENDING'::payment_status
          `
          break
        }

        default:
          break
      }
    } catch (err) {
      fastify.log.error({ err, eventType: event.type }, 'webhook handler error')
      reply.code(500)
      return { error: 'Internal error processing webhook' }
    }

    return { received: true }
  })
}

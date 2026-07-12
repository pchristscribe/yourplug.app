import Stripe from 'stripe'

let _stripe = null
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  }
  return _stripe
}

export async function createConnectedAccount(email, idempotencyKey) {
  return getStripe().accounts.create(
    { type: 'express', email },
    idempotencyKey ? { idempotencyKey } : undefined
  )
}

export async function createOnboardingLink(accountId, returnUrl, refreshUrl) {
  return getStripe().accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  })
}

export async function createCheckoutSession({ listing, offer, sellerStripeAccountId, buyerEmail }) {
  const stripe = getStripe()
  const unitAmount = Math.round(offer.amount * 100)
  const feeAmount = Math.round(unitAmount * listing.platformFeePct)

  // Idempotency key scoped to the offer: a retried request reuses the
  // same checkout session instead of creating a duplicate money-moving call.
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: buyerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: listing.title },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: feeAmount,
      transfer_data: { destination: sellerStripeAccountId },
    },
    metadata: {
      listingId: listing.id,
      offerId: offer.id,
    },
    success_url: `${process.env.MARKETPLACE_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.MARKETPLACE_URL}/listings/${listing.id}?checkout=cancel`,
  }, {
    idempotencyKey: `checkout-session:${offer.id}`,
  })
}

export async function createTransfer(amountCents, connectedAccountId, metadata = {}, idempotencyKey) {
  return getStripe().transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: connectedAccountId,
    metadata,
  }, idempotencyKey ? { idempotencyKey } : undefined)
}

export function constructWebhookEvent(rawBody, sig, secret) {
  return getStripe().webhooks.constructEvent(rawBody, sig, secret)
}

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stripe signature verification is mocked at the lib boundary — these tests
// assert the route's own branching (400 on bad signature, correct DB writes
// per event type, 500 on handler failure), not the Stripe SDK itself.
const mockConstructWebhookEvent = vi.fn()
vi.mock('../src/lib/stripe.js', () => ({
  constructWebhookEvent: (...args) => mockConstructWebhookEvent(...args),
}))

const { buildApp } = await import('../src/app.js')

function makeRedis() {
  const redis = {
    defineCommand(name) {
      redis[name] = (...args) => {
        const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null
        const result = [0, 60000]
        if (cb) return cb(null, result)
        return Promise.resolve(result)
      }
    },
    on: () => {},
    status: 'ready',
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  }
  return redis
}

function makeApp({ queryHandler } = {}) {
  const calls = []
  const sql = Object.assign(
    vi.fn(async (strings, ...values) => {
      const query = Array.isArray(strings) ? strings.join('') : String(strings ?? '')
      calls.push(query)
      if (queryHandler) {
        const result = await queryHandler(query, values)
        if (result !== undefined) return result
      }
      return []
    }),
    { json: v => v }
  )

  return { appPromise: buildApp({ sql, redis: makeRedis(), logger: false }), calls }
}

// signature: pass a string to send that stripe-signature header, or null to
// omit the header entirely. Defaulting to 'sig_test' via a destructured
// default wouldn't work here — `{ signature: undefined }` would still trigger
// the default, so omission is modeled with an explicit null sentinel instead.
function postWebhook(app, { body = '{}', signature = 'sig_test' } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (signature !== null) headers['stripe-signature'] = signature
  return app.inject({ method: 'POST', url: '/api/webhooks/stripe', headers, payload: body })
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    mockConstructWebhookEvent.mockReset()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('returns 400 when the stripe-signature header is missing', async () => {
    const { appPromise } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app, { signature: null })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatch(/Missing signature/)
    expect(mockConstructWebhookEvent).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 400 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const { appPromise } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app)
    expect(res.statusCode).toBe(400)
    expect(mockConstructWebhookEvent).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructWebhookEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })
    const { appPromise } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app, { signature: 'bad-sig' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatch(/Webhook verification failed/)
    await app.close()
  })

  it('marks seller onboarding done on account.updated when charges and payouts are both enabled', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'account.updated',
      data: { object: { id: 'acct_123', charges_enabled: true, payouts_enabled: true } },
    })
    const { appPromise, calls } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ received: true })
    expect(calls.some(q => q.includes('update seller_profiles') && q.includes('stripe_onboarding_done'))).toBe(true)
    await app.close()
  })

  it('does not touch the database on account.updated when onboarding is incomplete', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'account.updated',
      data: { object: { id: 'acct_123', charges_enabled: true, payouts_enabled: false } },
    })
    const { appPromise, calls } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app)
    expect(res.statusCode).toBe(200)
    expect(calls.some(q => q.includes('update seller_profiles'))).toBe(false)
    await app.close()
  })

  it('advances payment_status to AWAITING_SHIPMENT on checkout.session.completed', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { payment_intent: 'pi_123' } },
    })
    const { appPromise, calls } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app)
    expect(res.statusCode).toBe(200)
    expect(calls.some(q =>
      q.includes('update consignment_transactions') && q.includes("'AWAITING_SHIPMENT'")
    )).toBe(true)
    await app.close()
  })

  it('advances payment_status only from PENDING on payment_intent.succeeded', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } },
    })
    const { appPromise, calls } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app)
    expect(res.statusCode).toBe(200)
    expect(calls.some(q =>
      q.includes('update consignment_transactions') && q.includes("payment_status = 'PENDING'")
    )).toBe(true)
    await app.close()
  })

  it('acknowledges unhandled event types without writing to the database', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'customer.created',
      data: { object: {} },
    })
    const { appPromise, calls } = makeApp()
    const app = await appPromise
    const res = await postWebhook(app)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ received: true })
    // calls may include the app's own onReady challenge-cleanup query — assert
    // the webhook handler itself didn't write anything, not that sql was never called.
    expect(calls.some(q => q.includes('seller_profiles') || q.includes('consignment_transactions'))).toBe(false)
    await app.close()
  })

  it('returns 500 and does not crash the process when the DB write fails', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { payment_intent: 'pi_123' } },
    })
    const { appPromise } = makeApp({
      queryHandler: () => {
        throw new Error('connection terminated')
      },
    })
    const app = await appPromise
    const res = await postWebhook(app)
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res.body).error).toMatch(/Internal error/)
    await app.close()
  })
})

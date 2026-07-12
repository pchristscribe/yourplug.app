import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the shared Supabase client so authenticated paths can be exercised:
// a Bearer token of "valid-token" resolves to BUYER_UUID, anything else 401s.
const mockGetUser = vi.fn(async (token) => {
  if (token === 'valid-token') {
    return { data: { user: { id: '00000000-0000-0000-0000-000000000002' } }, error: null }
  }
  return { data: { user: null }, error: new Error('invalid token') }
})
vi.mock('../src/lib/supabase.js', () => ({
  getSupabase: () => ({ auth: { getUser: mockGetUser } }),
}))

// Stripe is mocked at the lib boundary — these tests assert the route calls
// createCheckoutSession with the right idempotency-relevant shape and reacts
// correctly to its result, not that Stripe itself works.
const mockCreateCheckoutSession = vi.fn()
vi.mock('../src/lib/stripe.js', () => ({
  createCheckoutSession: (...args) => mockCreateCheckoutSession(...args),
}))

const { buildApp } = await import('../src/app.js')

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const BUYER_UUID = '00000000-0000-0000-0000-000000000002'
const SELLER_UUID = '00000000-0000-0000-0000-000000000003'
const OFFER_UUID = '00000000-0000-0000-0000-000000000004'

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

function makeApp(sqlOverrides = {}) {
  const { queryHandler, ...rest } = sqlOverrides
  const sql = Object.assign(
    vi.fn(async (strings, ...values) => {
      const query = Array.isArray(strings) ? strings.join('') : String(strings ?? '')
      if (queryHandler) {
        const result = await queryHandler(query, values)
        if (result !== undefined) return result
      }
      if (query.includes('count(*)')) return [{ count: '0' }]
      return []
    }),
    {
      json: v => v,
      ...rest,
    }
  )

  return buildApp({
    sql,
    redis: makeRedis(),
    logger: false,
  })
}

const AUTH = { authorization: 'Bearer valid-token' }

describe('GET /api/consignment/offers', () => {
  it('returns 401 without Authorization header', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/offers' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns the authenticated buyer\'s offers', async () => {
    const row = {
      id: OFFER_UUID,
      listingId: VALID_UUID,
      buyerId: BUYER_UUID,
      amount: '20.00',
      status: 'PENDING',
      listingTitle: 'Rainbow harness',
      listingAskingPrice: '25.00',
      listingPrimaryImage: null,
    }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers')) return [row]
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/offers', headers: AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(OFFER_UUID)
    await app.close()
  })
})

describe('POST /api/consignment/offers/listings/:id/offers', () => {
  it('returns 400 for a non-UUID listing id', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/offers/listings/not-a-uuid/offers',
      headers: AUTH,
      payload: { amount: 10 },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 when the listing does not exist or is not approved', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_listings where id')) return []
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/consignment/offers/listings/${VALID_UUID}/offers`,
      headers: AUTH,
      payload: { amount: 10 },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 422 when the buyer is the listing owner', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_listings where id')) {
          return [{ id: VALID_UUID, status: 'APPROVED', sellerId: BUYER_UUID }]
        }
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/consignment/offers/listings/${VALID_UUID}/offers`,
      headers: AUTH,
      payload: { amount: 10 },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).error).toMatch(/own listing/)
    await app.close()
  })

  it('returns 422 when the buyer already has a pending offer on the listing', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_listings where id')) {
          return [{ id: VALID_UUID, status: 'APPROVED', sellerId: SELLER_UUID }]
        }
        if (query.includes('from consignment_offers') && query.includes("status = 'PENDING'")) {
          return [{ id: OFFER_UUID }]
        }
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/consignment/offers/listings/${VALID_UUID}/offers`,
      headers: AUTH,
      payload: { amount: 10 },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).error).toMatch(/already have a pending offer/)
    await app.close()
  })

  it('creates an offer and returns 201', async () => {
    const created = { id: OFFER_UUID, listingId: VALID_UUID, buyerId: BUYER_UUID, amount: '10.00', status: 'PENDING' }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_listings where id')) {
          return [{ id: VALID_UUID, status: 'APPROVED', sellerId: SELLER_UUID }]
        }
        if (query.includes('from consignment_offers') && query.includes("status = 'PENDING'")) {
          return []
        }
        if (query.includes('insert into consignment_offers')) return [created]
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/consignment/offers/listings/${VALID_UUID}/offers`,
      headers: AUTH,
      payload: { amount: 10 },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).id).toBe(OFFER_UUID)
    await app.close()
  })
})

describe('DELETE /api/consignment/offers/:id', () => {
  it('returns 404 when the offer does not belong to the caller', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers where id')) {
          return [{ id: OFFER_UUID, status: 'PENDING', buyerId: SELLER_UUID }]
        }
        return undefined
      },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/consignment/offers/${OFFER_UUID}`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 422 when the offer is not PENDING', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers where id')) {
          return [{ id: OFFER_UUID, status: 'ACCEPTED', buyerId: BUYER_UUID }]
        }
        return undefined
      },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/consignment/offers/${OFFER_UUID}`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('withdraws a pending offer and returns 204', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers where id')) {
          return [{ id: OFFER_UUID, status: 'PENDING', buyerId: BUYER_UUID }]
        }
        return undefined
      },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/consignment/offers/${OFFER_UUID}`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(204)
    await app.close()
  })
})

describe('POST /api/consignment/offers/transactions', () => {
  beforeEach(() => {
    mockCreateCheckoutSession.mockReset()
  })

  it('returns 404 when there is no matching accepted offer', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o') && query.includes("o.status = 'ACCEPTED'")) return []
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/offers/transactions',
      headers: AUTH,
      payload: { offerId: OFFER_UUID },
    })
    expect(res.statusCode).toBe(404)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 422 when the seller has not completed Stripe onboarding', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o') && query.includes("o.status = 'ACCEPTED'")) {
          return [{ id: OFFER_UUID, listingId: VALID_UUID, title: 'Rainbow harness', platformFeePct: '0.15', amount: '20.00' }]
        }
        if (query.includes('from seller_profiles')) {
          return [{ stripeAccountId: null, stripeOnboardingDone: false }]
        }
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/offers/transactions',
      headers: AUTH,
      payload: { offerId: OFFER_UUID },
    })
    expect(res.statusCode).toBe(422)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 422 without calling Stripe again when the offer is already paid (idempotency guard)', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o') && query.includes("o.status = 'ACCEPTED'")) {
          return [{ id: OFFER_UUID, listingId: VALID_UUID, title: 'Rainbow harness', platformFeePct: '0.15', amount: '20.00' }]
        }
        if (query.includes('from seller_profiles')) {
          return [{ stripeAccountId: 'acct_123', stripeOnboardingDone: true }]
        }
        if (query.includes('from consignment_transactions where offer_id')) {
          return [{ id: 'txn_1', paymentStatus: 'PAID' }]
        }
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/offers/transactions',
      headers: AUTH,
      payload: { offerId: OFFER_UUID },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).error).toMatch(/already been paid/)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    await app.close()
  })

  it('creates a checkout session and upserts the transaction on first call', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session123',
      payment_intent: 'pi_123',
    })
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o') && query.includes("o.status = 'ACCEPTED'")) {
          return [{ id: OFFER_UUID, listingId: VALID_UUID, title: 'Rainbow harness', platformFeePct: '0.15', amount: '20.00' }]
        }
        if (query.includes('from seller_profiles')) {
          return [{ stripeAccountId: 'acct_123', stripeOnboardingDone: true }]
        }
        if (query.includes('from consignment_transactions where offer_id')) return []
        if (query.includes('from auth.users')) return [{ email: 'buyer@example.test' }]
        if (query.includes('insert into consignment_transactions')) return []
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/offers/transactions',
      headers: AUTH,
      payload: { offerId: OFFER_UUID },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).checkoutUrl).toBe('https://checkout.stripe.com/session123')
    expect(mockCreateCheckoutSession).toHaveBeenCalledTimes(1)
    const call = mockCreateCheckoutSession.mock.calls[0][0]
    expect(call.offer.id).toBe(OFFER_UUID)
    expect(call.sellerStripeAccountId).toBe('acct_123')
    await app.close()
  })

  it('allows a retry when the existing transaction is still PENDING (does not block on it)', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session123',
      payment_intent: 'pi_123',
    })
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o') && query.includes("o.status = 'ACCEPTED'")) {
          return [{ id: OFFER_UUID, listingId: VALID_UUID, title: 'Rainbow harness', platformFeePct: '0.15', amount: '20.00' }]
        }
        if (query.includes('from seller_profiles')) {
          return [{ stripeAccountId: 'acct_123', stripeOnboardingDone: true }]
        }
        if (query.includes('from consignment_transactions where offer_id')) {
          return [{ id: 'txn_1', paymentStatus: 'PENDING' }]
        }
        if (query.includes('from auth.users')) return [{ email: 'buyer@example.test' }]
        if (query.includes('insert into consignment_transactions')) return []
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/offers/transactions',
      headers: AUTH,
      payload: { offerId: OFFER_UUID },
    })
    expect(res.statusCode).toBe(200)
    expect(mockCreateCheckoutSession).toHaveBeenCalledTimes(1)
    await app.close()
  })
})

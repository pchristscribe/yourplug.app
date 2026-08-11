import { describe, it, expect, vi, beforeEach } from 'vitest'

const SELLER_UUID = '00000000-0000-0000-0000-000000000002'
const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const AUTH = { authorization: 'Bearer valid-token' }

// Bearer "valid-token" resolves to SELLER_UUID; anything else is unauthorized.
const mockGetUser = vi.fn(async (token) => {
  if (token === 'valid-token') {
    return { data: { user: { id: SELLER_UUID } }, error: null }
  }
  return { data: { user: null }, error: new Error('invalid token') }
})
vi.mock('../src/lib/supabase.js', () => ({
  getSupabase: () => ({ auth: { getUser: mockGetUser } }),
}))

// External side-effecting libs are stubbed so seller routes never touch the network.
const mockGetSignedUrl = vi.fn(async () => 'https://signed.example/img')
const mockDeleteImage = vi.fn(async () => {})
const mockUploadImage = vi.fn(async () => ({ storagePath: 'path/img.jpg' }))
vi.mock('../src/lib/imageStorage.js', () => ({
  uploadImage: (...a) => mockUploadImage(...a),
  deleteImage: (...a) => mockDeleteImage(...a),
  getSignedUrl: (...a) => mockGetSignedUrl(...a),
}))

const mockCreateConnectedAccount = vi.fn(async () => ({ id: 'acct_123' }))
const mockCreateOnboardingLink = vi.fn(async () => ({ url: 'https://stripe.example/onboard' }))
vi.mock('../src/lib/stripe.js', () => ({
  createConnectedAccount: (...a) => mockCreateConnectedAccount(...a),
  createOnboardingLink: (...a) => mockCreateOnboardingLink(...a),
}))

const mockRunFullModeration = vi.fn(async () => {})
const mockModerateImage = vi.fn(async () => {})
vi.mock('../src/lib/moderation.js', () => ({
  runFullModeration: (...a) => mockRunFullModeration(...a),
  moderateImage: (...a) => mockModerateImage(...a),
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
  const sql = Object.assign(
    vi.fn(async (strings, ...values) => {
      const query = Array.isArray(strings) ? strings.join('') : String(strings ?? '')
      if (queryHandler) {
        const result = await queryHandler(query, values)
        if (result !== undefined) return result
      }
      if (query.includes('count(')) return [{ count: '0' }]
      return []
    }),
    { json: v => v }
  )
  // sql.begin(fn) runs the callback with a tx that behaves like sql.
  sql.begin = vi.fn(async (fn) => fn(sql))
  return buildApp({ sql, redis: makeRedis(), logger: false })
}

beforeEach(() => {
  mockGetUser.mockClear()
  mockRunFullModeration.mockClear()
  mockCreateConnectedAccount.mockClear()
})

describe('auth guard', () => {
  it('returns 401 without a bearer token', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 401 for an invalid bearer token', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: { authorization: 'Bearer nope' } })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('returns 503 when the auth lookup throws', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('supabase down'))
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    expect(res.statusCode).toBe(503)
    await app.close()
  })
})

describe('GET /api/consignment/seller/listings', () => {
  it('returns the seller listings with signed image URLs', async () => {
    const listing = { id: VALID_UUID, title: 'Harness', images: [{ id: 'img1', storagePath: 'p/1.jpg' }] }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_listings')) return [listing]
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body[0].images[0].publicUrl).toBe('https://signed.example/img')
    expect(mockGetSignedUrl).toHaveBeenCalled()
    await app.close()
  })

  it('leaves publicUrl null for an image without a storage path', async () => {
    const listing = { id: VALID_UUID, title: 'Harness', images: [{ id: 'img1', storagePath: null }] }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_listings')) return [listing]
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)[0].images[0].publicUrl).toBeNull()
    await app.close()
  })

  it('returns an empty array when the seller has no listings', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_listings')) return []
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
    await app.close()
  })
})

describe('POST /api/consignment/seller/listings', () => {
  it('creates a listing (201)', async () => {
    const created = { id: VALID_UUID, title: 'Test', status: 'DRAFT' }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('insert into consignment_listings')) return [created]
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/seller/listings',
      headers: AUTH,
      payload: { title: 'Test', condition: 'NEW', category: 'APPAREL', askingPrice: 25 },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).id).toBe(VALID_UUID)
    await app.close()
  })

  it('rejects an invalid payload (400)', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/seller/listings',
      headers: AUTH,
      payload: { title: '', condition: 'BOGUS', category: 'APPAREL', askingPrice: 25 },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('PATCH /api/consignment/seller/listings/:id', () => {
  it('returns 400 for a non-UUID id', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/consignment/seller/listings/not-a-uuid', headers: AUTH, payload: { title: 'X' } })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 when the listing belongs to another seller', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('select id, status, seller_id')) return [{ id: VALID_UUID, status: 'DRAFT', sellerId: 'someone-else' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'PATCH', url: `/api/consignment/seller/listings/${VALID_UUID}`, headers: AUTH, payload: { title: 'X' } })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 422 when the listing is not DRAFT/REJECTED', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('select id, status, seller_id')) return [{ id: VALID_UUID, status: 'APPROVED', sellerId: SELLER_UUID }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'PATCH', url: `/api/consignment/seller/listings/${VALID_UUID}`, headers: AUTH, payload: { title: 'X' } })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('updates an editable listing', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('select id, status, seller_id')) return [{ id: VALID_UUID, status: 'DRAFT', sellerId: SELLER_UUID }]
        if (query.includes('update consignment_listings')) return [{ id: VALID_UUID, title: 'Updated' }]
        return undefined
      },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/consignment/seller/listings/${VALID_UUID}`,
      headers: AUTH,
      payload: { title: 'Updated', description: 'new', condition: 'GOOD', category: 'TOY', askingPrice: 30 },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).title).toBe('Updated')
    await app.close()
  })
})

describe('DELETE /api/consignment/seller/listings/:id', () => {
  it('returns 422 for a non-editable listing', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('select id, status, seller_id')) return [{ id: VALID_UUID, status: 'SOLD', sellerId: SELLER_UUID }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'DELETE', url: `/api/consignment/seller/listings/${VALID_UUID}`, headers: AUTH })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('deletes an editable listing and its images (204)', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('select id, status, seller_id')) return [{ id: VALID_UUID, status: 'DRAFT', sellerId: SELLER_UUID }]
        if (query.includes('select storage_path from consignment_images')) return [{ storagePath: 'p/1.jpg' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'DELETE', url: `/api/consignment/seller/listings/${VALID_UUID}`, headers: AUTH })
    expect(res.statusCode).toBe(204)
    expect(mockDeleteImage).toHaveBeenCalledWith('p/1.jpg')
    await app.close()
  })
})

describe('DELETE /api/consignment/seller/images/:imageId', () => {
  it('returns 400 for a non-UUID image id', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/consignment/seller/images/not-a-uuid', headers: AUTH })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 for an image owned by another seller', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_images ci')) return [{ id: VALID_UUID, storagePath: 'p.jpg', listingId: VALID_UUID, isPrimary: false, sellerId: 'other' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'DELETE', url: `/api/consignment/seller/images/${VALID_UUID}`, headers: AUTH })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('deletes a non-primary image (204, no promotion)', async () => {
    let promoted = false
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_images ci')) return [{ id: VALID_UUID, storagePath: 'p.jpg', listingId: VALID_UUID, isPrimary: false, sellerId: SELLER_UUID }]
        if (query.includes('set is_primary = true')) { promoted = true; return [] }
        return undefined
      },
    })
    const res = await app.inject({ method: 'DELETE', url: `/api/consignment/seller/images/${VALID_UUID}`, headers: AUTH })
    expect(res.statusCode).toBe(204)
    expect(promoted).toBe(false)
    await app.close()
  })

  it('deletes a primary image and promotes the next one (204)', async () => {
    let promoted = false
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_images ci')) return [{ id: VALID_UUID, storagePath: 'p.jpg', listingId: VALID_UUID, isPrimary: true, sellerId: SELLER_UUID }]
        if (query.includes('set is_primary = true')) { promoted = true; return [] }
        return undefined
      },
    })
    const res = await app.inject({ method: 'DELETE', url: `/api/consignment/seller/images/${VALID_UUID}`, headers: AUTH })
    expect(res.statusCode).toBe(204)
    expect(promoted).toBe(true)
    await app.close()
  })
})

describe('POST /api/consignment/seller/listings/:id/submit', () => {
  it('returns 422 when there are no images', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('select id, status, seller_id')) return [{ id: VALID_UUID, status: 'DRAFT', sellerId: SELLER_UUID }]
        if (query.includes('count(*) from consignment_images')) return [{ count: '0' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'POST', url: `/api/consignment/seller/listings/${VALID_UUID}/submit`, headers: AUTH })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('submits for moderation when an image exists', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('select id, status, seller_id')) return [{ id: VALID_UUID, status: 'DRAFT', sellerId: SELLER_UUID }]
        if (query.includes('count(*) from consignment_images')) return [{ count: '1' }]
        if (query.includes("set status = 'PENDING_MODERATION'")) return [{ id: VALID_UUID }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'POST', url: `/api/consignment/seller/listings/${VALID_UUID}/submit`, headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).message).toMatch(/moderation/i)
    expect(mockRunFullModeration).toHaveBeenCalled()
    await app.close()
  })
})

describe('Stripe Connect', () => {
  it('creates an account and returns an onboarding URL when no profile exists', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from seller_profiles')) return []
        if (query.includes('from auth.users')) return [{ email: 'seller@example.com' }]
        if (query.includes('insert into seller_profiles')) return [{ id: SELLER_UUID, stripeAccountId: 'acct_123', stripeOnboardingDone: false }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'POST', url: '/api/consignment/seller/stripe/onboard', headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).url).toBe('https://stripe.example/onboard')
    expect(mockCreateConnectedAccount).toHaveBeenCalled()
    await app.close()
  })

  it('short-circuits when onboarding is already complete', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from seller_profiles')) return [{ id: SELLER_UUID, stripeAccountId: 'acct_1', stripeOnboardingDone: true }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'POST', url: '/api/consignment/seller/stripe/onboard', headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).alreadyOnboarded).toBe(true)
    await app.close()
  })

  it('reports stripe status', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from seller_profiles')) return [{ stripeOnboardingDone: true, stripeAccountId: 'acct_1' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/stripe/status', headers: AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.onboarded).toBe(true)
    expect(body.hasAccount).toBe(true)
    await app.close()
  })
})

describe('PATCH /api/consignment/seller/offers/:id', () => {
  it('returns 404 for an offer on another seller listing', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o')) return [{ id: VALID_UUID, status: 'PENDING', sellerId: 'other' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'PATCH', url: `/api/consignment/seller/offers/${VALID_UUID}`, headers: AUTH, payload: { action: 'ACCEPTED' } })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 422 for a non-PENDING offer', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o')) return [{ id: VALID_UUID, status: 'REJECTED', sellerId: SELLER_UUID }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'PATCH', url: `/api/consignment/seller/offers/${VALID_UUID}`, headers: AUTH, payload: { action: 'ACCEPTED' } })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('returns 422 when accepting an expired offer', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o')) return [{ id: VALID_UUID, status: 'PENDING', sellerId: SELLER_UUID, listingId: VALID_UUID, expiresAt: '2000-01-01T00:00:00Z' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'PATCH', url: `/api/consignment/seller/offers/${VALID_UUID}`, headers: AUTH, payload: { action: 'ACCEPTED' } })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('accepts a valid offer and rejects siblings', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o')) return [{ id: VALID_UUID, status: 'PENDING', sellerId: SELLER_UUID, listingId: VALID_UUID, expiresAt: '2999-01-01T00:00:00Z' }]
        if (query.includes('update consignment_offers') && query.includes('returning')) return [{ id: VALID_UUID, status: 'ACCEPTED' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'PATCH', url: `/api/consignment/seller/offers/${VALID_UUID}`, headers: AUTH, payload: { action: 'ACCEPTED' } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('ACCEPTED')
    await app.close()
  })

  it('rejects an offer', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from consignment_offers o')) return [{ id: VALID_UUID, status: 'PENDING', sellerId: SELLER_UUID, listingId: VALID_UUID, expiresAt: '2999-01-01T00:00:00Z' }]
        if (query.includes('update consignment_offers') && query.includes('returning')) return [{ id: VALID_UUID, status: 'REJECTED' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'PATCH', url: `/api/consignment/seller/offers/${VALID_UUID}`, headers: AUTH, payload: { action: 'REJECTED' } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('REJECTED')
    await app.close()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const SELLER_UUID = '00000000-0000-0000-0000-000000000002'
const OTHER_UUID = '00000000-0000-0000-0000-000000000009'
const LISTING_ID = '00000000-0000-0000-0000-000000000001'
const IMAGE_ID = '00000000-0000-0000-0000-000000000003'
const OFFER_ID = '00000000-0000-0000-0000-000000000004'

const AUTH = { authorization: 'Bearer valid-token' }

// Bearer "valid-token" resolves to SELLER_UUID; anything else 401s.
const mockGetUser = vi.fn(async (token) => {
  if (token === 'valid-token') {
    return { data: { user: { id: SELLER_UUID } }, error: null }
  }
  return { data: { user: null }, error: new Error('invalid token') }
})
vi.mock('../src/lib/supabase.js', () => ({
  getSupabase: () => ({ auth: { getUser: mockGetUser } }),
}))

// External side-effecting collaborators are stubbed so the route logic is
// what's under test, not Supabase storage / Stripe / the moderation pipeline.
const uploadImage = vi.fn(async () => ({ storagePath: 'listings/x.jpg' }))
const deleteImage = vi.fn(async () => {})
const getSignedUrl = vi.fn(async (p) => `https://signed/${p}`)
vi.mock('../src/lib/imageStorage.js', () => ({
  uploadImage: (...a) => uploadImage(...a),
  deleteImage: (...a) => deleteImage(...a),
  getSignedUrl: (...a) => getSignedUrl(...a),
}))

const createConnectedAccount = vi.fn(async () => ({ id: 'acct_123' }))
const createOnboardingLink = vi.fn(async () => ({ url: 'https://stripe/onboard' }))
vi.mock('../src/lib/stripe.js', () => ({
  createConnectedAccount: (...a) => createConnectedAccount(...a),
  createOnboardingLink: (...a) => createOnboardingLink(...a),
}))

const moderateImage = vi.fn(async () => {})
const runFullModeration = vi.fn(async () => {})
vi.mock('../src/lib/moderation.js', () => ({
  moderateImage: (...a) => moderateImage(...a),
  runFullModeration: (...a) => runFullModeration(...a),
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

// queryHandler(query, values) returns a result set for matching queries;
// returning undefined falls through to the defaults below.
function makeApp(queryHandler) {
  const run = async (strings, ...values) => {
    const query = Array.isArray(strings) ? strings.join('') : String(strings ?? '')
    if (queryHandler) {
      const result = await queryHandler(query, values)
      if (result !== undefined) return result
    }
    if (query.includes('count(*)')) return [{ count: '0' }]
    return []
  }

  const sql = Object.assign(vi.fn(run), {
    json: v => v,
    // sql.begin hands the callback a tagged-template tx backed by the same
    // handler, so transactional routes exercise their real query paths.
    begin: vi.fn(async (fn) => fn(Object.assign(vi.fn(run), { json: v => v }))),
  })

  return buildApp({ sql, redis: makeRedis(), logger: false })
}

const listingRow = (over = {}) => ({
  id: LISTING_ID, status: 'DRAFT', sellerId: SELLER_UUID, title: 't', category: 'HARNESS', ...over,
})

function multipart(filename, contentType, body = 'binary-bytes') {
  const boundary = '----testboundary'
  const payload =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n` +
    `${body}\r\n` +
    `--${boundary}--\r\n`
  return { payload, headers: { ...AUTH, 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

beforeEach(() => {
  vi.clearAllMocks()
  uploadImage.mockResolvedValue({ storagePath: 'listings/x.jpg' })
  getSignedUrl.mockImplementation(async (p) => `https://signed/${p}`)
  createConnectedAccount.mockResolvedValue({ id: 'acct_123' })
  createOnboardingLink.mockResolvedValue({ url: 'https://stripe/onboard' })
})

describe('seller routes — authentication', () => {
  it('rejects requests with no Authorization header', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects a non-Bearer Authorization header', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'GET', url: '/api/consignment/seller/listings',
      headers: { authorization: 'Basic abc' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects an invalid bearer token', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'GET', url: '/api/consignment/seller/listings',
      headers: { authorization: 'Bearer nope' },
    })
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
  it('returns the seller listings', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_listings l')) return [{ ...listingRow(), images: [] }]
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toHaveLength(1)
    await app.close()
  })

  it('signs the storage path of each attached image', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_listings l')) {
        return [{ ...listingRow(), images: [{ id: IMAGE_ID, storagePath: 'listings/a.jpg' }] }]
      }
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    const [listing] = JSON.parse(res.body)
    expect(listing.images[0].publicUrl).toBe('https://signed/listings/a.jpg')
    await app.close()
  })

  it('leaves publicUrl null when an image has no storage path', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_listings l')) {
        return [{ ...listingRow(), images: [{ id: IMAGE_ID, storagePath: null }] }]
      }
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    expect(JSON.parse(res.body)[0].images[0].publicUrl).toBeNull()
    await app.close()
  })

  it('tolerates a listing whose images aggregate is null', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_listings l')) return [{ ...listingRow(), images: null }]
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/seller/listings', headers: AUTH })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('POST /api/consignment/seller/listings', () => {
  const valid = { title: 'Harness', condition: 'LIKE_NEW', category: 'HARNESS', askingPrice: 45 }

  it('creates a listing and returns 201', async () => {
    const app = await makeApp((q) => {
      if (q.includes('insert into consignment_listings')) return [listingRow()]
    })
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/listings', headers: AUTH, payload: valid,
    })
    expect(res.statusCode).toBe(201)
    await app.close()
  })

  it('rejects a payload missing required fields', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/listings', headers: AUTH, payload: { title: 'x' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('rejects an unknown condition enum', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/listings', headers: AUTH,
      payload: { ...valid, condition: 'MYSTERY' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('PATCH /api/consignment/seller/listings/:id', () => {
  it('rejects a non-UUID id', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'PATCH', url: '/api/consignment/seller/listings/not-a-uuid', headers: AUTH,
      payload: { title: 'new' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 when the listing does not exist', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
      payload: { title: 'new' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 404 when the listing belongs to another seller', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow({ sellerId: OTHER_UUID })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
      payload: { title: 'new' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('refuses to edit a listing that is not DRAFT or REJECTED', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow({ status: 'APPROVED' })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
      payload: { title: 'new' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('allows editing a REJECTED listing', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow({ status: 'REJECTED' })]
      if (q.includes('update consignment_listings')) return [listingRow({ title: 'new' })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
      payload: { title: 'new' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('updates every supported field', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow()]
      if (q.includes('update consignment_listings')) return [listingRow()]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
      payload: { title: 'a', description: 'b', condition: 'NEW', category: 'TOY', askingPrice: 9.99 },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('DELETE /api/consignment/seller/listings/:id', () => {
  it('rejects a non-UUID id', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'DELETE', url: '/api/consignment/seller/listings/nope', headers: AUTH,
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 for another seller’s listing', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow({ sellerId: OTHER_UUID })]
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('refuses to delete a listing that is not DRAFT or REJECTED', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow({ status: 'SOLD' })]
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('deletes the listing and its stored images', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow()]
      if (q.includes('select storage_path')) return [{ storagePath: 'listings/a.jpg' }]
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
    })
    expect(res.statusCode).toBe(204)
    expect(deleteImage).toHaveBeenCalledWith('listings/a.jpg')
    await app.close()
  })

  it('still deletes the listing when storage removal fails', async () => {
    deleteImage.mockRejectedValueOnce(new Error('storage down'))
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow()]
      if (q.includes('select storage_path')) return [{ storagePath: 'listings/a.jpg' }]
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/consignment/seller/listings/${LISTING_ID}`, headers: AUTH,
    })
    expect(res.statusCode).toBe(204)
    await app.close()
  })
})

describe('POST /api/consignment/seller/listings/:id/submit', () => {
  it('rejects a non-UUID id', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/listings/xyz/submit', headers: AUTH,
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 when the listing is not the caller’s', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow({ sellerId: OTHER_UUID })]
    })
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/submit`, headers: AUTH,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('refuses to submit from a non-submittable state', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow({ status: 'PENDING_MODERATION' })]
    })
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/submit`, headers: AUTH,
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('requires at least one image', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow()]
      if (q.includes('count(*)')) return [{ count: '0' }]
    })
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/submit`, headers: AUTH,
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).error).toMatch(/at least one image/i)
    await app.close()
  })

  it('submits the listing and kicks off moderation', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow()]
      if (q.includes('count(*)')) return [{ count: '2' }]
      if (q.includes('update consignment_listings')) return [{ id: LISTING_ID }]
    })
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/submit`, headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(runFullModeration).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('returns 422 when the atomic status guard matches no row', async () => {
    // Models a concurrent second submit: the guarded UPDATE returns nothing.
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow()]
      if (q.includes('count(*)')) return [{ count: '1' }]
      if (q.includes('update consignment_listings')) return []
    })
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/submit`, headers: AUTH,
    })
    expect(res.statusCode).toBe(422)
    expect(runFullModeration).not.toHaveBeenCalled()
    await app.close()
  })

  it('does not fail the request when moderation rejects asynchronously', async () => {
    runFullModeration.mockRejectedValueOnce(new Error('moderation exploded'))
    const app = await makeApp((q) => {
      if (q.includes('select id, status, seller_id')) return [listingRow()]
      if (q.includes('count(*)')) return [{ count: '1' }]
      if (q.includes('update consignment_listings')) return [{ id: LISTING_ID }]
    })
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/submit`, headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('POST /api/consignment/seller/listings/:id/images', () => {
  it('rejects a non-UUID listing id', async () => {
    const app = await makeApp()
    const mp = multipart('a.jpg', 'image/jpeg')
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/listings/bad/images', ...mp,
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 when the listing is not the caller’s', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, title, category, seller_id')) return [listingRow({ sellerId: OTHER_UUID })]
    })
    const mp = multipart('a.jpg', 'image/jpeg')
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/images`, ...mp,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('rejects a disallowed mime type', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, title, category, seller_id')) return [listingRow()]
    })
    const mp = multipart('doc.pdf', 'application/pdf')
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/images`, ...mp,
    })
    expect(res.statusCode).toBe(422)
    expect(uploadImage).not.toHaveBeenCalled()
    await app.close()
  })

  it('stores an accepted image and returns 201', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, title, category, seller_id')) return [listingRow()]
      if (q.includes('count(*)')) return [{ count: '0' }]
      if (q.includes('insert into consignment_images')) return [{ id: IMAGE_ID, isPrimary: true }]
    })
    const mp = multipart('a.jpg', 'image/jpeg')
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/images`, ...mp,
    })
    expect(res.statusCode).toBe(201)
    expect(uploadImage).toHaveBeenCalledTimes(1)
    expect(moderateImage).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('returns 400 when no file part is present', async () => {
    const app = await makeApp((q) => {
      if (q.includes('select id, title, category, seller_id')) return [listingRow()]
    })
    const boundary = '----testboundary'
    const res = await app.inject({
      method: 'POST', url: `/api/consignment/seller/listings/${LISTING_ID}/images`,
      headers: { ...AUTH, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}--\r\n`,
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('DELETE /api/consignment/seller/images/:imageId', () => {
  it('rejects a non-UUID image id', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'DELETE', url: '/api/consignment/seller/images/bad', headers: AUTH,
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 when the image belongs to another seller', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_images ci')) {
        return [{ id: IMAGE_ID, sellerId: OTHER_UUID, storagePath: 'p', listingId: LISTING_ID }]
      }
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/consignment/seller/images/${IMAGE_ID}`, headers: AUTH,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('deletes a non-primary image without promoting another', async () => {
    const queries = []
    const app = await makeApp((q) => {
      queries.push(q)
      if (q.includes('from consignment_images ci')) {
        return [{ id: IMAGE_ID, sellerId: SELLER_UUID, storagePath: 'p', listingId: LISTING_ID, isPrimary: false }]
      }
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/consignment/seller/images/${IMAGE_ID}`, headers: AUTH,
    })
    expect(res.statusCode).toBe(204)
    expect(queries.some(q => q.includes('set is_primary = true'))).toBe(false)
    await app.close()
  })

  it('promotes the next image when the deleted one was primary', async () => {
    const queries = []
    const app = await makeApp((q) => {
      queries.push(q)
      if (q.includes('from consignment_images ci')) {
        return [{ id: IMAGE_ID, sellerId: SELLER_UUID, storagePath: 'p', listingId: LISTING_ID, isPrimary: true }]
      }
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/consignment/seller/images/${IMAGE_ID}`, headers: AUTH,
    })
    expect(res.statusCode).toBe(204)
    expect(queries.some(q => q.includes('set is_primary = true'))).toBe(true)
    await app.close()
  })
})

describe('POST /api/consignment/seller/stripe/onboard', () => {
  it('creates a connected account when the seller has no profile', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from seller_profiles')) return []
      if (q.includes('from auth.users')) return [{ email: 'seller@example.com' }]
      if (q.includes('insert into seller_profiles')) {
        return [{ id: SELLER_UUID, stripeAccountId: 'acct_123', stripeOnboardingDone: false }]
      }
    })
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/stripe/onboard', headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(createConnectedAccount).toHaveBeenCalledWith('seller@example.com', `connect-account:${SELLER_UUID}`)
    expect(JSON.parse(res.body).url).toBe('https://stripe/onboard')
    await app.close()
  })

  it('falls back to an empty email when the user row is missing', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from seller_profiles')) return []
      if (q.includes('from auth.users')) return []
      if (q.includes('insert into seller_profiles')) {
        return [{ id: SELLER_UUID, stripeAccountId: 'acct_123', stripeOnboardingDone: false }]
      }
    })
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/stripe/onboard', headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(createConnectedAccount).toHaveBeenCalledWith('', `connect-account:${SELLER_UUID}`)
    await app.close()
  })

  it('short-circuits when onboarding is already complete', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from seller_profiles')) {
        return [{ id: SELLER_UUID, stripeAccountId: 'acct_123', stripeOnboardingDone: true }]
      }
    })
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/stripe/onboard', headers: AUTH,
    })
    expect(JSON.parse(res.body)).toEqual({ alreadyOnboarded: true })
    expect(createOnboardingLink).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns an onboarding link for an existing, incomplete profile', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from seller_profiles')) {
        return [{ id: SELLER_UUID, stripeAccountId: 'acct_9', stripeOnboardingDone: false }]
      }
    })
    const res = await app.inject({
      method: 'POST', url: '/api/consignment/seller/stripe/onboard', headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(createOnboardingLink).toHaveBeenCalledWith(
      'acct_9',
      expect.stringContaining('/account/stripe?onboard=success'),
      expect.stringContaining('/account/stripe?onboard=refresh')
    )
    await app.close()
  })
})

describe('GET /api/consignment/seller/stripe/status', () => {
  it('reports the onboarded status from the profile', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from seller_profiles')) {
        return [{ stripeOnboardingDone: true, stripeAccountId: 'acct_1' }]
      }
    })
    const res = await app.inject({
      method: 'GET', url: '/api/consignment/seller/stripe/status', headers: AUTH,
    })
    expect(JSON.parse(res.body)).toEqual({ onboarded: true, hasAccount: true })
    await app.close()
  })

  it('defaults to not-onboarded when there is no profile', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from seller_profiles')) return []
    })
    const res = await app.inject({
      method: 'GET', url: '/api/consignment/seller/stripe/status', headers: AUTH,
    })
    expect(JSON.parse(res.body)).toEqual({ onboarded: false, hasAccount: false })
    await app.close()
  })
})

describe('PATCH /api/consignment/seller/offers/:id', () => {
  const future = new Date(Date.now() + 3600_000).toISOString()
  const past = new Date(Date.now() - 3600_000).toISOString()
  const offerRow = (over = {}) => ({
    id: OFFER_ID, status: 'PENDING', listingId: LISTING_ID, expiresAt: future, sellerId: SELLER_UUID, ...over,
  })

  it('returns 404 when the offer is on another seller’s listing', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_offers o')) return [offerRow({ sellerId: OTHER_UUID })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/offers/${OFFER_ID}`, headers: AUTH,
      payload: { action: 'ACCEPTED' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('refuses to act on an offer that is not PENDING', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_offers o')) return [offerRow({ status: 'REJECTED' })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/offers/${OFFER_ID}`, headers: AUTH,
      payload: { action: 'ACCEPTED' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('refuses to accept an expired offer', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_offers o')) return [offerRow({ expiresAt: past })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/offers/${OFFER_ID}`, headers: AUTH,
      payload: { action: 'ACCEPTED' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).error).toMatch(/expired/i)
    await app.close()
  })

  it('still allows rejecting an expired offer', async () => {
    const app = await makeApp((q) => {
      if (q.includes('from consignment_offers o')) return [offerRow({ expiresAt: past })]
      if (q.includes('update consignment_offers')) return [offerRow({ status: 'REJECTED' })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/offers/${OFFER_ID}`, headers: AUTH,
      payload: { action: 'REJECTED' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('accepts an offer and rejects the sibling offers in one transaction', async () => {
    const queries = []
    const app = await makeApp((q) => {
      queries.push(q)
      if (q.includes('from consignment_offers o')) return [offerRow()]
      if (q.includes('update consignment_offers')) return [offerRow({ status: 'ACCEPTED' })]
    })
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/offers/${OFFER_ID}`, headers: AUTH,
      payload: { action: 'ACCEPTED' },
    })
    expect(res.statusCode).toBe(200)
    // the sibling-rejection statement must run inside the same transaction
    expect(queries.some(q => q.includes("status = 'REJECTED'") && q.includes('id !='))).toBe(true)
    await app.close()
  })

  it('does not touch sibling offers when rejecting', async () => {
    const queries = []
    const app = await makeApp((q) => {
      queries.push(q)
      if (q.includes('from consignment_offers o')) return [offerRow()]
      if (q.includes('update consignment_offers')) return [offerRow({ status: 'REJECTED' })]
    })
    await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/offers/${OFFER_ID}`, headers: AUTH,
      payload: { action: 'REJECTED' },
    })
    expect(queries.some(q => q.includes('id !='))).toBe(false)
    await app.close()
  })

  it('rejects an unsupported action', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'PATCH', url: `/api/consignment/seller/offers/${OFFER_ID}`, headers: AUTH,
      payload: { action: 'MAYBE' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

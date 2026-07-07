import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the shared Supabase client so authenticated paths can be exercised:
// a Bearer token of "valid-token" resolves to SELLER_UUID, anything else 401s.
const mockGetUser = vi.fn(async (token) => {
  if (token === 'valid-token') {
    return { data: { user: { id: '00000000-0000-0000-0000-000000000002' } }, error: null }
  }
  return { data: { user: null }, error: new Error('invalid token') }
})
vi.mock('../src/lib/supabase.js', () => ({
  getSupabase: () => ({ auth: { getUser: mockGetUser } }),
}))

const { buildApp } = await import('../src/app.js')

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const SELLER_UUID = '00000000-0000-0000-0000-000000000002'

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
  // sqlOverrides.queryHandler(query, values) may return a result set to
  // stub specific queries; returning undefined falls through to defaults.
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

describe('GET /api/consignment/listings', () => {
  it('returns 200 with paginated data', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/listings' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('pagination')
    expect(Array.isArray(body.data)).toBe(true)
    await app.close()
  })

  it('returns 400 for invalid categoryId in query', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/listings?category=INVALID_CAT' })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('GET /api/consignment/listings/:id', () => {
  it('returns 400 for non-UUID id', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/consignment/listings/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 404 when listing not found', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: `/api/consignment/listings/${VALID_UUID}` })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('POST /api/consignment/seller/listings', () => {
  it('returns 401 without Authorization header', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/seller/listings',
      payload: { title: 'Test', condition: 'NEW', category: 'APPAREL', askingPrice: 10 },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('PATCH /api/consignment/seller/listings/:id', () => {
  it('returns 401 without auth', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/consignment/seller/listings/${VALID_UUID}`,
      payload: { title: 'Updated' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('authenticated success paths', () => {
  // Braces intentional: returning the mock from a hook makes vitest call it as teardown
  beforeEach(() => {
    mockGetUser.mockClear()
  })

  it('GET /api/consignment/listings returns mapped rows (queryHandler override)', async () => {
    const row = {
      id: VALID_UUID,
      title: 'Rainbow harness',
      condition: 'GOOD',
      category: 'HARNESS',
      asking_price: '25.00',
      created_at: '2026-07-01T00:00:00Z',
      seller_display_name: 'plugdaddy',
      primary_image_url: 'https://example.test/img.jpg',
    }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('count(*)')) return [{ count: '1' }]
        if (query.includes('from consignment_listings')) return [row]
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/listings' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    await app.close()
  })

  it('POST /api/consignment/seller/listings creates a listing with a valid token', async () => {
    const created = { id: VALID_UUID, sellerId: SELLER_UUID, title: 'Test', status: 'DRAFT' }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('insert into consignment_listings')) return [created]
        return undefined
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/seller/listings',
      headers: { authorization: 'Bearer valid-token' },
      payload: { title: 'Test', condition: 'NEW', category: 'APPAREL', askingPrice: 10 },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).id).toBe(VALID_UUID)
    expect(mockGetUser).toHaveBeenCalledWith('valid-token')
    await app.close()
  })

  it('rejects an invalid bearer token with 401', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/consignment/seller/listings',
      headers: { authorization: 'Bearer bogus' },
      payload: { title: 'Test', condition: 'NEW', category: 'APPAREL', askingPrice: 10 },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('server error handling', () => {
  it('GET /api/consignment/listings returns 500 when the database fails', async () => {
    const app = await makeApp({
      queryHandler: () => {
        throw new Error('connection refused')
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/consignment/listings' })
    expect(res.statusCode).toBe(500)
    await app.close()
  })
})

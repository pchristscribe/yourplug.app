import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'

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
  const sql = Object.assign(
    vi.fn(async (strings) => {
      const query = Array.isArray(strings) ? strings.join('') : String(strings ?? '')
      if (query.includes('count(*)')) return [{ count: '0' }]
      return []
    }),
    {
      json: v => v,
      ...sqlOverrides,
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

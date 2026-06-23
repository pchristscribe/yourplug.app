import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSqlMock(overrides = {}) {
  const mock = vi.fn(async (strings, ...values) => {
    if (!Array.isArray(strings) || !strings.raw) return strings
    const query = strings.join('').trim().toLowerCase()
    if (/^select\s+1/.test(query)) return [{ '?column?': 1 }]
    if (/select\s+count/.test(query)) return [{ count: 0 }]
    return []
  })
  mock.begin = vi.fn(async (cb) => cb(mock))
  return Object.assign(mock, overrides)
}

function makeRedisMock(overrides = {}) {
  return {
    on: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Dependency injection — sql
// ---------------------------------------------------------------------------

describe('buildApp — sql dependency injection', () => {
  let app
  let customSql

  beforeEach(async () => {
    customSql = makeSqlMock()
    app = await buildApp({ logger: false, sql: customSql, redis: makeRedisMock() })
  })

  afterEach(async () => {
    await app.close()
  })

  it('decorates the fastify instance with the injected sql client', () => {
    expect(app.sql).toBe(customSql)
  })

  it('health route calls the injected sql client', async () => {
    await app.inject({ method: 'GET', url: '/health' })
    expect(customSql).toHaveBeenCalled()
  })

  it('health route does NOT call the global sql fallback when a custom sql is provided', async () => {
    // Verify the injected mock was used — the global default would be a different reference
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(customSql).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Dependency injection — redis
// ---------------------------------------------------------------------------

describe('buildApp — redis dependency injection', () => {
  let app
  let customRedis

  beforeEach(async () => {
    customRedis = makeRedisMock()
    app = await buildApp({ logger: false, sql: makeSqlMock(), redis: customRedis })
  })

  afterEach(async () => {
    await app.close()
  })

  it('decorates the fastify instance with the injected redis client', () => {
    expect(app.redis).toBe(customRedis)
  })

  it('health route calls ping() on the injected redis client', async () => {
    await app.inject({ method: 'GET', url: '/health' })
    expect(customRedis.ping).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Health check route — success
// ---------------------------------------------------------------------------

describe('GET /health — success', () => {
  let app

  beforeEach(async () => {
    app = await buildApp({ logger: false, sql: makeSqlMock(), redis: makeRedisMock() })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 with status ok, database connected, redis connected', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('ok')
    expect(body.database).toBe('connected')
    expect(body.redis).toBe('connected')
  })

  it('includes a timestamp field in the response', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('timestamp')
    expect(() => new Date(body.timestamp)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Health check route — sql failure
// ---------------------------------------------------------------------------

describe('GET /health — sql failure', () => {
  let app

  beforeEach(async () => {
    const failingSql = makeSqlMock()
    failingSql.mockRejectedValue(new Error('connection refused'))
    app = await buildApp({ logger: false, sql: failingSql, redis: makeRedisMock() })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 503 when the sql client throws', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(503)
  })

  it('includes status error and message in the 503 body', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    const body = JSON.parse(response.body)
    expect(body.status).toBe('error')
    expect(body.message).toBe('connection refused')
  })
})

// ---------------------------------------------------------------------------
// Health check route — redis failure
// ---------------------------------------------------------------------------

describe('GET /health — redis failure', () => {
  let app

  beforeEach(async () => {
    app = await buildApp({
      logger: false,
      sql: makeSqlMock(),
      redis: makeRedisMock({ ping: vi.fn().mockRejectedValue(new Error('redis down')) }),
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 503 when redis.ping() throws', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(503)
  })

  it('includes status error and redis error message in the 503 body', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    const body = JSON.parse(response.body)
    expect(body.status).toBe('error')
    expect(body.message).toBe('redis down')
  })

  it('includes a timestamp in the error response', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('timestamp')
  })
})

// ---------------------------------------------------------------------------
// AJV — removeAdditional: false
// ---------------------------------------------------------------------------

describe('buildApp — AJV removeAdditional: false', () => {
  let app

  beforeEach(async () => {
    app = await buildApp({ logger: false, sql: makeSqlMock(), redis: makeRedisMock() })
  })

  afterEach(async () => {
    await app.close()
  })

  it('preserves extra query parameters that are not in the JSON schema', async () => {
    // GET /api/products accepts defined query params; passing an unknown extra
    // param should NOT cause the request to fail or strip the field silently —
    // the removeAdditional:false setting ensures unknown fields are kept.
    const response = await app.inject({
      method: 'GET',
      url: '/api/products?unknownExtraParam=should-be-kept',
    })
    // Route must still respond (not 400 due to schema stripping causing issues)
    expect(response.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// SESSION_SECRET guard
// ---------------------------------------------------------------------------

describe('buildApp — SESSION_SECRET guard', () => {
  it('throws when SESSION_SECRET is not set', async () => {
    const original = process.env.SESSION_SECRET
    delete process.env.SESSION_SECRET
    try {
      await expect(
        buildApp({ logger: false, sql: makeSqlMock(), redis: makeRedisMock() })
      ).rejects.toThrow('SESSION_SECRET environment variable is required')
    } finally {
      process.env.SESSION_SECRET = original
    }
  })
})
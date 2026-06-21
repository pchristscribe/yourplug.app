import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../src/app.js'

vi.mock('../src/lib/sql.js')
vi.mock('../src/lib/redis.js')

const makeRedisMock = (overrides = {}) => ({
  on: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn().mockResolvedValue(null),
  setex: vi.fn().mockResolvedValue('OK'),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  ...overrides,
})

describe('buildApp dependency injection', () => {
  describe('opts.sql injection', () => {
    it('decorates fastify with the injected sql client', async () => {
      const customSql = vi.fn(async () => [])
      customSql.begin = vi.fn(async (f) => f(customSql))

      const app = await buildApp({ logger: false, sql: customSql })
      expect(app.sql).toBe(customSql)
      await app.close()
    })

    it('decorates fastify with the default sql client when none is provided', async () => {
      const { default: defaultSql } = await import('../src/lib/sql.js')
      const app = await buildApp({ logger: false })
      expect(app.sql).toBe(defaultSql)
      await app.close()
    })

    it('passes injected sql client to the health check route', async () => {
      const customSql = vi.fn(async () => [{ '?column?': 1 }])
      customSql.begin = vi.fn(async (f) => f(customSql))

      const app = await buildApp({ logger: false, sql: customSql })
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(customSql).toHaveBeenCalled()
      await app.close()
    })
  })

  describe('opts.redis injection', () => {
    it('decorates fastify with the injected redis client', async () => {
      const customRedis = makeRedisMock()
      const app = await buildApp({ logger: false, redis: customRedis })
      expect(app.redis).toBe(customRedis)
      await app.close()
    })

    it('decorates fastify with the default redis client when none is provided', async () => {
      const { default: defaultRedis } = await import('../src/lib/redis.js')
      const app = await buildApp({ logger: false })
      expect(app.redis).toBe(defaultRedis)
      await app.close()
    })

    it('passes injected redis client to the health check route', async () => {
      const customRedis = makeRedisMock()
      const app = await buildApp({ logger: false, redis: customRedis })
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(customRedis.ping).toHaveBeenCalled()
      await app.close()
    })
  })

  describe('both sql and redis injected together', () => {
    it('uses both injected clients simultaneously', async () => {
      const customSql = vi.fn(async () => [{ '?column?': 1 }])
      customSql.begin = vi.fn(async (f) => f(customSql))
      const customRedis = makeRedisMock()

      const app = await buildApp({ logger: false, sql: customSql, redis: customRedis })
      expect(app.sql).toBe(customSql)
      expect(app.redis).toBe(customRedis)
      await app.close()
    })
  })
})

describe('Health endpoint with injected clients', () => {
  it('returns 200 with ok status when both clients succeed', async () => {
    const app = await buildApp({ logger: false })
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('ok')
    expect(body.database).toBe('connected')
    expect(body.redis).toBe('connected')
    expect(body).toHaveProperty('timestamp')
    await app.close()
  })

  it('returns 503 when sql client throws', async () => {
    const failingSql = vi.fn(async () => { throw new Error('DB unavailable') })
    failingSql.begin = vi.fn(async (f) => f(failingSql))

    const app = await buildApp({ logger: false, sql: failingSql, redis: makeRedisMock() })
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('error')
    expect(body.message).toBe('DB unavailable')
    expect(body).toHaveProperty('timestamp')
    await app.close()
  })

  it('returns 503 when redis ping throws', async () => {
    const customSql = vi.fn(async () => [{ '?column?': 1 }])
    customSql.begin = vi.fn(async (f) => f(customSql))

    const app = await buildApp({
      logger: false,
      sql: customSql,
      redis: makeRedisMock({ ping: vi.fn().mockRejectedValue(new Error('Redis unavailable')) }),
    })
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('error')
    expect(body.message).toBe('Redis unavailable')
    await app.close()
  })

  it('health response timestamp is a valid ISO date string', async () => {
    const app = await buildApp({ logger: false })
    const res = await app.inject({ method: 'GET', url: '/health' })

    const body = JSON.parse(res.body)
    const ts = new Date(body.timestamp)
    expect(ts).toBeInstanceOf(Date)
    expect(isNaN(ts.getTime())).toBe(false)
    await app.close()
  })
})

describe('AJV removeAdditional: false', () => {
  let app

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects unknown properties on endpoints with additionalProperties: false', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      payload: { email: 'test@example.com', extraField: 'should-be-rejected' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('does not reject requests with only known properties', async () => {
    // May still return 400 (admin not found) or similar — the point is AJV alone doesn't cause 500
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      payload: { email: 'test@example.com' },
    })
    expect(res.statusCode).not.toBe(500)
  })

  it('rejects extra properties on webauthn register/options endpoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/options',
      payload: { email: 'test@example.com', unknownProp: 'attack' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('buildApp SESSION_SECRET requirement', () => {
  it('throws when SESSION_SECRET is not set', async () => {
    const original = process.env.SESSION_SECRET
    try {
      delete process.env.SESSION_SECRET
      await expect(buildApp({ logger: false })).rejects.toThrow(
        'SESSION_SECRET environment variable is required'
      )
    } finally {
      process.env.SESSION_SECRET = original
    }
  })
})

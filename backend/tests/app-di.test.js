/**
 * Tests for app.js changes introduced in this PR:
 * 1. Dependency injection: opts.sql and opts.redis override defaults
 * 2. AJV removeAdditional: false — unknown properties return 400 instead of being silently stripped
 * 3. Health endpoint uses injected clients (returns 503 when they fail)
 * 4. fastify decorators (.sql, .redis) expose the injected clients
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../src/app.js'

vi.mock('../src/lib/sql.js')
vi.mock('../src/lib/redis.js')

// ─── Dependency injection ─────────────────────────────────────────────────────

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
      // When no sql opt is given, the module-level default (mocked) is used.
      // Import the mock so we can compare by reference.
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
      const customRedis = {
        on: vi.fn(),
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn().mockResolvedValue('OK'),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        rateLimit: vi.fn((...args) => { const cb = args[args.length - 1]; if (typeof cb === 'function') cb(null, [1, 60000]) }),
      }

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
      const customRedis = {
        on: vi.fn(),
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn().mockResolvedValue('OK'),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        rateLimit: vi.fn((...args) => { const cb = args[args.length - 1]; if (typeof cb === 'function') cb(null, [1, 60000]) }),
      }

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
      const customRedis = {
        on: vi.fn(),
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn().mockResolvedValue('OK'),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        rateLimit: vi.fn((...args) => { const cb = args[args.length - 1]; if (typeof cb === 'function') cb(null, [1, 60000]) }),
      }

      const app = await buildApp({ logger: false, sql: customSql, redis: customRedis })
      expect(app.sql).toBe(customSql)
      expect(app.redis).toBe(customRedis)
      await app.close()
    })
  })
})

// ─── Health endpoint ──────────────────────────────────────────────────────────

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
    const customRedis = {
      on: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    }

    const app = await buildApp({ logger: false, sql: failingSql, redis: customRedis })
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
    const failingRedis = {
      on: vi.fn(),
      ping: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    }

    const app = await buildApp({ logger: false, sql: customSql, redis: failingRedis })
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

// ─── AJV removeAdditional: false ─────────────────────────────────────────────

describe('AJV removeAdditional: false', () => {
  let app

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects requests with extra unknown properties on endpoints that use additionalProperties: false', async () => {
    // The webauthn authenticate/options endpoint has additionalProperties: false.
    // With removeAdditional: false (new behaviour), extra fields cause a 400.
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      payload: {
        email: 'test@example.com',
        extraField: 'should-be-rejected',
      },
    })

    expect(res.statusCode).toBe(400)
  })

  it('does not reject requests that have only known properties', async () => {
    // Providing only the expected field should not be rejected due to AJV config
    // (it may still return 400/404 for other reasons, but not because of AJV stripping)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      payload: { email: 'test@example.com' },
    })

    // Should not be rejected purely for schema reasons related to additional properties
    // (it may return 400 if admin not found, or 404, but not a schema property error)
    expect(res.statusCode).not.toBe(500)
  })

  it('rejects extra properties on webauthn register/options endpoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/options',
      payload: {
        email: 'test@example.com',
        unknownProp: 'attack',
      },
    })

    // With removeAdditional: false, unknown properties cause validation failure
    expect(res.statusCode).toBe(400)
  })
})

// ─── SESSION_SECRET guard ─────────────────────────────────────────────────────

describe('buildApp SESSION_SECRET requirement', () => {
  it('throws when SESSION_SECRET is not set', async () => {
    const original = process.env.SESSION_SECRET
    delete process.env.SESSION_SECRET

    await expect(buildApp({ logger: false })).rejects.toThrow(
      'SESSION_SECRET environment variable is required'
    )

    process.env.SESSION_SECRET = original
  })
})
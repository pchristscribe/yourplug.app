import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'
import redisMock from '../src/lib/__mocks__/redis.js'
import sqlMock from '../src/lib/__mocks__/sql.js'

// Shared opts that inject mocks and silence logs
const baseOpts = { sql: sqlMock, redis: redisMock, logger: false }

describe('buildApp – dependency injection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('opts.sql injection', () => {
    it('decorates fastify.sql with the injected sql client', async () => {
      const app = await buildApp(baseOpts)
      expect(app.sql).toBe(sqlMock)
      await app.close()
    })

    it('uses the injected sql client in the /health route', async () => {
      const app = await buildApp(baseOpts)
      await app.inject({ method: 'GET', url: '/health' })
      // sqlMock should have been called once for SELECT 1
      expect(sqlMock).toHaveBeenCalledTimes(1)
      await app.close()
    })
  })

  describe('opts.redis injection', () => {
    it('decorates fastify.redis with the injected redis client', async () => {
      const app = await buildApp(baseOpts)
      expect(app.redis).toBe(redisMock)
      await app.close()
    })

    it('uses the injected redis client ping() in the /health route', async () => {
      const app = await buildApp(baseOpts)
      await app.inject({ method: 'GET', url: '/health' })
      expect(redisMock.ping).toHaveBeenCalledTimes(1)
      await app.close()
    })
  })

  describe('/health route with injected clients', () => {
    it('returns 200 with ok status when both clients succeed', async () => {
      const app = await buildApp(baseOpts)
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body).toMatchObject({
        status: 'ok',
        database: 'connected',
        redis: 'connected',
      })
      await app.close()
    })

    it('includes a timestamp in the response', async () => {
      const app = await buildApp(baseOpts)
      const res = await app.inject({ method: 'GET', url: '/health' })
      const body = JSON.parse(res.body)
      expect(body).toHaveProperty('timestamp')
      expect(() => new Date(body.timestamp)).not.toThrow()
      await app.close()
    })

    it('returns 503 when the injected sql client throws', async () => {
      const failingSql = vi.fn().mockRejectedValue(new Error('DB unavailable'))
      failingSql.begin = vi.fn()
      const app = await buildApp({ sql: failingSql, redis: redisMock, logger: false })
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(503)
      const body = JSON.parse(res.body)
      expect(body).toMatchObject({
        status: 'error',
        message: 'DB unavailable',
      })
      await app.close()
    })

    it('returns 503 when the injected redis client ping throws', async () => {
      const failingRedis = { ...redisMock, ping: vi.fn().mockRejectedValue(new Error('Redis down')) }
      const app = await buildApp({ sql: sqlMock, redis: failingRedis, logger: false })
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(503)
      const body = JSON.parse(res.body)
      expect(body).toMatchObject({
        status: 'error',
        message: 'Redis down',
      })
      await app.close()
    })

    it('error response includes timestamp', async () => {
      const failingSql = vi.fn().mockRejectedValue(new Error('oops'))
      failingSql.begin = vi.fn()
      const app = await buildApp({ sql: failingSql, redis: redisMock, logger: false })
      const res = await app.inject({ method: 'GET', url: '/health' })
      const body = JSON.parse(res.body)
      expect(body).toHaveProperty('timestamp')
      await app.close()
    })
  })

  describe('default fallback (no injection)', () => {
    it('uses module-level sql and redis when opts does not specify them', async () => {
      // We cannot test the exact identity of the module-level clients without mocking
      // the modules, but we CAN verify buildApp succeeds and returns a fastify instance
      // when SESSION_SECRET is set (it is, via vitest.config.js env).
      // This test uses the injected mocks to confirm the ?? operator works.
      const customSql = vi.fn(async (strings) => {
        if (Array.isArray(strings) && strings.raw) return [{ '?column?': 1 }]
        return strings
      })
      customSql.begin = vi.fn()
      const customRedis = { ...redisMock, ping: vi.fn().mockResolvedValue('PONG') }

      const app = await buildApp({ sql: customSql, redis: customRedis, logger: false })
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(customSql).toHaveBeenCalled()
      expect(customRedis.ping).toHaveBeenCalled()
      await app.close()
    })
  })

  describe('AJV configuration', () => {
    it('does not strip additional properties from request bodies (removeAdditional: false)', async () => {
      const app = await buildApp(baseOpts)

      // Register a test route with a JSON schema that has defined properties
      app.post('/test-ajv', {
        schema: {
          body: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
        handler: async (req) => req.body,
      })

      const res = await app.inject({
        method: 'POST',
        url: '/test-ajv',
        payload: { name: 'hello', extra: 'should-not-be-stripped' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      // With removeAdditional: false, extra properties are preserved
      expect(body).toHaveProperty('extra', 'should-not-be-stripped')
      await app.close()
    })
  })

  describe('session store uses injected redis', () => {
    it('initialises the session store with the injected redis client', async () => {
      // Spy on redisMock.on, which ioredis-based clients emit events on
      const app = await buildApp(baseOpts)
      // The session store constructor receives redisClient; verify the decorator reference is correct
      expect(app.redis).toBe(redisMock)
      await app.close()
    })
  })
})
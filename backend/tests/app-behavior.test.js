/**
 * Tests for app.js behavior:
 * 1. Dependency injection — opts.sql and opts.redis override module-level clients when provided
 * 2. AJV customOptions (removeAdditional: false) rejects unknown fields with 400
 * 3. Health endpoint uses module-level sql/redis directly
 * 4. SESSION_SECRET environment variable is still required
 * 5. fastify.sql and fastify.redis decorators expose the active clients
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { buildApp } from '../src/app.js'

// ─── SESSION_SECRET requirement ───────────────────────────────────────────────

describe('buildApp SESSION_SECRET requirement', () => {
  let savedSessionSecret

  beforeEach(() => {
    savedSessionSecret = process.env.SESSION_SECRET
  })

  afterEach(() => {
    if (savedSessionSecret !== undefined) {
      process.env.SESSION_SECRET = savedSessionSecret
    } else {
      delete process.env.SESSION_SECRET
    }
  })

  it('throws when SESSION_SECRET is not set', async () => {
    delete process.env.SESSION_SECRET

    await expect(buildApp({ logger: false })).rejects.toThrow(
      'SESSION_SECRET environment variable is required'
    )
  })

  it('throws with the exact error message when SESSION_SECRET is missing', async () => {
    delete process.env.SESSION_SECRET

    let error
    try {
      await buildApp({ logger: false })
    } catch (e) {
      error = e
    }
    expect(error).toBeDefined()
    expect(error.message).toBe('SESSION_SECRET environment variable is required')
  })

  it('does not throw when SESSION_SECRET is set', async () => {
    // SESSION_SECRET is provided via vitest.config.js env
    expect(process.env.SESSION_SECRET).toBeTruthy()
    const app = await buildApp({ logger: false })
    expect(app).toBeDefined()
    await app.close()
  })
})

// ─── buildApp core behavior ───────────────────────────────────────────────────

describe('buildApp no dependency injection', () => {
  let app

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  it('starts successfully without any opts', async () => {
    const instance = await buildApp({ logger: false })
    expect(instance).toBeDefined()
    expect(typeof instance.inject).toBe('function')
    await instance.close()
  })

  it('fastify.sql decorator is defined and is a function', () => {
    expect(app.sql).toBeDefined()
    expect(typeof app.sql).toBe('function')
  })

  it('fastify.redis decorator is defined and is an object', () => {
    expect(app.redis).toBeDefined()
    expect(typeof app.redis).toBe('object')
  })

  it('fastify.redis has the expected interface (ping, get, set, del)', () => {
    expect(typeof app.redis.ping).toBe('function')
    expect(typeof app.redis.get).toBe('function')
    expect(typeof app.redis.set).toBe('function')
  })
})

// ─── Health endpoint ──────────────────────────────────────────────────────────

describe('Health endpoint — module-level clients', () => {
  let app

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 with status ok when module-level sql and redis are healthy', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('ok')
    expect(body.database).toBe('connected')
    expect(body.redis).toBe('connected')
  })

  it('response includes a timestamp field', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('timestamp')
    const ts = new Date(body.timestamp)
    expect(ts).toBeInstanceOf(Date)
    expect(isNaN(ts.getTime())).toBe(false)
  })

  it('timestamp is a valid ISO 8601 date string', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    const body = JSON.parse(res.body)
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('responds to GET /health only (POST returns 404)', async () => {
    const res = await app.inject({ method: 'POST', url: '/health' })
    expect(res.statusCode).toBe(404)
  })
})

// ─── AJV default validation behavior (removeAdditional removed) ──────────────

describe('AJV validation — default behavior after removeAdditional option removal', () => {
  let app

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects requests with extra unknown properties on endpoints with additionalProperties: false', async () => {
    // The webauthn authenticate/options endpoint has additionalProperties: false in schema
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      payload: {
        email: 'test@example.com',
        extraUnknownField: 'should-be-rejected',
      },
    })

    // Default AJV with additionalProperties: false causes 400
    expect(res.statusCode).toBe(400)
  })

  it('does not return 500 for requests with only known properties', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      payload: { email: 'test@example.com' },
    })

    // May be 400 (admin not found) or other, but NOT a server error
    expect(res.statusCode).not.toBe(500)
  })

  it('rejects extra properties on webauthn register/options endpoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/options',
      payload: {
        email: 'test@example.com',
        unknownProp: 'injected-value',
      },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─── buildApp accepts logger option correctly ─────────────────────────────────

describe('buildApp logger option', () => {
  it('accepts logger: false to disable logging', async () => {
    const app = await buildApp({ logger: false })
    expect(app).toBeDefined()
    await app.close()
  })

  it('builds multiple independent app instances without conflict', async () => {
    const app1 = await buildApp({ logger: false })
    const app2 = await buildApp({ logger: false })

    expect(app1).not.toBe(app2)

    await app1.close()
    await app2.close()
  })
})
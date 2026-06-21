import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../src/app.js'

vi.mock('../src/lib/sql.js', () => {
  const fn = vi.fn(async (strings, ...values) => {
    if (!strings?.raw) return strings
    const first = strings[0].trim().toLowerCase()
    if (first.startsWith('select count(*)')) return [{ count: 0 }]
    if (first.startsWith('select 1')) return [{ '?column?': 1 }]
    return []
  })
  fn.begin = vi.fn(async (f) => f(fn))
  return { default: fn }
})

vi.mock('../src/lib/redis.js', () => ({
  default: {
    on: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))

let app

beforeAll(async () => {
  app = await buildApp({ logger: false })
})

afterAll(async () => {
  await app.close()
})

describe('Health Check', () => {
  it('should return health status with database and redis connection info', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('status', 'ok')
    expect(body).toHaveProperty('database', 'connected')
    expect(body).toHaveProperty('redis', 'connected')
    expect(body).toHaveProperty('timestamp')
  })
})

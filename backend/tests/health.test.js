import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../src/app.js'

vi.mock('../src/lib/sql.js')
vi.mock('../src/lib/redis.js')

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

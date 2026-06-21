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

describe('Security Fixes - Public API Write Operations Blocked', () => {
  describe('POST /api/products', () => {
    it('should return 404 (endpoint removed for security)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: { title: 'Test Product', platform: 'DHGATE', price: 10 }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PATCH /api/products/:id', () => {
    it('should return 404 (endpoint removed for security)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/products/test-id',
        payload: { title: 'Updated Product' }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/products/:id', () => {
    it('should return 404 (endpoint removed for security)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/products/test-id'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/categories', () => {
    it('should return 404 (endpoint removed for security)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/categories',
        payload: { name: 'Test Category', slug: 'test-category' }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PATCH /api/categories/:id', () => {
    it('should return 404 (endpoint removed for security)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/categories/test-id',
        payload: { name: 'Updated Category' }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/categories/:id', () => {
    it('should return 404 (endpoint removed for security)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/categories/test-id'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})

describe('Public API Read Operations Still Work', () => {
  describe('GET /api/products', () => {
    it('should still work (read-only public access)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('products')
      expect(body).toHaveProperty('pagination')
    })
  })

  describe('GET /api/categories', () => {
    it('should still work (read-only public access)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/categories'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)
    })
  })
})

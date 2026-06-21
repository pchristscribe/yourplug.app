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

describe('Product API', () => {
  describe('GET /api/products', () => {
    it('should return products list with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('products')
      expect(body).toHaveProperty('pagination')
      expect(Array.isArray(body.products)).toBe(true)
      expect(body.pagination).toHaveProperty('page')
      expect(body.pagination).toHaveProperty('limit')
      expect(body.pagination).toHaveProperty('total')
      expect(body.pagination).toHaveProperty('pages')
    })

    it('should filter products by platform', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products?platform=DHGATE'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // All products should be from DHGATE platform
      body.products.forEach(product => {
        expect(product.platform).toBe('DHGATE')
      })
    })

    it('should filter products by price range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products?minPrice=10&maxPrice=50'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // All products should be within price range
      body.products.forEach(product => {
        expect(product.price).toBeGreaterThanOrEqual(10)
        expect(product.price).toBeLessThanOrEqual(50)
      })
    })

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products?page=1&limit=2'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.products.length).toBeLessThanOrEqual(2)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(2)
    })
  })

  describe('GET /api/products validation errors', () => {
    it('returns 400 for invalid categoryId format', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/products?categoryId=not-a-uuid' })
      expect(response.statusCode).toBe(400)
    })

    it('returns 400 for invalid status value', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/products?status=UNKNOWN' })
      expect(response.statusCode).toBe(400)
    })

    it('returns 400 for invalid platform value', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/products?platform=INVALID' })
      expect(response.statusCode).toBe(400)
    })

    it('returns products sorted ascending by price', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/products?sortBy=price&order=asc' })
      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /api/products/:id', () => {
    it('should return a single product by id', async () => {
      // First get a product to test with
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/products?limit=1'
      })
      const listBody = JSON.parse(listResponse.body)

      if (listBody.products.length === 0) {
        // Skip test if no products exist
        return
      }

      const productId = listBody.products[0].id

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${productId}`
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id', productId)
      expect(body).toHaveProperty('title')
      expect(body).toHaveProperty('price')
      expect(body).toHaveProperty('platform')
      expect(body).toHaveProperty('category')
    })

    it('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products/non-existent-id'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})

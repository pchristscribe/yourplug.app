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

describe('Category API', () => {
  describe('GET /api/categories', () => {
    it('should return categories list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/categories'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)

      if (body.length > 0) {
        const category = body[0]
        expect(category).toHaveProperty('id')
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('slug')
        expect(category).toHaveProperty('_count')
        expect(category._count).toHaveProperty('products')
      }
    })
  })

  describe('GET /api/categories/:identifier', () => {
    it('should return a single category by id or slug', async () => {
      // First get a category to test with
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/categories'
      })
      const categories = JSON.parse(listResponse.body)

      if (categories.length === 0) {
        // Skip test if no categories exist
        return
      }

      const category = categories[0]

      // Test by ID
      const idResponse = await app.inject({
        method: 'GET',
        url: `/api/categories/${category.id}`
      })

      expect(idResponse.statusCode).toBe(200)
      const idBody = JSON.parse(idResponse.body)
      expect(idBody).toHaveProperty('id', category.id)
      expect(idBody).toHaveProperty('name')
      expect(idBody).toHaveProperty('products')
      expect(Array.isArray(idBody.products)).toBe(true)

      // Test by slug
      const slugResponse = await app.inject({
        method: 'GET',
        url: `/api/categories/${category.slug}`
      })

      expect(slugResponse.statusCode).toBe(200)
      const slugBody = JSON.parse(slugResponse.body)
      expect(slugBody).toHaveProperty('slug', category.slug)
    })

    it('should return 404 for non-existent category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/categories/non-existent-category'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})

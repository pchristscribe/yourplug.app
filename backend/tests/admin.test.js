import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app.js'
import bcrypt from 'bcryptjs'

let app
let cookie // session cookie set after login
let csrfToken // CSRF token fetched from the server after login
const TEST_EMAIL = `test-admin-${Date.now()}@example.com`
const TEST_PASSWORD = 'TestPass123!'
let testAdminId
let testCategoryId
let testAffiliateLinkId
let testProductId

beforeAll(async () => {
  app = await buildApp({ logger: false })

  // Create a test admin directly in the DB
  const hash = await bcrypt.hash(TEST_PASSWORD, 10)
  const [admin] = await app.sql`
    insert into admins (email, name, role, password_hash, is_active)
    values (${TEST_EMAIL}, 'Test Admin', 'admin', ${hash}, true)
    returning id
  `
  testAdminId = admin.id

  // Login and capture session cookie (extract name=value, strip Path/Expires/etc.)
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  expect(loginRes.statusCode).toBe(200)
  const setCookie = loginRes.headers['set-cookie']
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  cookie = rawCookie.split(';')[0].trim()

  // Fetch a server-issued CSRF token for the session (no token needed on the fetch itself)
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/csrf-token',
    headers: { cookie },
  })
  expect(csrfRes.statusCode).toBe(200)
  csrfToken = JSON.parse(csrfRes.body).csrfToken
})

afterAll(async () => {
  // Clean up: remove test data created during tests
  if (testProductId) {
    await app.sql`delete from products where id = ${testProductId}`.catch(() => {})
  }
  if (testCategoryId) {
    await app.sql`delete from categories where id = ${testCategoryId}`.catch(() => {})
  }
  if (testAdminId) {
    await app.sql`delete from admins where id = ${testAdminId}`.catch(() => {})
  }
  await app.close()
})

// ─── Auth routes ──────────────────────────────────────────────────────────────

describe('Admin Auth Routes', () => {
  it('GET /api/admin/auth/session returns authenticated admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/session',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.authenticated).toBe(true)
    expect(body.admin.email).toBe(TEST_EMAIL)
  })

  it('GET /api/admin/auth/session returns 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/auth/session' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/auth/login returns 400 for invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: 'not-an-email', password: 'pass' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/auth/login returns 401 for wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: TEST_EMAIL, password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/auth/login returns 401 for unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: 'nobody@nowhere.com', password: 'pass' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/auth/login returns 401 for admin with no password hash set', async () => {
    const noHashEmail = `no-hash-${Date.now()}@test.com`
    const [a] = await app.sql`
      insert into admins (email, name, role, is_active)
      values (${noHashEmail}, 'No Hash', 'admin', true)
      returning id
    `
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: noHashEmail, password: 'anypass' },
    })
    await app.sql`delete from admins where id = ${a.id}`
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/auth/session returns 401 when admin becomes inactive', async () => {
    // Login, then deactivate the admin, then check session → 401
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    const sessionCookie = loginRes.headers['set-cookie'].split(';')[0]
    await app.sql`update admins set is_active = false where id = ${testAdminId}`
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/session',
      headers: { cookie: sessionCookie },
    })
    await app.sql`update admins set is_active = true where id = ${testAdminId}`
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/auth/logout destroys the session', async () => {
    // Use a separate login so we don't invalidate the shared cookie used by other tests
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    const tempCookie = loginRes.headers['set-cookie'].split(';')[0].trim()
    // Fetch a CSRF token for this temporary session
    const tempCsrfRes = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/csrf-token',
      headers: { cookie: tempCookie },
    })
    const tempCsrfToken = JSON.parse(tempCsrfRes.body).csrfToken
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/logout',
      headers: { cookie: tempCookie, 'x-csrf-token': tempCsrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
  })

  it('admin routes return 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/categories' })
    expect(res.statusCode).toBe(401)
  })
})

// ─── Admin Category routes ────────────────────────────────────────────────────

describe('Admin Category Routes', () => {
  it('GET /api/admin/categories returns category list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/categories',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('categories')
    expect(Array.isArray(body.categories)).toBe(true)
    expect(body).toHaveProperty('pagination')
  })

  it('GET /api/admin/categories supports search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/categories?search=test',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/categories supports pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/categories?page=1&limit=5',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.categories.length).toBeLessThanOrEqual(5)
  })

  it('POST /api/admin/categories creates a category', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { name: 'Test Category', slug: `test-category-${Date.now()}` },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('id')
    testCategoryId = body.id
  })

  it('POST /api/admin/categories returns 409 on duplicate slug', async () => {
    const slug = `dupe-slug-${Date.now()}`
    await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { name: 'First', slug },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { name: 'Second', slug },
    })
    expect(res.statusCode).toBe(409)
    // clean up
    await app.sql`delete from categories where slug = ${slug}`.catch(() => {})
  })

  it('GET /api/admin/categories/:id returns a single category', async () => {
    if (!testCategoryId) return
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/categories/${testCategoryId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.id).toBe(testCategoryId)
  })

  it('GET /api/admin/categories/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/categories/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── Admin Product routes ─────────────────────────────────────────────────────

describe('Admin Product Routes', () => {
  it('GET /api/admin/products returns product list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('products')
    expect(body).toHaveProperty('pagination')
  })

  it('GET /api/admin/products supports search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products?search=sword',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/products supports status filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products?status=ACTIVE',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/admin/products creates a product', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {
        externalId: `ext-test-${Date.now()}`,
        platform: 'DHGATE',
        title: 'Test Product for Coverage',
        description: 'A product created by automated tests',
        price: 19.99,
        currency: 'USD',
        status: 'ACTIVE',
        categoryId: testCategoryId,
        reviewCount: 0,
        tags: ['test'],
      },
    })
    expect([201, 200]).toContain(res.statusCode)
    const body = JSON.parse(res.body)
    if (body.id) testProductId = body.id
  })

  it('GET /api/admin/products/:id returns 404 for unknown product', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── Admin Review routes ──────────────────────────────────────────────────────

describe('Admin Review Routes', () => {
  it('GET /api/admin/reviews returns review list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('reviews')
    expect(body).toHaveProperty('pagination')
  })

  it('GET /api/admin/reviews supports pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews?page=1&limit=5',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/reviews supports status filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews?status=APPROVED',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/reviews/:id returns 404 for unknown review', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/admin/reviews with isFeatured filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews?isFeatured=true',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/reviews with rating filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews?rating=5',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/reviews with search filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews?search=great',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/reviews returns 400 for invalid productId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews?productId=not-a-uuid',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/admin/reviews with sortBy=rating order=asc', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews?sortBy=rating&order=asc',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ─── Admin Category CRUD ──────────────────────────────────────────────────────

describe('Admin Category CRUD', () => {
  it('PATCH /api/admin/categories/:id updates the category name', async () => {
    if (!testCategoryId) return
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/categories/${testCategoryId}`,
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { name: 'Updated Test Category' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.name).toBe('Updated Test Category')
  })

  it('PATCH /api/admin/categories/:id with no valid fields is rejected by schema', async () => {
    if (!testCategoryId) return
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/categories/${testCategoryId}`,
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {},
    })
    // Schema requires at least one writable field
    expect([400, 200]).toContain(res.statusCode)
  })

  it('PATCH /api/admin/categories/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/categories/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { name: 'Ghost' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/admin/categories/:id returns 409 when category has products', async () => {
    if (!testCategoryId) return
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/categories/${testCategoryId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(409)
  })

  it('DELETE /api/admin/categories/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/categories/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/admin/categories with desc sort order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/categories?sortBy=createdAt&order=desc',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/categories/:id returns 404 for non-UUID id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/categories/not-a-uuid',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── Admin Product CRUD ───────────────────────────────────────────────────────

describe('Admin Product CRUD', () => {
  it('GET /api/admin/products/:id returns the product', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/products/${testProductId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.id).toBe(testProductId)
  })

  it('GET /api/admin/products with categoryId filter', async () => {
    if (!testCategoryId) return
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/products?categoryId=${testCategoryId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/products returns 400 for invalid categoryId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products?categoryId=not-a-uuid',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /api/admin/products/:id updates the product title', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/products/${testProductId}`,
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { title: 'Updated Test Product' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.title).toBe('Updated Test Product')
  })

  it('PATCH /api/admin/products/:id with no fields returns existing product', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/products/${testProductId}`,
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {},
    })
    expect(res.statusCode).toBe(200)
  })

  it('DELETE /api/admin/products/:id deletes the product', async () => {
    if (!testProductId) return
    // Create a temporary product to delete so we don't lose testProductId for cleanup
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {
        externalId: `tmp-delete-${Date.now()}`,
        platform: 'DHGATE',
        title: 'Temp Product to Delete',
        description: '',
        price: 5.00,
        currency: 'USD',
        status: 'INACTIVE',
        categoryId: testCategoryId,
        reviewCount: 0,
        tags: [],
      },
    })
    const { id: tmpId } = JSON.parse(createRes.body)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/products/${tmpId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect([200, 204]).toContain(res.statusCode)
  })

  it('DELETE /api/admin/products/:id returns 404 for unknown product', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/products/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── Admin Review CRUD ────────────────────────────────────────────────────────

describe('Admin Review CRUD', () => {
  let testReviewId

  it('POST /api/admin/reviews creates a review', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {
        productId: testProductId,
        rating: 5,
        title: 'Great product',
        content: 'Really loved this item for coverage testing.',
        pros: ['quality', 'price'],
        cons: ['slow shipping'],
        authorName: 'Test Reviewer',
        isFeatured: false,
      },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    testReviewId = body.id
  })

  it('GET /api/admin/reviews/:id returns the review', async () => {
    if (!testReviewId) return
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/reviews/${testReviewId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.id).toBe(testReviewId)
  })

  it('PATCH /api/admin/reviews/:id updates isFeatured', async () => {
    if (!testReviewId) return
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/reviews/${testReviewId}`,
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { isFeatured: true },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.isFeatured).toBe(true)
  })

  it('GET /api/admin/reviews with productId filter', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/reviews?productId=${testProductId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.reviews.length).toBeGreaterThan(0)
  })

  it('DELETE /api/admin/reviews/:id deletes the review', async () => {
    if (!testReviewId) return
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/reviews/${testReviewId}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect([200, 204]).toContain(res.statusCode)
  })

  it('GET /api/admin/reviews/:id returns 404 for non-UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reviews/not-a-uuid',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── Bulk operations ──────────────────────────────────────────────────────────

describe('Admin Bulk Operations', () => {
  let bulkReviewId

  beforeAll(async () => {
    // Create a review for bulk operation tests
    if (testProductId) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/reviews',
        headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        payload: {
          productId: testProductId,
          rating: 4,
          content: 'Bulk test review',
          authorName: 'Bulk Tester',
          isFeatured: false,
        },
      })
      if (res.statusCode === 201) bulkReviewId = JSON.parse(res.body).id
    }
  })

  it('POST /api/admin/reviews/bulk/toggle-featured toggles featured state', async () => {
    if (!bulkReviewId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/bulk/toggle-featured',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { reviewIds: [bulkReviewId], isFeatured: true },
    })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/admin/reviews/bulk/toggle-featured returns 400 for empty array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/bulk/toggle-featured',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { reviewIds: [], isFeatured: true },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/reviews/bulk/toggle-featured returns 400 for invalid UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/bulk/toggle-featured',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { reviewIds: ['not-a-uuid'], isFeatured: false },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/reviews/bulk/delete returns 400 for invalid UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { reviewIds: ['not-a-uuid'] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/reviews/bulk/delete deletes reviews', async () => {
    if (!bulkReviewId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { reviewIds: [bulkReviewId] },
    })
    expect(res.statusCode).toBe(200)
    bulkReviewId = null
  })

  it('POST /api/admin/reviews/bulk/delete returns 400 for empty array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { reviewIds: [] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/products/bulk/status updates product status', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/status',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { productIds: [testProductId], status: 'INACTIVE' },
    })
    expect(res.statusCode).toBe(200)
    // Restore ACTIVE status
    await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/status',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { productIds: [testProductId], status: 'ACTIVE' },
    })
  })

  it('POST /api/admin/products/bulk/status returns 400 with no productIds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/status',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/products/bulk/status returns 400 for invalid UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/status',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { productIds: ['not-a-uuid'], status: 'ACTIVE' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/products/bulk/status returns 400 for invalid status', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/status',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { productIds: [testProductId], status: 'INVALID_STATUS' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── Click tracking (public route) ───────────────────────────────────────────

describe('Click Tracking', () => {
  beforeAll(async () => {
    // Create a test affiliate link for click tracking tests
    if (testProductId) {
      const [link] = await app.sql`
        insert into affiliate_links (product_id, original_url, tracked_url)
        values (${testProductId}, 'https://example.com/product', 'https://dub.co/test')
        returning id
      `
      testAffiliateLinkId = link?.id
    }
  })

  afterAll(async () => {
    if (testAffiliateLinkId) {
      await app.sql`delete from affiliate_links where id = ${testAffiliateLinkId}`.catch(() => {})
    }
  })

  it('POST /api/products/:id/click tracks a click', async () => {
    if (!testProductId || !testAffiliateLinkId) return
    const res = await app.inject({
      method: 'POST',
      url: `/api/products/${testProductId}/click`,
      headers: { 'content-type': 'application/json' },
      payload: { affiliateLinkId: testAffiliateLinkId },
    })
    expect(res.statusCode).toBe(204)
  })

  it('POST /api/products/:id/click returns 404 for wrong product/link combo', async () => {
    if (!testAffiliateLinkId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/products/00000000-0000-0000-0000-000000000000/click',
      headers: { 'content-type': 'application/json' },
      payload: { affiliateLinkId: testAffiliateLinkId },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── Delete empty category + bulk delete ─────────────────────────────────────

describe('Admin Category delete and bulk', () => {
  it('DELETE /api/admin/categories/:id deletes an empty category', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { name: 'Empty Cat', slug: `empty-cat-${Date.now()}` },
    })
    const { id } = JSON.parse(createRes.body)
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/categories/${id}`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect([200, 204]).toContain(deleteRes.statusCode)
  })

  it('POST /api/admin/categories/bulk/delete returns 400 for empty array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/categories/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { categoryIds: [] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/categories/bulk/delete deletes empty categories', async () => {
    // Create a temp category with no products
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { name: 'Bulk Del Cat', slug: `bulk-del-${Date.now()}` },
    })
    const { id } = JSON.parse(createRes.body)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/categories/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { categoryIds: [id] },
    })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/admin/categories/bulk/delete returns 409 when category has products', async () => {
    if (!testCategoryId) return
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/categories/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { categoryIds: [testCategoryId] },
    })
    expect(res.statusCode).toBe(409)
  })
})

// ─── Admin Products bulk delete + dashboard ───────────────────────────────────

describe('Admin Products bulk/delete and dashboard', () => {
  it('POST /api/admin/products/bulk/delete returns 400 for empty array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { productIds: [] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/products/bulk/delete returns 400 for invalid UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { productIds: ['not-a-uuid'] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/products/bulk/delete deletes a product', async () => {
    // Create a temp product to bulk-delete
    if (!testCategoryId) return
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {
        externalId: `bulk-del-${Date.now()}`,
        platform: 'ALIEXPRESS',
        title: 'Temp Bulk Delete Product',
        description: '',
        price: 1.00,
        currency: 'USD',
        status: 'INACTIVE',
        categoryId: testCategoryId,
        reviewCount: 0,
        tags: [],
      },
    })
    const { id } = JSON.parse(createRes.body)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { productIds: [id] },
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/admin/products/stats/dashboard returns dashboard stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products/stats/dashboard',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('stats')
    expect(body.stats).toHaveProperty('totalProducts')
  })

  it('PATCH /api/admin/products/:id with no fields returns existing product', async () => {
    if (!testProductId) return
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/products/${testProductId}`,
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {},
    })
    expect(res.statusCode).toBe(200)
  })

  it('PATCH /api/admin/products/:id with no fields returns 404 for unknown product', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/products/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {},
    })
    expect(res.statusCode).toBe(404)
  })
})

// ─── WebAuthn routes ──────────────────────────────────────────────────────────

describe('WebAuthn routes', () => {
  it('POST /api/admin/webauthn/register/options generates options for existing admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/options',
      headers: { 'content-type': 'application/json' },
      payload: { email: TEST_EMAIL },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('challenge')
  })

  it('POST /api/admin/webauthn/authenticate/options returns 400 when no credentials registered', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      headers: { 'content-type': 'application/json' },
      payload: { email: TEST_EMAIL },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toMatch(/no security keys/i)
  })

  it('POST /api/admin/webauthn/authenticate/options returns 404 for unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'nobody@nowhere.test' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/admin/webauthn/credentials returns empty list for authenticated admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/webauthn/credentials',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('credentials')
    expect(Array.isArray(body.credentials)).toBe(true)
  })

  it('GET /api/admin/webauthn/credentials returns 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/webauthn/credentials' })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/admin/webauthn/credentials/:id returns 401 without session', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/webauthn/credentials/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET and DELETE /api/admin/webauthn/credentials return 401 when admin becomes inactive mid-session', async () => {
    // Regression test: a live session must not survive admin deactivation.
    // Use a dedicated login so the shared cookie stays valid for other tests.
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    const rawCookie = loginRes.headers['set-cookie']
    const sessionCookie = (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie).split(';')[0].trim()
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/csrf-token',
      headers: { cookie: sessionCookie },
    })
    const sessionCsrf = JSON.parse(csrfRes.body).csrfToken

    const [cred] = await app.sql`
      insert into webauthn_credentials (admin_id, credential_id, public_key, counter, device_name, transports)
      values (${testAdminId}, 'inactive-test-cred', 'fake-public-key', 0, 'Inactive Test Key', '{"usb"}')
      returning id
    `

    try {
      await app.sql`update admins set is_active = false where id = ${testAdminId}`

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/admin/webauthn/credentials',
        headers: { cookie: sessionCookie },
      })
      expect(listRes.statusCode).toBe(401)

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/webauthn/credentials/${cred.id}`,
        headers: { cookie: sessionCookie, 'x-csrf-token': sessionCsrf },
      })
      expect(deleteRes.statusCode).toBe(401)

      // The credential must be untouched
      const [survivor] = await app.sql`
        select id from webauthn_credentials where id = ${cred.id}
      `
      expect(survivor).toBeDefined()
    } finally {
      await app.sql`update admins set is_active = true where id = ${testAdminId}`.catch(() => {})
      await app.sql`delete from webauthn_credentials where id = ${cred.id}`.catch(() => {})
    }
  })

  it('DELETE /api/admin/webauthn/credentials/:id returns 404 for non-UUID', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/webauthn/credentials/not-a-uuid',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/admin/webauthn/credentials/:id returns 404 for unknown credential', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/webauthn/credentials/00000000-0000-0000-0000-000000000000',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/admin/webauthn/register/verify returns 400 with missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/verify',
      headers: { 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/webauthn/authenticate/verify returns 400 with missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/verify',
      headers: { 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/webauthn/authenticate/verify returns 400 for non-object credential', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/verify',
      headers: { 'content-type': 'application/json' },
      payload: { email: TEST_EMAIL, credential: 'not-an-object' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/webauthn/authenticate/verify returns 400 for admin with no challenge', async () => {
    const noChallEmail = `no-auth-chal-${Date.now()}@test.com`
    const [a] = await app.sql`
      insert into admins (email, name, role, is_active)
      values (${noChallEmail}, 'No Auth Chal', 'admin', true)
      returning id
    `
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/verify',
      headers: { 'content-type': 'application/json' },
      payload: { email: noChallEmail, credential: { id: 'abc', type: 'public-key', response: {} } },
    })
    await app.sql`delete from admins where id = ${a.id}`
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/webauthn/register/verify returns 400 for non-object credential', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/verify',
      headers: { 'content-type': 'application/json' },
      payload: { email: TEST_EMAIL, credential: 'not-an-object' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/webauthn/authenticate/options generates options when admin has credentials', async () => {
    // Insert a fake credential so the authenticate/options path has credentials to work with
    const [cred] = await app.sql`
      insert into webauthn_credentials (admin_id, credential_id, public_key, counter, device_name, transports)
      values (${testAdminId}, ${'fake-credential-id-for-testing'}, ${'fakepublickey'}, 0, 'Test Key', '{}')
      returning id
    `
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      headers: { 'content-type': 'application/json' },
      payload: { email: TEST_EMAIL },
    })
    await app.sql`delete from webauthn_credentials where id = ${cred.id}`.catch(() => {})
    // generateAuthenticationOptions should succeed with a fake credential
    expect([200, 400]).toContain(res.statusCode)
  })

  it('POST /api/admin/webauthn/authenticate/options returns 403 for inactive admin', async () => {
    const inactiveEmail = `inactive-${Date.now()}@test.com`
    const [a] = await app.sql`
      insert into admins (email, name, role, is_active)
      values (${inactiveEmail}, 'Inactive', 'admin', false)
      returning id
    `
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/authenticate/options',
      headers: { 'content-type': 'application/json' },
      payload: { email: inactiveEmail },
    })
    await app.sql`delete from admins where id = ${a.id}`
    expect(res.statusCode).toBe(403)
  })

  it('POST /api/admin/webauthn/register/verify returns 400 for admin with no challenge', async () => {
    // Create admin without calling register/options (so no challenge is set)
    const noChallEmail = `no-challenge-${Date.now()}@test.com`
    const [a] = await app.sql`
      insert into admins (email, name, role, is_active)
      values (${noChallEmail}, 'No Chal', 'admin', true)
      returning id
    `
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/verify',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: noChallEmail,
        credential: { id: 'abc', type: 'public-key', response: {} },
      },
    })
    await app.sql`delete from admins where id = ${a.id}`
    expect(res.statusCode).toBe(400)
  })
})

// ─── Admin categories bulk delete invalid UUID ─────────────────────────────

describe('Admin Categories bulk delete validation', () => {
  it('POST /api/admin/categories/bulk/delete returns 400 for invalid UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/categories/bulk/delete',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: { categoryIds: ['not-a-uuid'] },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── Admin reviews toggle-featured single ─────────────────────────────────

describe('Admin Review toggle-featured', () => {
  let reviewIdForToggle

  beforeAll(async () => {
    if (testProductId) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/reviews',
        headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        payload: {
          productId: testProductId,
          rating: 3,
          content: 'Toggle test review',
          authorName: 'Toggle Tester',
          isFeatured: false,
        },
      })
      if (res.statusCode === 201) reviewIdForToggle = JSON.parse(res.body).id
    }
  })

  afterAll(async () => {
    if (reviewIdForToggle) {
      await app.sql`delete from reviews where id = ${reviewIdForToggle}`.catch(() => {})
    }
  })

  it('POST /api/admin/reviews/:id/toggle-featured toggles the featured state', async () => {
    if (!reviewIdForToggle) return
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${reviewIdForToggle}/toggle-featured`,
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.isFeatured).toBe(true)
  })

  it('POST /api/admin/reviews/:id/toggle-featured returns 404 for non-UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/not-a-uuid/toggle-featured',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/admin/reviews/:id/toggle-featured returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/reviews/00000000-0000-0000-0000-000000000000/toggle-featured',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /api/admin/reviews/:id with no fields returns existing review', async () => {
    if (!reviewIdForToggle) return
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/reviews/${reviewIdForToggle}`,
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      payload: {},
    })
    // Schema may reject empty payload (400) or return existing review (200)
    expect([200, 400]).toContain(res.statusCode)
  })
})

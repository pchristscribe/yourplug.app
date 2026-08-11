import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app.js'
import bcrypt from 'bcryptjs'

// Real-DB integration test (mirrors admin.test.js): the admin/variants routes
// are pure DB CRUD guarded by adminAuth (no CSRF hook), so a session cookie is
// all that's required.
let app
let cookie
let adminId
let categoryId
let productId
const NONEXISTENT_UUID = '00000000-0000-0000-0000-0000000000ff'

beforeAll(async () => {
  app = await buildApp({ logger: false })

  const hash = await bcrypt.hash('TestPass123!', 10)
  const email = `variants-admin-${Date.now()}@example.com`
  const [admin] = await app.sql`
    insert into admins (email, name, role, password_hash, is_active)
    values (${email}, 'Variants Admin', 'admin', ${hash}, true)
    returning id
  `
  adminId = admin.id

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: { email, password: 'TestPass123!' },
  })
  expect(loginRes.statusCode).toBe(200)
  const setCookie = loginRes.headers['set-cookie']
  cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0].trim()

  const [cat] = await app.sql`
    insert into categories (name, slug)
    values ('Variants Test Cat', ${`variants-cat-${Date.now()}`})
    returning id
  `
  categoryId = cat.id

  const [product] = await app.sql`
    insert into products (external_id, platform, title, price, category_id)
    values (${`ext-${Date.now()}`}, 'DHGATE', 'Variant Product', 19.99, ${categoryId})
    returning id
  `
  productId = product.id
})

afterAll(async () => {
  if (productId) await app.sql`delete from product_variants where product_id = ${productId}`.catch(() => {})
  if (productId) await app.sql`delete from products where id = ${productId}`.catch(() => {})
  if (categoryId) await app.sql`delete from categories where id = ${categoryId}`.catch(() => {})
  if (adminId) await app.sql`delete from admins where id = ${adminId}`.catch(() => {})
  await app.close()
})

describe('auth', () => {
  it('returns 401 without a session', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/variants?productId=${productId}` })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/admin/variants', () => {
  it('returns 400 without a productId', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/variants', headers: { cookie } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for a malformed productId', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/variants?productId=not-a-uuid', headers: { cookie } })
    expect(res.statusCode).toBe(400)
  })

  it('returns an empty list for a product with no variants', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/variants?productId=${productId}`, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data).toEqual([])
  })
})

describe('POST /api/admin/variants', () => {
  it('creates a variant (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/variants',
      headers: { cookie },
      payload: { productId, variantType: 'size', value: 'M', isDefault: true },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.value).toBe('M')
    expect(body.isDefault).toBe(true)
  })

  it('returns 409 for a duplicate type/value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/variants',
      headers: { cookie },
      payload: { productId, variantType: 'size', value: 'M' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 404 when the product does not exist (FK violation)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/variants',
      headers: { cookie },
      payload: { productId: NONEXISTENT_UUID, variantType: 'color', value: 'Red' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for an invalid variantType (schema)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/variants',
      headers: { cookie },
      payload: { productId, variantType: 'bogus', value: 'X' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /api/admin/variants/:id', () => {
  let variantId

  beforeAll(async () => {
    const [v] = await app.sql`
      insert into product_variants (product_id, variant_type, value)
      values (${productId}, 'color', 'Blue')
      returning id
    `
    variantId = v.id
  })

  it('returns 404 for a non-UUID id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/admin/variants/not-a-uuid', headers: { cookie }, payload: { value: 'X' } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for an unknown variant', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/admin/variants/${NONEXISTENT_UUID}`, headers: { cookie }, payload: { value: 'X' } })
    expect(res.statusCode).toBe(404)
  })

  it('returns the row unchanged for an empty body', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/admin/variants/${variantId}`, headers: { cookie }, payload: {} })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).id).toBe(variantId)
  })

  it('updates a variant', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/variants/${variantId}`,
      headers: { cookie },
      payload: { value: 'Navy', isDefault: true },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).value).toBe('Navy')
  })
})

describe('PUT /api/admin/variants/bulk', () => {
  it('replaces all variants for a product', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/variants/bulk',
      headers: { cookie },
      payload: {
        productId,
        variants: [
          { variantType: 'size', value: 'S' },
          { variantType: 'size', value: 'L', isDefault: true },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data).toHaveLength(2)
  })

  it('returns 404 for an unknown product', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/variants/bulk',
      headers: { cookie },
      payload: { productId: NONEXISTENT_UUID, variants: [] },
    })
    expect(res.statusCode).toBe(404)
  })

  it('clears variants with an empty array', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/variants/bulk',
      headers: { cookie },
      payload: { productId, variants: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data).toEqual([])
  })
})

describe('DELETE /api/admin/variants/:id', () => {
  it('returns 404 for a non-UUID id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/admin/variants/not-a-uuid', headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for an unknown variant', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/variants/${NONEXISTENT_UUID}`, headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('deletes an existing variant (204)', async () => {
    const [v] = await app.sql`
      insert into product_variants (product_id, variant_type, value)
      values (${productId}, 'material', 'Cotton')
      returning id
    `
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/variants/${v.id}`, headers: { cookie } })
    expect(res.statusCode).toBe(204)
  })
})

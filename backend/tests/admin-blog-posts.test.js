import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app.js'
import bcrypt from 'bcryptjs'

// Real-DB integration test for the admin blog-posts CRUD routes (adminAuth only,
// no CSRF hook). Rows created through the routes are tracked and cleaned up.
let app
let cookie
let adminId
let categoryId
let productId
const createdPostIds = new Set()
const NONEXISTENT_UUID = '00000000-0000-0000-0000-0000000000ff'
const uniq = () => `${Date.now()}-${Math.floor(performance.now() * 1000) % 100000}`

async function createPost(payload) {
  const res = await app.inject({ method: 'POST', url: '/api/admin/blog-posts', headers: { cookie }, payload })
  if (res.statusCode === 201) createdPostIds.add(JSON.parse(res.body).id)
  return res
}

beforeAll(async () => {
  app = await buildApp({ logger: false })

  const hash = await bcrypt.hash('TestPass123!', 10)
  const email = `blog-admin-${uniq()}@example.com`
  const [admin] = await app.sql`
    insert into admins (email, name, role, password_hash, is_active)
    values (${email}, 'Blog Admin', 'admin', ${hash}, true)
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
    insert into categories (name, slug) values ('Blog Cat', ${`blog-cat-${uniq()}`}) returning id
  `
  categoryId = cat.id
  const [product] = await app.sql`
    insert into products (external_id, platform, title, price, category_id)
    values (${`ext-${uniq()}`}, 'AMAZON', 'Blog Product', 9.99, ${categoryId})
    returning id
  `
  productId = product.id
})

afterAll(async () => {
  for (const id of createdPostIds) {
    await app.sql`delete from blog_post_products where blog_post_id = ${id}`.catch(() => {})
    await app.sql`delete from blog_post_categories where blog_post_id = ${id}`.catch(() => {})
    await app.sql`delete from blog_posts where id = ${id}`.catch(() => {})
  }
  if (productId) await app.sql`delete from products where id = ${productId}`.catch(() => {})
  if (categoryId) await app.sql`delete from categories where id = ${categoryId}`.catch(() => {})
  if (adminId) await app.sql`delete from admins where id = ${adminId}`.catch(() => {})
  await app.close()
})

describe('auth', () => {
  it('returns 401 without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/blog-posts' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/admin/blog-posts', () => {
  it('creates a post with product and category links (201)', async () => {
    const res = await createPost({
      slug: `hello-world-${uniq()}`,
      title: 'Hello World',
      content: 'Body content',
      excerpt: 'An excerpt',
      status: 'draft',
      productIds: [productId],
      categoryIds: [categoryId],
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).title).toBe('Hello World')
  })

  it('rejects an invalid slug (400)', async () => {
    const res = await createPost({ slug: 'Not A Slug', title: 'X', content: 'Y' })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 for a duplicate slug', async () => {
    const slug = `dupe-${uniq()}`
    const first = await createPost({ slug, title: 'One', content: 'Body' })
    expect(first.statusCode).toBe(201)
    const second = await createPost({ slug, title: 'Two', content: 'Body' })
    expect(second.statusCode).toBe(409)
  })

  it('returns 400 for invalid product IDs (FK violation)', async () => {
    const res = await createPost({
      slug: `bad-fk-${uniq()}`,
      title: 'Bad FK',
      content: 'Body',
      productIds: [NONEXISTENT_UUID],
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when required fields are missing (schema)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/blog-posts', headers: { cookie }, payload: { slug: 'x' } })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/admin/blog-posts', () => {
  it('lists posts with pagination', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/blog-posts', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.pagination).toHaveProperty('total')
  })

  it('returns 400 for an invalid status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/blog-posts?status=bogus', headers: { cookie } })
    expect(res.statusCode).toBe(400)
  })

  it('filters by status and search with ascending sort', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/blog-posts?status=draft&search=Hello&sortBy=title&order=asc&limit=5',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).pagination.limit).toBe(5)
  })
})

describe('GET /api/admin/blog-posts/:id', () => {
  it('returns 404 for a non-UUID id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/blog-posts/not-a-uuid', headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for an unknown post', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/blog-posts/${NONEXISTENT_UUID}`, headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('returns the post with linked products and categories', async () => {
    const created = await createPost({
      slug: `linked-${uniq()}`,
      title: 'Linked',
      content: 'Body',
      productIds: [productId],
      categoryIds: [categoryId],
    })
    const id = JSON.parse(created.body).id
    const res = await app.inject({ method: 'GET', url: `/api/admin/blog-posts/${id}`, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.linkedProducts).toHaveLength(1)
    expect(body.linkedCategories).toHaveLength(1)
  })
})

describe('PATCH /api/admin/blog-posts/:id', () => {
  let postId

  beforeAll(async () => {
    const res = await createPost({ slug: `to-edit-${uniq()}`, title: 'Editable', content: 'Body' })
    postId = JSON.parse(res.body).id
  })

  it('returns 404 for a non-UUID id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/admin/blog-posts/not-a-uuid', headers: { cookie }, payload: { title: 'X' } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for an unknown post', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/admin/blog-posts/${NONEXISTENT_UUID}`, headers: { cookie }, payload: { title: 'X' } })
    expect(res.statusCode).toBe(404)
  })

  it('rejects an invalid slug (400)', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/admin/blog-posts/${postId}`, headers: { cookie }, payload: { slug: 'Bad Slug' } })
    expect(res.statusCode).toBe(400)
  })

  it('updates fields and resets link tables', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/blog-posts/${postId}`,
      headers: { cookie },
      payload: { title: 'Edited Title', seoTitle: 'SEO', productIds: [productId], categoryIds: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).title).toBe('Edited Title')
  })

  it('accepts a metadata-only update with no writable fields', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/blog-posts/${postId}`,
      headers: { cookie },
      payload: { productIds: [] },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('publish / unpublish', () => {
  let postId

  beforeAll(async () => {
    const res = await createPost({ slug: `pub-${uniq()}`, title: 'Publishable', content: 'Body' })
    postId = JSON.parse(res.body).id
  })

  it('returns 404 to publish a non-UUID id', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/blog-posts/not-a-uuid/publish', headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('publishes a post', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/admin/blog-posts/${postId}/publish`, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('published')
  })

  it('returns 404 to publish an unknown post', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/admin/blog-posts/${NONEXISTENT_UUID}/publish`, headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('unpublishes a post', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/admin/blog-posts/${postId}/unpublish`, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('draft')
  })

  it('returns 404 to unpublish an unknown post', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/admin/blog-posts/${NONEXISTENT_UUID}/unpublish`, headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/admin/blog-posts/:id', () => {
  it('returns 404 for a non-UUID id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/admin/blog-posts/not-a-uuid', headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for an unknown post', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/blog-posts/${NONEXISTENT_UUID}`, headers: { cookie } })
    expect(res.statusCode).toBe(404)
  })

  it('deletes an existing post (204)', async () => {
    const created = await createPost({ slug: `to-delete-${uniq()}`, title: 'Delete Me', content: 'Body' })
    const id = JSON.parse(created.body).id
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/blog-posts/${id}`, headers: { cookie } })
    expect(res.statusCode).toBe(204)
    createdPostIds.delete(id)
  })
})

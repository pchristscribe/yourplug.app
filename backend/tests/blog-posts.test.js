import { describe, it, expect, vi } from 'vitest'

const { buildApp } = await import('../src/app.js')

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

function makeRedis(overrides = {}) {
  const redis = {
    defineCommand(name) {
      redis[name] = (...args) => {
        const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null
        const result = [0, 60000]
        if (cb) return cb(null, result)
        return Promise.resolve(result)
      }
    },
    on: () => {},
    status: 'ready',
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    ...overrides,
  }
  return redis
}

function makeApp({ queryHandler, redis } = {}) {
  const sql = Object.assign(
    vi.fn(async (strings, ...values) => {
      const query = Array.isArray(strings) ? strings.join('') : String(strings ?? '')
      if (queryHandler) {
        const result = await queryHandler(query, values)
        if (result !== undefined) return result
      }
      return []
    }),
    { json: v => v }
  )
  return buildApp({ sql, redis: redis || makeRedis(), logger: false })
}

describe('GET /api/blog-posts', () => {
  it('returns paginated published posts', async () => {
    const post = {
      id: VALID_UUID,
      slug: 'pride-picks',
      title: 'Pride Picks',
      excerpt: 'Our favourites',
      published_at: '2026-07-01T00:00:00Z',
    }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('count(distinct bp.id)')) return [{ count: 1 }]
        if (query.includes('from blog_posts bp')) return [post]
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.pagination.pages).toBe(1)
    await app.close()
  })

  it('clamps limit and page to safe bounds', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('count(distinct bp.id)')) return [{ count: 0 }]
        if (query.includes('from blog_posts bp')) return []
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts?page=-5&limit=999' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(50)
    await app.close()
  })

  it('filters by categoryId when a valid UUID is supplied', async () => {
    let sawJoin = false
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('blog_post_categories')) sawJoin = true
        if (query.includes('count(distinct bp.id)')) return [{ count: 0 }]
        if (query.includes('from blog_posts bp')) return []
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: `/api/blog-posts?categoryId=${VALID_UUID}` })
    expect(res.statusCode).toBe(200)
    expect(sawJoin).toBe(true)
    await app.close()
  })

  it('returns 400 for an invalid categoryId', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts?categoryId=not-a-uuid' })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('serves a cached list without hitting the database', async () => {
    const cached = JSON.stringify({ data: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } })
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(cached) })
    let blogQueried = false
    const app = await makeApp({
      redis,
      queryHandler: (query) => { if (query.includes('blog_posts')) blogQueried = true; return undefined },
    })
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts' })
    expect(res.statusCode).toBe(200)
    expect(blogQueried).toBe(false)
    await app.close()
  })
})

describe('GET /api/blog-posts/:slug', () => {
  it('returns a post with linked products and categories', async () => {
    const post = { id: VALID_UUID, slug: 'pride-picks', title: 'Pride Picks', status: 'published' }
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from blog_posts')) return [post]
        if (query.includes('blog_post_products')) return [{ id: 'p1', title: 'Flag' }]
        if (query.includes('blog_post_categories')) return [{ id: 'c1', name: 'Pride' }]
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts/pride-picks' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.slug).toBe('pride-picks')
    expect(body.linkedProducts).toHaveLength(1)
    expect(body.linkedCategories).toHaveLength(1)
    await app.close()
  })

  it('returns 404 for a slug with illegal characters', async () => {
    const app = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts/Bad_Slug!' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('returns 404 when the post does not exist', async () => {
    const app = await makeApp({
      queryHandler: (query) => {
        if (query.includes('from blog_posts')) return []
        return undefined
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts/missing-post' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('serves a cached post without hitting the database', async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify({ id: VALID_UUID, slug: 'cached' })) })
    let blogQueried = false
    const app = await makeApp({
      redis,
      queryHandler: (query) => { if (query.includes('blog_posts')) blogQueried = true; return undefined },
    })
    const res = await app.inject({ method: 'GET', url: '/api/blog-posts/cached' })
    expect(res.statusCode).toBe(200)
    expect(blogQueried).toBe(false)
    await app.close()
  })
})

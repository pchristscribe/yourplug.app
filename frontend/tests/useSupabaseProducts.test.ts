import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSupabaseProducts } from '../app/composables/useSupabaseProducts'

// Flexible chainable mock — resolvedData is set per-test before awaiting
let resolvedData: { data?: unknown; error?: unknown; count?: number } = { data: [], error: null, count: 0 }

type ChainMethod = 'select' | 'eq' | 'or' | 'order' | 'range' | 'gte' | 'lte' | 'contains' | 'single'

// Make the chain thenable so `await chain.order(...)` works for queries like
// getCategories() that don't call .range() or .single() at the end.
const mockChain: Record<ChainMethod, ReturnType<typeof vi.fn>> & {
  then: (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => Promise<unknown>
} = {
  select: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  contains: vi.fn(),
  single: vi.fn(),
  then: (resolve, reject) =>
    Promise.resolve({
      data: resolvedData.data ?? null,
      error: resolvedData.error ?? null,
      count: resolvedData.count ?? 0,
    }).then(resolve, reject),
}
const chainMethods: ChainMethod[] = ['select', 'eq', 'or', 'order', 'range', 'gte', 'lte', 'contains', 'single']
for (const m of chainMethods) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.stubGlobal('useSupabaseClient', () => ({ from: () => mockChain }))

function resetChain() {
  for (const m of chainMethods) {
    mockChain[m].mockClear()
    mockChain[m].mockReturnValue(mockChain)
  }
  // .range() and .single() return real Promises so they don't use the thenable path
  mockChain.range.mockImplementation(() =>
    Promise.resolve({ data: resolvedData.data ?? [], error: resolvedData.error ?? null, count: resolvedData.count ?? 0 })
  )
  mockChain.single.mockImplementation(() =>
    Promise.resolve({ data: resolvedData.data ?? null, error: resolvedData.error ?? null })
  )
}

beforeEach(() => {
  resolvedData = { data: [], error: null, count: 0 }
  resetChain()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    id: 'p1',
    external_id: 'ext1',
    platform: 'DHGATE',
    title: 'Test Product',
    description: 'A product',
    image_url: 'https://example.com/img.jpg',
    price: 29.99,
    currency: 'USD',
    price_updated_at: '2025-01-01T00:00:00Z',
    category_id: 'c1',
    categories: null,
    status: 'ACTIVE',
    rating: 4.5,
    review_count: 10,
    tags: ['tag1'],
    metadata: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCategory(overrides = {}) {
  return {
    id: 'c1',
    name: 'Swords',
    slug: 'swords',
    description: 'All swords',
    image_url: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ─── getProducts ─────────────────────────────────────────────────────────────

describe('getProducts', () => {
  it('returns mapped products and pagination with no filters', async () => {
    const product = makeProduct()
    resolvedData = { data: [product], error: null, count: 1 }
    resetChain()

    const { getProducts } = useSupabaseProducts()
    const result = await getProducts()

    expect(result.products).toHaveLength(1)
    expect(result.products[0].id).toBe('p1')
    expect(result.products[0].platform).toBe('DHGATE')
    expect(result.pagination.total).toBe(1)
    expect(result.pagination.pages).toBe(1)
  })

  it('defaults to ACTIVE status when no status filter provided', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts()
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'ACTIVE')
  })

  it('applies status filter when provided', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ status: 'INACTIVE' })
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'INACTIVE')
  })

  it('applies platform filter', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ platform: 'AMAZON' })
    expect(mockChain.eq).toHaveBeenCalledWith('platform', 'AMAZON')
  })

  it('applies categoryId filter', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ categoryId: 'cat-123' })
    expect(mockChain.eq).toHaveBeenCalledWith('category_id', 'cat-123')
  })

  it('applies minPrice filter', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ minPrice: 10 })
    expect(mockChain.gte).toHaveBeenCalledWith('price', 10)
  })

  it('applies maxPrice filter', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ maxPrice: 100 })
    expect(mockChain.lte).toHaveBeenCalledWith('price', 100)
  })

  it('applies minRating filter', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ minRating: 4 })
    expect(mockChain.gte).toHaveBeenCalledWith('rating', 4)
  })

  it('applies tag filter via contains', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ tag: 'summer' })
    expect(mockChain.contains).toHaveBeenCalledWith('tags', ['summer'])
  })

  it('sorts by price when sortBy=price', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ sortBy: 'price' })
    expect(mockChain.order).toHaveBeenCalledWith('price', expect.any(Object))
  })

  it('sorts by rating when sortBy=rating', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ sortBy: 'rating' })
    expect(mockChain.order).toHaveBeenCalledWith('rating', expect.any(Object))
  })

  it('sorts ascending when order=asc', async () => {
    resolvedData = { data: [], error: null, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await getProducts({ order: 'asc' })
    expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('calculates pagination correctly for page 2', async () => {
    resolvedData = { data: [], error: null, count: 45 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    const result = await getProducts({ page: 2, limit: 20 })
    expect(result.pagination.page).toBe(2)
    expect(result.pagination.pages).toBe(3)
    expect(result.pagination.total).toBe(45)
  })

  it('throws when supabase returns an error', async () => {
    resolvedData = { data: null, error: { message: 'DB error' }, count: 0 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    await expect(getProducts()).rejects.toThrow('DB error')
  })

  it('maps product with nested category', async () => {
    const product = makeProduct({ categories: makeCategory() })
    resolvedData = { data: [product], error: null, count: 1 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    const result = await getProducts()
    expect(result.products[0].category?.name).toBe('Swords')
  })

  it('maps product with null rating to undefined', async () => {
    const product = makeProduct({ rating: null })
    resolvedData = { data: [product], error: null, count: 1 }
    resetChain()
    const { getProducts } = useSupabaseProducts()
    const result = await getProducts()
    expect(result.products[0].rating).toBeUndefined()
  })
})

// ─── getProduct ──────────────────────────────────────────────────────────────

describe('getProduct', () => {
  it('returns a mapped product', async () => {
    const product = makeProduct({ affiliate_links: [], reviews: [] })
    resolvedData = { data: product, error: null }
    resetChain()
    const { getProduct } = useSupabaseProducts()
    const result = await getProduct('p1')
    expect(result.id).toBe('p1')
    expect(result.title).toBe('Test Product')
  })

  it('maps affiliate links', async () => {
    const product = makeProduct({
      affiliate_links: [{
        id: 'al1',
        product_id: 'p1',
        original_url: 'https://dhgate.com/product',
        tracked_url: 'https://dub.co/xyz',
        dub_link_id: null,
        clicks: 5,
        conversions: 1,
        revenue: 9.99,
        last_clicked_at: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }],
      reviews: [],
    })
    resolvedData = { data: product, error: null }
    resetChain()
    const { getProduct } = useSupabaseProducts()
    const result = await getProduct('p1')
    expect(result.affiliateLinks).toHaveLength(1)
    expect(result.affiliateLinks![0].clicks).toBe(5)
  })

  it('maps and sorts reviews — featured first', async () => {
    const product = makeProduct({
      affiliate_links: [],
      reviews: [
        { id: 'r2', product_id: 'p1', rating: 4, title: null, content: 'Good', pros: [], cons: [], author_name: 'Bob', is_featured: false, created_at: '2025-02-01T00:00:00Z', updated_at: '2025-02-01T00:00:00Z' },
        { id: 'r1', product_id: 'p1', rating: 5, title: 'Great', content: 'Excellent', pros: ['solid'], cons: [], author_name: 'Alice', is_featured: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
      ],
    })
    resolvedData = { data: product, error: null }
    resetChain()
    const { getProduct } = useSupabaseProducts()
    const result = await getProduct('p1')
    expect(result.reviews![0].isFeatured).toBe(true)
    expect(result.reviews![0].id).toBe('r1')
  })

  it('throws when supabase returns an error', async () => {
    resolvedData = { data: null, error: { message: 'Not found' } }
    resetChain()
    const { getProduct } = useSupabaseProducts()
    await expect(getProduct('bad-id')).rejects.toThrow('Not found')
  })

  it('throws when product is null', async () => {
    resolvedData = { data: null, error: null }
    resetChain()
    const { getProduct } = useSupabaseProducts()
    await expect(getProduct('missing')).rejects.toThrow('Product not found')
  })
})

// ─── getCategories ───────────────────────────────────────────────────────────

describe('getCategories', () => {
  it('returns mapped categories with product count', async () => {
    const cat = { ...makeCategory(), products: [{ count: 7 }] }
    resolvedData = { data: [cat], error: null }
    resetChain()
    const { getCategories } = useSupabaseProducts()
    const result = await getCategories()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Swords')
    expect(result[0]._count!.products).toBe(7)
  })

  it('returns 0 product count when products array is empty', async () => {
    const cat = { ...makeCategory(), products: [] }
    resolvedData = { data: [cat], error: null }
    resetChain()
    const { getCategories } = useSupabaseProducts()
    const result = await getCategories()
    expect(result[0]._count!.products).toBe(0)
  })

  it('maps optional description and imageUrl to undefined when null', async () => {
    const cat = { ...makeCategory(), description: null, image_url: null, products: [] }
    resolvedData = { data: [cat], error: null }
    resetChain()
    const { getCategories } = useSupabaseProducts()
    const result = await getCategories()
    expect(result[0].description).toBeUndefined()
    expect(result[0].imageUrl).toBeUndefined()
  })

  it('throws when supabase returns an error', async () => {
    resolvedData = { data: null, error: { message: 'Categories error' } }
    resetChain()
    const { getCategories } = useSupabaseProducts()
    await expect(getCategories()).rejects.toThrow('Categories error')
  })
})

// ─── getCategory ─────────────────────────────────────────────────────────────

describe('getCategory', () => {
  it('fetches by slug when identifier is not a UUID', async () => {
    resolvedData = { data: makeCategory(), error: null }
    resetChain()
    const { getCategory } = useSupabaseProducts()
    await getCategory('swords')
    expect(mockChain.eq).toHaveBeenCalledWith('slug', 'swords')
  })

  it('fetches by id when identifier is a UUID', async () => {
    resolvedData = { data: makeCategory({ id: 'c1' }), error: null }
    resetChain()
    const { getCategory } = useSupabaseProducts()
    await getCategory('00000000-0000-0000-0000-000000000001')
    expect(mockChain.eq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000001')
  })

  it('returns mapped category', async () => {
    resolvedData = { data: makeCategory(), error: null }
    resetChain()
    const { getCategory } = useSupabaseProducts()
    const result = await getCategory('swords')
    expect(result.slug).toBe('swords')
  })

  it('throws when supabase returns an error', async () => {
    resolvedData = { data: null, error: { message: 'Category error' } }
    resetChain()
    const { getCategory } = useSupabaseProducts()
    await expect(getCategory('swords')).rejects.toThrow('Category error')
  })

  it('throws when category is null', async () => {
    resolvedData = { data: null, error: null }
    resetChain()
    const { getCategory } = useSupabaseProducts()
    await expect(getCategory('missing')).rejects.toThrow('Category not found')
  })
})

// ─── searchProducts sanitization (existing tests preserved) ──────────────────

function lastOrArg(): string {
  const call = mockChain.or.mock.lastCall
  return call ? (call[0] as string) : ''
}

describe('searchProducts sanitization', () => {
  it('passes a normal query through unchanged', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('sword fighter')
    expect(lastOrArg()).toBe(
      'title.ilike.%sword fighter%,description.ilike.%sword fighter%'
    )
  })

  it('escapes % LIKE wildcard', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('%foo%')
    expect(lastOrArg()).toContain('ilike.%\\%foo\\%%')
  })

  it('escapes _ LIKE wildcard', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('_abc')
    expect(lastOrArg()).toContain('ilike.%\\_abc%')
  })

  it('escapes backslash', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('foo\\bar')
    expect(lastOrArg()).toContain('ilike.%foo\\\\bar%')
  })

  it('strips PostgREST comma separator', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('title,description')
    expect(lastOrArg()).toContain('ilike.%title description%')
  })

  it('strips PostgREST parentheses', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('(evil)')
    expect(lastOrArg()).toContain('ilike.% evil %')
  })

  it('handles a query of only special chars without throwing', async () => {
    const { searchProducts } = useSupabaseProducts()
    await expect(searchProducts('%_\\,()')).resolves.toBeDefined()
    expect(mockChain.or).toHaveBeenCalled()
  })

  it('handles empty string without throwing', async () => {
    const { searchProducts } = useSupabaseProducts()
    await expect(searchProducts('')).resolves.toBeDefined()
    expect(lastOrArg()).toBe('title.ilike.%%,description.ilike.%%')
  })

  it('returns pagination metadata for search results', async () => {
    resolvedData = { data: [makeProduct()], error: null, count: 1 }
    resetChain()
    const { searchProducts } = useSupabaseProducts()
    const result = await searchProducts('sword', { page: 1, limit: 10 })
    expect(result.pagination.total).toBe(1)
    expect(result.products).toHaveLength(1)
  })

  it('throws when supabase returns an error', async () => {
    resolvedData = { data: null, error: { message: 'Search error' }, count: 0 }
    resetChain()
    const { searchProducts } = useSupabaseProducts()
    await expect(searchProducts('query')).rejects.toThrow('Search error')
  })
})

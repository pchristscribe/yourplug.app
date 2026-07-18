import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSupabaseAdmin } from '../app/composables/useSupabaseAdmin'

// Flexible chainable mock, following the pattern established in
// frontend/tests/useSupabaseProducts.test.ts — every method but `single`
// returns the same thenable chain object, so any call sequence resolves
// correctly regardless of how many .eq()/.order() calls are chained.
let resolvedData: { data?: unknown; error?: unknown; count?: number } = { data: [], error: null, count: 0 }

type ChainMethod = 'select' | 'insert' | 'update' | 'delete' | 'eq' | 'order' | 'range' | 'single'

const mockChain: Record<ChainMethod, ReturnType<typeof vi.fn>> & {
  then: (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => Promise<unknown>
} = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  single: vi.fn(),
  then: (resolve, reject) =>
    Promise.resolve({
      data: resolvedData.data ?? null,
      error: resolvedData.error ?? null,
      count: resolvedData.count ?? 0,
    }).then(resolve, reject),
}
const chainMethods: ChainMethod[] = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'range', 'single']

function resetChain() {
  for (const m of chainMethods) {
    mockChain[m].mockClear()
    mockChain[m].mockReturnValue(mockChain)
  }
  // .single() is always the terminal call in this composable, so it resolves
  // as a real Promise instead of going through the thenable chain object.
  mockChain.single.mockImplementation(() =>
    Promise.resolve({ data: resolvedData.data ?? null, error: resolvedData.error ?? null })
  )
}

const fromSpy = vi.fn(() => mockChain)
vi.stubGlobal('useSupabaseClient', () => ({ from: fromSpy }))

beforeEach(() => {
  resolvedData = { data: [], error: null, count: 0 }
  fromSpy.mockClear()
  resetChain()
})

function makeProductRow(overrides = {}) {
  return {
    id: 'p1',
    external_id: 'ext1',
    platform: 'DHGATE',
    title: 'Test Product',
    description: 'A product',
    image_url: 'https://example.com/img.jpg',
    price: 29.99,
    currency: 'USD',
    category_id: 'c1',
    status: 'ACTIVE',
    rating: 4.5,
    review_count: 10,
    tags: ['tag1'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('useSupabaseAdmin — products', () => {
  it('listProducts maps rows and returns pagination metadata', async () => {
    resolvedData = { data: [makeProductRow()], error: null, count: 1 }
    const { listProducts } = useSupabaseAdmin()

    const result = await listProducts({ page: 2, limit: 10 })

    expect(fromSpy).toHaveBeenCalledWith('products')
    expect(mockChain.range).toHaveBeenCalledWith(10, 19)
    expect(result).toEqual({
      products: [expect.objectContaining({ id: 'p1', externalId: 'ext1', imageUrl: 'https://example.com/img.jpg' })],
      total: 1,
      page: 2,
      limit: 10,
    })
  })

  it('listProducts applies status/platform/categoryId filters only when provided', async () => {
    const { listProducts } = useSupabaseAdmin()

    await listProducts({ status: 'ACTIVE', platform: 'DHGATE', categoryId: 'c1' })

    expect(mockChain.eq).toHaveBeenCalledWith('status', 'ACTIVE')
    expect(mockChain.eq).toHaveBeenCalledWith('platform', 'DHGATE')
    expect(mockChain.eq).toHaveBeenCalledWith('category_id', 'c1')
  })

  it('listProducts throws with the Supabase error message on failure', async () => {
    resolvedData = { data: null, error: { message: 'connection refused' } }
    const { listProducts } = useSupabaseAdmin()

    await expect(listProducts()).rejects.toThrow('connection refused')
  })

  it('createProduct inserts and maps the returned row', async () => {
    resolvedData = { data: makeProductRow({ id: 'new-1' }), error: null }
    const { createProduct } = useSupabaseAdmin()

    const result = await createProduct({ title: 'New Product' } as any)

    expect(mockChain.insert).toHaveBeenCalledWith({ title: 'New Product' })
    expect(result.id).toBe('new-1')
  })

  it('updateProduct stamps updated_at and maps the returned row', async () => {
    resolvedData = { data: makeProductRow({ title: 'Updated' }), error: null }
    const { updateProduct } = useSupabaseAdmin()

    await updateProduct('p1', { title: 'Updated' })

    const updateArg = mockChain.update.mock.calls[0][0]
    expect(updateArg.title).toBe('Updated')
    expect(typeof updateArg.updated_at).toBe('string')
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('updateProductStatus delegates to updateProduct with just the status field', async () => {
    resolvedData = { data: makeProductRow({ status: 'INACTIVE' }), error: null }
    const { updateProductStatus } = useSupabaseAdmin()

    const result = await updateProductStatus('p1', 'INACTIVE')

    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' }))
    expect(result.status).toBe('INACTIVE')
  })

  it('deleteProduct throws on error and resolves silently on success', async () => {
    const { deleteProduct } = useSupabaseAdmin()
    await expect(deleteProduct('p1')).resolves.toBeUndefined()
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'p1')

    resolvedData = { data: null, error: { message: 'not found' } }
    await expect(deleteProduct('missing')).rejects.toThrow('not found')
  })
})

describe('useSupabaseAdmin — categories', () => {
  it('listCategories maps rows including the nested product count', async () => {
    resolvedData = {
      data: [
        {
          id: 'c1',
          name: 'Harnesses',
          slug: 'harnesses',
          description: null,
          image_url: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          products: [{ count: 3 }],
        },
      ],
      error: null,
    }
    const { listCategories } = useSupabaseAdmin()

    const result = await listCategories()

    expect(fromSpy).toHaveBeenCalledWith('categories')
    expect(result[0]).toEqual(
      expect.objectContaining({ id: 'c1', name: 'Harnesses', productCount: 3 })
    )
  })

  it('listCategories defaults productCount to 0 when no products relation is returned', async () => {
    resolvedData = {
      data: [
        {
          id: 'c1',
          name: 'Harnesses',
          slug: 'harnesses',
          description: null,
          image_url: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          products: [],
        },
      ],
      error: null,
    }
    const { listCategories } = useSupabaseAdmin()

    const result = await listCategories()
    expect(result[0].productCount).toBe(0)
  })

  it('createCategory inserts and shapes the returned row', async () => {
    resolvedData = {
      data: {
        id: 'c2',
        name: 'Toys',
        slug: 'toys',
        description: null,
        image_url: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      error: null,
    }
    const { createCategory } = useSupabaseAdmin()

    const result = await createCategory({ name: 'Toys', slug: 'toys' } as any)
    expect(result).toEqual({
      id: 'c2',
      name: 'Toys',
      slug: 'toys',
      description: null,
      imageUrl: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    })
  })

  it('deleteCategory throws with the Supabase error message on failure', async () => {
    resolvedData = { data: null, error: { message: 'has products' } }
    const { deleteCategory } = useSupabaseAdmin()

    await expect(deleteCategory('c1')).rejects.toThrow('has products')
  })
})

describe('useSupabaseAdmin — analytics', () => {
  it('getAffiliateStats sums clicks/conversions/revenue across rows', async () => {
    resolvedData = {
      data: [
        { clicks: 10, conversions: 2, revenue: 100 },
        { clicks: 5, conversions: 1, revenue: 50 },
      ],
      error: null,
    }
    const { getAffiliateStats } = useSupabaseAdmin()

    const result = await getAffiliateStats()
    expect(result).toEqual({ totalClicks: 15, totalConversions: 3, totalRevenue: 150 })
  })

  it('getAffiliateStats returns zeros when there is no data', async () => {
    resolvedData = { data: [], error: null }
    const { getAffiliateStats } = useSupabaseAdmin()

    const result = await getAffiliateStats()
    expect(result).toEqual({ totalClicks: 0, totalConversions: 0, totalRevenue: 0 })
  })
})

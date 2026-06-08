import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProductStore } from '../app/stores/products'

const mockGetProducts = vi.fn()
const mockGetProduct = vi.fn()
const mockGetCategories = vi.fn()

const mockUseSupabaseProducts = vi.fn(() => ({
  getProducts: mockGetProducts,
  getProduct: mockGetProduct,
  getCategories: mockGetCategories,
  searchProducts: vi.fn().mockResolvedValue([]),
}))

vi.stubGlobal('useSupabaseProducts', mockUseSupabaseProducts)

const samplePagination = { page: 1, limit: 20, total: 1, pages: 1 }
const sampleProduct = {
  id: '1',
  title: 'Test Product',
  platform: 'DHGATE',
  price: 29.99,
  description: 'Test description',
  imageUrl: 'https://example.com/image.jpg',
}
const sampleCategory = { id: '1', name: 'Test Category', slug: 'test-category' }

describe('Product Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetProducts.mockResolvedValue({ products: [sampleProduct], pagination: samplePagination })
    mockGetProduct.mockResolvedValue(sampleProduct)
    mockGetCategories.mockResolvedValue([sampleCategory])
  })

  // ─── Initial state ──────────────────────────────────────────────────────────

  it('initializes with correct default state', () => {
    const store = useProductStore()
    expect(store.products).toEqual([])
    expect(store.currentProduct).toBeNull()
    expect(store.categories).toEqual([])
    expect(store.pagination).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  // ─── fetchProducts ──────────────────────────────────────────────────────────

  it('fetchProducts sets products and pagination on success', async () => {
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.products).toHaveLength(1)
    expect(store.products[0].title).toBe('Test Product')
    expect(store.pagination?.total).toBe(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchProducts merges provided filters with stored filters', async () => {
    const store = useProductStore()
    await store.fetchProducts({ platform: 'AMAZON', page: 2 })
    expect(mockGetProducts).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'AMAZON', page: 2 })
    )
    expect(store.filters.platform).toBe('AMAZON')
    expect(store.filters.page).toBe(2)
  })

  it('fetchProducts sets error string on Error throw', async () => {
    mockGetProducts.mockRejectedValue(new Error('Network failure'))
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.error).toBe('Network failure')
    expect(store.loading).toBe(false)
  })

  it('fetchProducts sets fallback error on non-Error throw', async () => {
    mockGetProducts.mockRejectedValue('unexpected')
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.error).toBe('Failed to fetch products')
    expect(store.loading).toBe(false)
  })

  // ─── fetchProduct ───────────────────────────────────────────────────────────

  it('fetchProduct sets currentProduct on success', async () => {
    const store = useProductStore()
    await store.fetchProduct('1')
    expect(store.currentProduct?.title).toBe('Test Product')
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchProduct sets error string on Error throw', async () => {
    mockGetProduct.mockRejectedValue(new Error('Product gone'))
    const store = useProductStore()
    await store.fetchProduct('bad-id')
    expect(store.error).toBe('Product gone')
    expect(store.loading).toBe(false)
  })

  it('fetchProduct sets fallback error on non-Error throw', async () => {
    mockGetProduct.mockRejectedValue(42)
    const store = useProductStore()
    await store.fetchProduct('bad-id')
    expect(store.error).toBe('Failed to fetch product')
  })

  // ─── fetchCategories ────────────────────────────────────────────────────────

  it('fetchCategories sets categories on success', async () => {
    const store = useProductStore()
    await store.fetchCategories()
    expect(store.categories).toHaveLength(1)
    expect(store.categories[0].name).toBe('Test Category')
  })

  it('fetchCategories silently catches errors', async () => {
    mockGetCategories.mockRejectedValue(new Error('cat error'))
    const store = useProductStore()
    await store.fetchCategories()
    expect(store.categories).toEqual([])
  })

  // ─── setFilters / resetFilters ──────────────────────────────────────────────

  it('setFilters merges new filters', () => {
    const store = useProductStore()
    store.setFilters({ platform: 'DHGATE', page: 2 })
    expect(store.filters.platform).toBe('DHGATE')
    expect(store.filters.page).toBe(2)
    expect(store.filters.sortBy).toBe('createdAt')
  })

  it('resetFilters restores defaults', () => {
    const store = useProductStore()
    store.setFilters({ platform: 'DHGATE', page: 3 })
    store.resetFilters()
    expect(store.filters.platform).toBeUndefined()
    expect(store.filters.page).toBe(1)
    expect(store.filters.order).toBe('desc')
  })

  // ─── Getters ────────────────────────────────────────────────────────────────

  it('getProductById returns the matching product', async () => {
    const store = useProductStore()
    await store.fetchProducts()
    const found = store.getProductById('1')
    expect(found?.title).toBe('Test Product')
  })

  it('getProductById returns undefined for unknown id', async () => {
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.getProductById('999')).toBeUndefined()
  })

  it('hasMore returns false when pagination is null', () => {
    const store = useProductStore()
    expect(store.hasMore).toBe(false)
  })

  it('hasMore returns true when there are more pages', async () => {
    mockGetProducts.mockResolvedValue({
      products: [sampleProduct],
      pagination: { page: 1, limit: 20, total: 50, pages: 3 },
    })
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.hasMore).toBe(true)
  })

  it('hasMore returns false on the last page', async () => {
    mockGetProducts.mockResolvedValue({
      products: [sampleProduct],
      pagination: { page: 3, limit: 20, total: 50, pages: 3 },
    })
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.hasMore).toBe(false)
  })

  it('totalProducts returns 0 when pagination is null', () => {
    const store = useProductStore()
    expect(store.totalProducts).toBe(0)
  })

  it('totalProducts returns pagination total', async () => {
    mockGetProducts.mockResolvedValue({
      products: [sampleProduct],
      pagination: { page: 1, limit: 20, total: 42, pages: 3 },
    })
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.totalProducts).toBe(42)
  })
})

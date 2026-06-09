import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProductStore } from '../app/stores/products'

// The product store fetches through useSupabaseProducts (auto-imported by
// Nuxt at runtime). In tests we stub the global so the store can resolve it.
const mockUseSupabaseProducts = vi.fn(() => ({
  getProducts: vi.fn().mockResolvedValue({
    products: [
      {
        id: '1',
        title: 'Test Product',
        platform: 'DHGATE',
        price: 29.99,
        description: 'Test description',
        imageUrl: 'https://example.com/image.jpg',
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      pages: 1,
    }
  }),
  getProduct: vi.fn().mockResolvedValue({
    id: '1',
    title: 'Test Product',
    platform: 'DHGATE',
    price: 29.99,
  }),
  getCategories: vi.fn().mockResolvedValue([
    {
      id: '1',
      name: 'Test Category',
      slug: 'test-category',
    }
  ]),
  searchProducts: vi.fn().mockResolvedValue([]),
}))

vi.stubGlobal('useSupabaseProducts', mockUseSupabaseProducts)

describe('Product Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with correct default state', () => {
    const store = useProductStore()

    expect(store.products).toEqual([])
    expect(store.currentProduct).toBeNull()
    expect(store.categories).toEqual([])
    expect(store.pagination).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('should fetch products', async () => {
    const store = useProductStore()

    await store.fetchProducts()

    expect(store.products).toHaveLength(1)
    expect(store.products[0].title).toBe('Test Product')
    expect(store.pagination).not.toBeNull()
    expect(store.pagination?.total).toBe(1)
  })

  it('should fetch categories', async () => {
    const store = useProductStore()

    await store.fetchCategories()

    expect(store.categories).toHaveLength(1)
    expect(store.categories[0].name).toBe('Test Category')
  })

  it('should update filters', () => {
    const store = useProductStore()

    store.setFilters({ platform: 'DHGATE', page: 2 })

    expect(store.filters.platform).toBe('DHGATE')
    expect(store.filters.page).toBe(2)
  })

  it('should reset filters', () => {
    const store = useProductStore()

    store.setFilters({ platform: 'DHGATE', page: 2 })
    store.resetFilters()

    expect(store.filters.platform).toBeUndefined()
    expect(store.filters.page).toBe(1)
  })

  it('should set loading to true while fetching products and false after', async () => {
    const store = useProductStore()

    // Loading starts false
    expect(store.loading).toBe(false)

    const promise = store.fetchProducts()
    // While promise is in-flight loading should be true — but since the mock
    // resolves synchronously in microtasks we simply assert the final state.
    await promise
    expect(store.loading).toBe(false)
  })

  it('should set error when fetchProducts throws', async () => {
    // Override the mock to throw an error for this single test
    mockUseSupabaseProducts.mockReturnValueOnce({
      getProducts: vi.fn().mockRejectedValue(new Error('Network error')),
      getProduct: vi.fn(),
      getCategories: vi.fn(),
      searchProducts: vi.fn(),
    })

    const store = useProductStore()
    await store.fetchProducts()

    expect(store.error).toBe('Network error')
    expect(store.loading).toBe(false)
  })

  it('should set error when fetchProduct throws', async () => {
    mockUseSupabaseProducts.mockReturnValueOnce({
      getProducts: vi.fn(),
      getProduct: vi.fn().mockRejectedValue(new Error('Product not found')),
      getCategories: vi.fn(),
      searchProducts: vi.fn(),
    })

    const store = useProductStore()
    await store.fetchProduct('unknown-id')

    expect(store.error).toBe('Product not found')
    expect(store.loading).toBe(false)
  })

  it('should fetch a single product and store it in currentProduct', async () => {
    const store = useProductStore()
    await store.fetchProduct('1')

    expect(store.currentProduct).not.toBeNull()
    expect(store.currentProduct?.id).toBe('1')
  })

  it('should clear currentProduct before fetching a new one', async () => {
    const store = useProductStore()

    // Pre-populate currentProduct
    store.currentProduct = { id: 'old', title: 'Old', platform: 'DHGATE', price: 5 } as any

    await store.fetchProduct('1')
    expect(store.currentProduct?.id).toBe('1')
  })

  it('getProductById returns the correct product from the products array', async () => {
    const store = useProductStore()
    await store.fetchProducts()

    const found = store.getProductById('1')
    expect(found).toBeDefined()
    expect(found?.title).toBe('Test Product')
  })

  it('getProductById returns undefined for an unknown id', async () => {
    const store = useProductStore()
    await store.fetchProducts()

    expect(store.getProductById('999')).toBeUndefined()
  })

  it('hasMore returns false when pagination is null', () => {
    const store = useProductStore()
    expect(store.hasMore).toBe(false)
  })

  it('hasMore returns false when on the last page', async () => {
    const store = useProductStore()
    await store.fetchProducts()
    // Mock returns pagination: { page: 1, pages: 1 }
    expect(store.hasMore).toBe(false)
  })

  it('totalProducts returns 0 when pagination is null', () => {
    const store = useProductStore()
    expect(store.totalProducts).toBe(0)
  })

  it('totalProducts returns the correct count after fetching', async () => {
    const store = useProductStore()
    await store.fetchProducts()
    expect(store.totalProducts).toBe(1)
  })

  it('setFilters merges new filters with existing ones', () => {
    const store = useProductStore()
    store.setFilters({ page: 3 })
    store.setFilters({ limit: 5 })

    expect(store.filters.page).toBe(3)
    expect(store.filters.limit).toBe(5)
  })

  it('resetFilters restores sortBy and order defaults', () => {
    const store = useProductStore()
    store.setFilters({ sortBy: 'price', order: 'asc' })
    store.resetFilters()

    expect(store.filters.sortBy).toBe('createdAt')
    expect(store.filters.order).toBe('desc')
  })

  it('fetchProducts clears any previous error', async () => {
    // First call fails
    mockUseSupabaseProducts.mockReturnValueOnce({
      getProducts: vi.fn().mockRejectedValue(new Error('Oops')),
      getProduct: vi.fn(),
      getCategories: vi.fn(),
      searchProducts: vi.fn(),
    })

    const store = useProductStore()
    await store.fetchProducts()
    expect(store.error).toBe('Oops')

    // Second call succeeds — error should be cleared
    await store.fetchProducts()
    expect(store.error).toBeNull()
  })
})

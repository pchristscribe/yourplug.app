import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFilterStore } from '~/app/stores/filters'

describe('Filter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Initial State', () => {
    it('should initialize with default filter state', () => {
      const store = useFilterStore()

      expect(store.categoryId).toBe('')
      expect(store.platform).toBe('')
      expect(store.minPrice).toBe(0)
      expect(store.maxPrice).toBe(500)
      expect(store.minRating).toBe(0)
      expect(store.sortBy).toBe('createdAt')
      expect(store.order).toBe('desc')
    })

    it('should report no active filters initially', () => {
      const store = useFilterStore()

      expect(store.activeFiltersCount).toBe(0)
      expect(store.hasActiveFilters).toBe(false)
    })
  })

  describe('Filter Actions', () => {
    it('should set category filter', () => {
      const store = useFilterStore()

      store.setCategory('category-123')

      expect(store.categoryId).toBe('category-123')
      expect(store.activeFiltersCount).toBe(1)
      expect(store.hasActiveFilters).toBe(true)
    })

    it('should set platform filter', () => {
      const store = useFilterStore()

      store.setPlatform('DHGATE')

      expect(store.platform).toBe('DHGATE')
      expect(store.activeFiltersCount).toBe(1)
    })

    it('should set price range', () => {
      const store = useFilterStore()

      store.setPriceRange(20, 100)

      expect(store.minPrice).toBe(20)
      expect(store.maxPrice).toBe(100)
      expect(store.activeFiltersCount).toBe(2)
    })

    it('should enforce price range boundaries', () => {
      const store = useFilterStore()

      store.setPriceRange(-10, 1000)

      expect(store.minPrice).toBe(0)
      expect(store.maxPrice).toBe(500)
    })

    it('should set minimum rating', () => {
      const store = useFilterStore()

      store.setMinRating(4.5)

      expect(store.minRating).toBe(4.5)
      expect(store.activeFiltersCount).toBe(1)
    })

    it('should set sorting options', () => {
      const store = useFilterStore()

      store.setSorting('price', 'asc')

      expect(store.sortBy).toBe('price')
      expect(store.order).toBe('asc')
    })

    it('should clear all filters', () => {
      const store = useFilterStore()

      // Set multiple filters
      store.setCategory('cat-1')
      store.setPlatform('AMAZON')
      store.setPriceRange(50, 200)
      store.setMinRating(4)

      expect(store.activeFiltersCount).toBe(5) // cat + platform + minPrice + maxPrice + rating

      // Clear all
      store.clearAllFilters()

      expect(store.categoryId).toBe('')
      expect(store.platform).toBe('')
      expect(store.minPrice).toBe(0)
      expect(store.maxPrice).toBe(500)
      expect(store.minRating).toBe(0)
      expect(store.activeFiltersCount).toBe(0)
    })
  })

  describe('Active Filters Count', () => {
    it('should count all active filters correctly', () => {
      const store = useFilterStore()

      expect(store.activeFiltersCount).toBe(0)

      store.setCategory('cat-1')
      expect(store.activeFiltersCount).toBe(1)

      store.setPlatform('DHGATE')
      expect(store.activeFiltersCount).toBe(2)

      store.setPriceRange(20, 100)
      expect(store.activeFiltersCount).toBe(4) // both min and max

      store.setMinRating(4)
      expect(store.activeFiltersCount).toBe(5)
    })

    it('should not count default values as active filters', () => {
      const store = useFilterStore()

      store.setPriceRange(0, 500) // default values
      expect(store.activeFiltersCount).toBe(0)
    })
  })

  describe('Query Param Conversion', () => {
    it('should convert filters to query params', () => {
      const store = useFilterStore()

      store.setCategory('cat-123')
      store.setPlatform('AMAZON')
      store.setPriceRange(20, 150)
      store.setMinRating(4)
      store.setSorting('price', 'asc')

      const params = store.toQueryParams()

      expect(params).toEqual({
        category: 'cat-123',
        platform: 'AMAZON',
        minPrice: '20',
        maxPrice: '150',
        minRating: '4',
        sortBy: 'price',
        order: 'asc',
      })
    })

    it('should omit default values from query params', () => {
      const store = useFilterStore()

      store.setSorting('createdAt', 'desc') // defaults
      const params = store.toQueryParams()

      expect(params).toEqual({})
    })

    it('should initialize from query params', () => {
      const store = useFilterStore()

      store.initFromQuery({
        category: 'cat-456',
        platform: 'DHGATE',
        minPrice: '50',
        maxPrice: '200',
        minRating: '4.5',
        sortBy: 'rating',
        order: 'asc',
      })

      expect(store.categoryId).toBe('cat-456')
      expect(store.platform).toBe('DHGATE')
      expect(store.minPrice).toBe(50)
      expect(store.maxPrice).toBe(200)
      expect(store.minRating).toBe(4.5)
      expect(store.sortBy).toBe('rating')
      expect(store.order).toBe('asc')
    })

    it('should handle invalid query param values', () => {
      const store = useFilterStore()

      store.initFromQuery({
        minPrice: 'invalid',
        maxPrice: 'also-invalid',
        minRating: 'not-a-number',
      })

      expect(store.minPrice).toBe(0)
      expect(store.maxPrice).toBe(500)
      expect(store.minRating).toBe(0)
    })
  })

  describe('Product Filters Conversion', () => {
    it('should convert to product filters format', () => {
      const store = useFilterStore()

      store.setCategory('cat-789')
      store.setPlatform('ALIEXPRESS')
      store.setPriceRange(30, 120)

      const productFilters = store.toProductFilters

      expect(productFilters).toEqual({
        categoryId: 'cat-789',
        platform: 'ALIEXPRESS',
        minPrice: 30,
        maxPrice: 120,
        sortBy: 'createdAt',
        order: 'desc',
        page: 1,
        limit: 20,
      })
    })

    it('should omit empty filter values', () => {
      const store = useFilterStore()

      const productFilters = store.toProductFilters

      expect(productFilters).not.toHaveProperty('categoryId')
      expect(productFilters).not.toHaveProperty('platform')
      expect(productFilters).not.toHaveProperty('minPrice')
      expect(productFilters).toHaveProperty('sortBy')
      expect(productFilters).toHaveProperty('order')
    })
  })

  describe('AND Logic', () => {
    it('should combine multiple filters with AND logic', () => {
      const store = useFilterStore()

      store.setCategory('electronics')
      store.setPlatform('AMAZON')
      store.setPriceRange(50, 150)
      store.setMinRating(4)

      const productFilters = store.toProductFilters

      expect(productFilters.categoryId).toBe('electronics')
      expect(productFilters.platform).toBe('AMAZON')
      expect(productFilters.minPrice).toBe(50)
      expect(productFilters.maxPrice).toBe(150)
    })
  })
})

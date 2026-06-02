import { defineStore } from 'pinia'
import { DEFAULT_FILTER_STATE, type FilterState } from '../types/filters'
import type { Platform, ProductFilters } from '../types'

export const useFilterStore = defineStore('filters', {
  state: (): FilterState => ({
    ...DEFAULT_FILTER_STATE,
  }),

  getters: {
    activeFiltersCount(state): number {
      let count = 0
      if (state.categoryId) count++
      if (state.platform) count++
      if (state.minPrice > 0) count++
      if (state.maxPrice < 500) count++
      if (state.minRating > 0) count++
      return count
    },

    hasActiveFilters(state): boolean {
      return (
        state.categoryId !== '' ||
        state.platform !== '' ||
        state.minPrice > 0 ||
        state.maxPrice < 500 ||
        state.minRating > 0
      )
    },

    toProductFilters(state): ProductFilters {
      const filters: ProductFilters = {
        sortBy: state.sortBy,
        order: state.order,
        page: 1,
        limit: 20,
      }

      if (state.categoryId) filters.categoryId = state.categoryId
      if (state.platform) filters.platform = state.platform as Platform
      if (state.minPrice > 0) filters.minPrice = state.minPrice
      if (state.maxPrice < 500) filters.maxPrice = state.maxPrice
      if (state.minRating > 0) filters.minRating = state.minRating

      return filters
    },
  },

  actions: {
    setCategory(categoryId: string) {
      this.categoryId = categoryId
    },

    setPlatform(platform: Platform | '') {
      this.platform = platform
    },

    setPriceRange(min: number, max: number) {
      this.minPrice = Math.max(0, min)
      this.maxPrice = Math.min(500, max)
    },

    setMinRating(rating: number) {
      this.minRating = rating
    },

    setSorting(sortBy: FilterState['sortBy'], order: 'asc' | 'desc') {
      this.sortBy = sortBy
      this.order = order
    },

    clearAllFilters() {
      this.$patch({ ...DEFAULT_FILTER_STATE })
    },

    initFromQuery(query: Record<string, string | string[]>) {
      if (query.category && typeof query.category === 'string') {
        this.categoryId = query.category
      }

      if (query.platform && typeof query.platform === 'string') {
        this.platform = query.platform as Platform | ''
      }

      if (query.minPrice && typeof query.minPrice === 'string') {
        this.minPrice = parseFloat(query.minPrice) || 0
      }

      if (query.maxPrice && typeof query.maxPrice === 'string') {
        this.maxPrice = parseFloat(query.maxPrice) || 500
      }

      if (query.minRating && typeof query.minRating === 'string') {
        this.minRating = parseFloat(query.minRating) || 0
      }

      if (query.sortBy && typeof query.sortBy === 'string') {
        this.sortBy = query.sortBy as FilterState['sortBy']
      }

      if (query.order && typeof query.order === 'string') {
        this.order = query.order as 'asc' | 'desc'
      }
    },

    toQueryParams(): Record<string, string> {
      const params: Record<string, string> = {}

      if (this.categoryId) params.category = this.categoryId
      if (this.platform) params.platform = this.platform
      if (this.minPrice > 0) params.minPrice = this.minPrice.toString()
      if (this.maxPrice < 500) params.maxPrice = this.maxPrice.toString()
      if (this.minRating > 0) params.minRating = this.minRating.toString()
      if (this.sortBy !== 'createdAt') params.sortBy = this.sortBy
      if (this.order !== 'desc') params.order = this.order

      return params
    },
  },
})

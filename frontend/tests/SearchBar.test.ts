import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SearchBar from '../app/components/SearchBar.vue'
import type { Product } from '../app/types'

// Mock the useSupabaseProducts composable
const mockSearchProducts = vi.fn()
const mockUseSupabaseProducts = vi.fn(() => ({
  searchProducts: mockSearchProducts,
}))

// Set up global mock
vi.stubGlobal('useSupabaseProducts', mockUseSupabaseProducts)

// Mock product data
const mockProducts: Product[] = [
  {
    id: '1',
    externalId: 'ext-1',
    platform: 'DHGATE',
    title: 'Rainbow Pride Flag',
    description: 'Large rainbow pride flag',
    imageUrl: 'https://example.com/flag.jpg',
    price: 12.99,
    currency: 'USD',
    priceUpdatedAt: '2024-01-01T00:00:00Z',
    categoryId: 'cat-1',
    status: 'ACTIVE',
    rating: 4.5,
    reviewCount: 120,
    tags: ['pride', 'flag'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    externalId: 'ext-2',
    platform: 'ALIEXPRESS',
    title: 'Pride T-Shirt',
    description: 'Comfortable pride t-shirt',
    imageUrl: 'https://example.com/shirt.jpg',
    price: 19.99,
    currency: 'USD',
    priceUpdatedAt: '2024-01-01T00:00:00Z',
    categoryId: 'cat-2',
    status: 'ACTIVE',
    reviewCount: 85,
    tags: ['pride', 'clothing'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

describe('SearchBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Rendering', () => {
    it('renders search input with default placeholder', () => {
      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      expect(input.exists()).toBe(true)
      expect(input.attributes('placeholder')).toBe('Search products...')
    })

    it('renders search input with custom placeholder', () => {
      const wrapper = mount(SearchBar, {
        props: {
          placeholder: 'Find awesome products',
        },
      })
      const input = wrapper.find('input[type="text"]')
      expect(input.attributes('placeholder')).toBe('Find awesome products')
    })

    it('renders search icon', () => {
      const wrapper = mount(SearchBar)
      const icon = wrapper.find('svg')
      expect(icon.exists()).toBe(true)
    })

    it('does not show dropdown initially', () => {
      const wrapper = mount(SearchBar)
      const dropdown = wrapper.find('[role="listbox"]')
      expect(dropdown.exists()).toBe(false)
    })
  })

  describe('Search Functionality', () => {
    it('does not search when query is below minimum characters', async () => {
      const wrapper = mount(SearchBar, {
        props: {
          minChars: 3,
        },
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('ab')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(mockSearchProducts).not.toHaveBeenCalled()
    })

    it('searches when query meets minimum characters', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar, {
        props: {
          minChars: 2,
          debounceMs: 100,
        },
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(mockSearchProducts).toHaveBeenCalledWith('pride', { limit: 10 })
    })

    it('debounces search requests', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar, {
        props: {
          debounceMs: 300,
        },
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('p')
      await vi.advanceTimersByTimeAsync(100)
      await input.setValue('pr')
      await vi.advanceTimersByTimeAsync(100)
      await input.setValue('pri')
      await vi.advanceTimersByTimeAsync(100)

      // Should not have called API yet
      expect(mockSearchProducts).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      // Should have called API only once
      expect(mockSearchProducts).toHaveBeenCalledTimes(1)
    })

    it('respects maxResults prop', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 5, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar, {
        props: {
          maxResults: 5,
        },
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(mockSearchProducts).toHaveBeenCalledWith('pride', { limit: 5 })
    })

    it('emits search event when search is performed', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(wrapper.emitted('search')).toBeTruthy()
      expect(wrapper.emitted('search')?.[0]).toEqual(['pride'])
    })
  })

  describe('Results Display', () => {
    it('shows dropdown with results after successful search', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      const dropdown = wrapper.find('[role="listbox"]')
      expect(dropdown.exists()).toBe(true)

      const results = dropdown.findAll('button[role="option"]')
      expect(results).toHaveLength(2)
    })

    it('displays product information correctly', async () => {
      mockSearchProducts.mockResolvedValue({
        products: [mockProducts[0]],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('rainbow')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      const resultText = wrapper.text()
      expect(resultText).toContain('Rainbow Pride Flag')
      expect(resultText).toContain('$12.99')
      expect(resultText).toContain('DHGATE')
      expect(resultText).toContain('4.5')
    })

    it('shows no results message when search returns empty', async () => {
      mockSearchProducts.mockResolvedValue({
        products: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('nonexistent')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(wrapper.text()).toContain('No products found for "nonexistent"')
    })

    it('shows loading state during search', async () => {
      let resolvePromise: (value: unknown) => void
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockSearchProducts.mockReturnValue(delayedPromise)

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      // Should show loading spinner while waiting
      const spinner = wrapper.find('.animate-spin')
      expect(spinner.exists()).toBe(true)

      // Clean up
      resolvePromise!({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })
      await flushPromises()
    })

    it('shows error message when search fails', async () => {
      mockSearchProducts.mockRejectedValue(new Error('Network error'))

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')

      // Focus first, then type
      await input.trigger('focus')
      await flushPromises()

      await input.setValue('pride')
      await vi.runAllTimersAsync()
      await flushPromises()

      // Dropdown should be open and show error
      const dropdown = wrapper.find('[role="listbox"]')
      expect(dropdown.exists()).toBe(true)
      expect(dropdown.text()).toContain('Network error')
    })
  })

  describe('Keyboard Navigation', () => {
    it('navigates down with arrow key', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      await input.trigger('keydown', { key: 'ArrowDown' })
      await flushPromises()

      const results = wrapper.findAll('button[role="option"]')
      expect(results[0].classes()).toContain('bg-brand-muted')
    })

    it('navigates up with arrow key', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      // Navigate down twice
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'ArrowDown' })
      await flushPromises()

      // Navigate up once
      await input.trigger('keydown', { key: 'ArrowUp' })
      await flushPromises()

      const results = wrapper.findAll('button[role="option"]')
      expect(results[0].classes()).toContain('bg-brand-muted')
    })

    it('selects product with Enter key', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0]).toEqual([mockProducts[0]])
    })

    it('closes dropdown with Escape key', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

      await input.trigger('keydown', { key: 'Escape' })
      await flushPromises()

      expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    })

    it('does not navigate beyond list boundaries', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      // Try to navigate up from start
      await input.trigger('keydown', { key: 'ArrowUp' })
      await flushPromises()

      const results = wrapper.findAll('button[role="option"]')
      expect(results.every((r) => !r.classes().includes('bg-brand-muted'))).toBe(true)

      // Navigate to end
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'ArrowDown' })
      await flushPromises()

      // Should stay at last item
      expect(results[1].classes()).toContain('bg-brand-muted')
    })
  })

  describe('User Interactions', () => {
    it('selects product on click', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      const results = wrapper.findAll('button[role="option"]')
      await results[0].trigger('click')
      await flushPromises()

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0]).toEqual([mockProducts[0]])
    })

    it('clears search when clear button is clicked', async () => {
      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await flushPromises()

      const clearButton = wrapper.find('button[aria-label="Clear search"]')
      expect(clearButton.exists()).toBe(true)

      await clearButton.trigger('click')
      await flushPromises()

      expect((input.element as HTMLInputElement).value).toBe('')
    })

    it('shows clear button only when input has value', async () => {
      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')

      expect(wrapper.find('button[aria-label="Clear search"]').exists()).toBe(false)

      await input.setValue('pride')
      await flushPromises()

      expect(wrapper.find('button[aria-label="Clear search"]').exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')

      expect(input.attributes('role')).toBe('combobox')
      expect(input.attributes('aria-autocomplete')).toBe('list')
      expect(input.attributes('aria-controls')).toMatch(/^search-results-/)
      expect(input.attributes('aria-expanded')).toBe('false')
    })

    it('updates aria-expanded when dropdown opens', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(input.attributes('aria-expanded')).toBe('true')
    })

    it('has proper role attributes on dropdown and items', async () => {
      mockSearchProducts.mockResolvedValue({
        products: mockProducts,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('pride')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      const dropdown = wrapper.find('[role="listbox"]')
      expect(dropdown.attributes('role')).toBe('listbox')

      const results = wrapper.findAll('button[role="option"]')
      expect(results.length).toBeGreaterThan(0)
      results.forEach((result) => {
        expect(result.attributes('role')).toBe('option')
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles empty search query', async () => {
      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('')
      await vi.runAllTimersAsync()
      await flushPromises()

      expect(mockSearchProducts).not.toHaveBeenCalled()
      expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    })

    it('handles products without images', async () => {
      const productWithoutImage = { ...mockProducts[0], imageUrl: '' }
      mockSearchProducts.mockResolvedValue({
        products: [productWithoutImage],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('test')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      const placeholder = wrapper.find('.bg-surface-light')
      expect(placeholder.exists()).toBe(true)
    })

    it('handles products without ratings', async () => {
      const productWithoutRating = { ...mockProducts[0], rating: undefined }
      mockSearchProducts.mockResolvedValue({
        products: [productWithoutRating],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      })

      const wrapper = mount(SearchBar)
      const input = wrapper.find('input[type="text"]')
      await input.setValue('test')
      await input.trigger('focus')
      await vi.runAllTimersAsync()
      await flushPromises()

      const rating = wrapper.find('.text-yellow-400')
      expect(rating.exists()).toBe(false)
    })
  })
})

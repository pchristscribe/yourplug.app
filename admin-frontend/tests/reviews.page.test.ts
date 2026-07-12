/**
 * Characterization tests for reviews.vue's actual rendered behavior —
 * written BEFORE extracting the shared useAdminCrudList composable (see
 * TECH_DEBT.md #6). The existing reviews.test.ts only re-implements the
 * authorName-default logic in parallel functions; this mounts the real
 * component and drives it through @vue/test-utils instead.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, onMounted } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('definePageMeta', vi.fn())

const mockConfig = { public: { apiBase: 'http://localhost:3001' } }
vi.stubGlobal('useRuntimeConfig', vi.fn(() => mockConfig))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mockAlert = vi.fn()
const mockConfirm = vi.fn(() => true)
vi.stubGlobal('alert', mockAlert)
vi.stubGlobal('confirm', mockConfirm)

const ReviewsPage = (await import('../app/pages/reviews.vue')).default

const makeReview = (overrides = {}) => ({
  id: 'rev-1',
  productId: 'prod-1',
  product: { title: 'Rainbow Harness' },
  rating: 4,
  title: 'Great fit',
  content: 'Very comfortable and well made.',
  pros: ['Comfortable'],
  cons: [],
  authorName: 'yourplug Team',
  isFeatured: false,
  ...overrides,
})

const emptyReviews = { reviews: [], pagination: null }
const emptyProducts = { products: [] }

// reviews.vue fires loadProducts() and loadReviews() in parallel on mount
function stubMount(reviewsResponse = emptyReviews, productsResponse = emptyProducts) {
  mockFetch.mockImplementation((url) => {
    if (url.includes('/products')) return Promise.resolve(productsResponse)
    return Promise.resolve(reviewsResponse)
  })
}

async function mountPage() {
  const wrapper = mount(ReviewsPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mockFetch.mockReset()
  mockAlert.mockReset()
  mockConfirm.mockReset().mockReturnValue(true)
})

describe('reviews.vue — initial load', () => {
  it('loads both products and reviews on mount and renders a review row', async () => {
    stubMount({ reviews: [makeReview()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/products',
      expect.objectContaining({ query: { limit: 1000 } })
    )
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/reviews',
      expect.objectContaining({ query: { page: 1, limit: 20 } })
    )
    expect(wrapper.text()).toContain('Rainbow Harness')
    expect(wrapper.text()).toContain('Very comfortable and well made.')
  })

  it('shows an empty state when there are no reviews', async () => {
    stubMount()
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No reviews found')
  })
})

describe('reviews.vue — create flow', () => {
  it('defaults authorName to "yourplug Team" and sanitizes content on submit', async () => {
    stubMount()
    const wrapper = await mountPage()

    await wrapper.find('button[type="button"]').trigger('click') // "Add Review"
    expect(wrapper.find('h3').text()).toBe('Create Review')
    expect((wrapper.find('input[placeholder="yourplug Team"]').element as HTMLInputElement).value).toBe('yourplug Team')

    await wrapper.find('select').setValue('prod-1') // Product select
    await wrapper.find('textarea').setValue('<script>alert(1)</script>Solid product')

    mockFetch.mockResolvedValueOnce({ id: 'new-review' })
    mockFetch.mockImplementation((url) => {
      if (url.includes('/products')) return Promise.resolve(emptyProducts)
      return Promise.resolve(emptyReviews)
    })

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const postCall = mockFetch.mock.calls.find(c => c[1]?.method === 'POST')
    expect(postCall).toBeTruthy()
    expect(postCall![1].body.content).not.toContain('<script>')
    expect(postCall![1].body.content).toContain('Solid product')
  })
})

describe('reviews.vue — edit flow', () => {
  it('pre-fills the modal from the selected review and PATCHes on submit', async () => {
    stubMount({ reviews: [makeReview()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    await wrapper.find('button.text-indigo-600').trigger('click') // "Edit"
    expect(wrapper.find('h3').text()).toBe('Edit Review')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('Very comfortable and well made.')

    mockFetch.mockResolvedValueOnce({ id: 'rev-1' })
    mockFetch.mockImplementation((url) => {
      if (url.includes('/products')) return Promise.resolve(emptyProducts)
      return Promise.resolve(emptyReviews)
    })

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const patchCall = mockFetch.mock.calls.find(c => c[1]?.method === 'PATCH')
    expect(patchCall?.[0]).toBe('http://localhost:3001/api/admin/reviews/rev-1')
  })

  it('falls back to "yourplug Team" when the review has no authorName', async () => {
    stubMount({ reviews: [makeReview({ authorName: null })], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    await wrapper.find('button.text-indigo-600').trigger('click')
    expect((wrapper.find('input[placeholder="yourplug Team"]').element as HTMLInputElement).value).toBe('yourplug Team')
  })
})

describe('reviews.vue — delete flow', () => {
  it('confirms then DELETEs the review', async () => {
    stubMount({ reviews: [makeReview()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    await wrapper.find('button.text-red-600').trigger('click') // row "Delete"
    expect(wrapper.text()).toContain('Are you sure you want to delete this review')

    mockFetch.mockResolvedValueOnce({})
    mockFetch.mockImplementation((url) => {
      if (url.includes('/products')) return Promise.resolve(emptyProducts)
      return Promise.resolve(emptyReviews)
    })

    const deleteButtons = wrapper.findAll('button').filter(b => b.text() === 'Delete')
    await deleteButtons[deleteButtons.length - 1].trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/reviews/rev-1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})

describe('reviews.vue — bulk actions', () => {
  it('bulk-marks featured for selected reviews', async () => {
    stubMount({ reviews: [makeReview()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    await wrapper.find('input[type="checkbox"]').trigger('change') // select the row
    expect(wrapper.text()).toContain('1 review selected')

    mockFetch.mockResolvedValueOnce({})
    mockFetch.mockImplementation((url) => {
      if (url.includes('/products')) return Promise.resolve(emptyProducts)
      return Promise.resolve(emptyReviews)
    })

    await wrapper.find('button.bg-blue-600').trigger('click') // "Mark Featured"
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/reviews/bulk/toggle-featured',
      expect.objectContaining({ method: 'POST', body: { reviewIds: ['rev-1'], isFeatured: true } })
    )
  })

  it('asks for confirmation before bulk delete', async () => {
    stubMount({ reviews: [makeReview()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    await wrapper.find('input[type="checkbox"]').trigger('change')
    mockConfirm.mockReturnValue(false)

    await wrapper.find('button.bg-red-600').trigger('click') // "Delete Selected"
    expect(mockConfirm).toHaveBeenCalledWith('Delete 1 reviews?')
    expect(mockFetch.mock.calls.some(c => c[0].includes('bulk/delete'))).toBe(false)
  })
})

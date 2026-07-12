/**
 * Characterization tests for products/index.vue's actual rendered behavior —
 * written BEFORE extracting the shared useAdminCrudList composable (see
 * TECH_DEBT.md #6). This page currently has zero test coverage.
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
vi.stubGlobal('alert', mockAlert)

const ProductsPage = (await import('../app/pages/products/index.vue')).default

const makeProduct = (overrides = {}) => ({
  id: 'prod-1',
  title: 'Rainbow Harness',
  platform: 'DHGATE',
  category: { name: 'Harnesses' },
  categoryId: 'cat-1',
  price: 29.99,
  currency: 'USD',
  status: 'ACTIVE',
  imageUrl: 'https://example.test/img.jpg',
  externalId: 'ext-1',
  description: 'A harness',
  rating: 4.5,
  reviewCount: 10,
  tags: ['pride', 'summer'],
  ...overrides,
})

const emptyProducts = { products: [], pagination: null }
const emptyCategories = { categories: [] }

// products/index.vue fires loadProducts() and loadCategories() in parallel on mount
function stubMount(productsResponse = emptyProducts, categoriesResponse = emptyCategories) {
  mockFetch.mockImplementation((url) => {
    if (url.includes('/categories')) return Promise.resolve(categoriesResponse)
    return Promise.resolve(productsResponse)
  })
}

async function mountPage() {
  const wrapper = mount(ProductsPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mockFetch.mockReset()
  mockAlert.mockReset()
})

describe('products/index.vue — initial load', () => {
  it('loads products and categories on mount and renders a product row', async () => {
    stubMount({ products: [makeProduct()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/products',
      expect.objectContaining({ query: { page: 1, limit: 20, search: undefined } })
    )
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/categories',
      expect.objectContaining({ query: { limit: 100 } })
    )
    expect(wrapper.text()).toContain('Rainbow Harness')
    expect(wrapper.text()).toContain('$29.99')
    expect(wrapper.text()).toContain('ACTIVE')
  })

  it('shows an empty state when there are no products', async () => {
    stubMount()
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No products found')
  })
})

describe('products/index.vue — create flow', () => {
  it('rejects an invalid image URL without calling the API', async () => {
    stubMount()
    const wrapper = await mountPage()

    await wrapper.find('button[type="button"]').trigger('click') // "Add Product"
    await wrapper.find('input[placeholder="Product title"]').setValue('New Item')
    await wrapper.find('input[type="url"]').setValue('not-a-url')

    const callsBeforeSubmit = mockFetch.mock.calls.length
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockAlert).toHaveBeenCalledWith('Invalid image URL. Please provide a valid HTTP or HTTPS URL.')
    expect(mockFetch.mock.calls.length).toBe(callsBeforeSubmit)
  })

  it('parses comma-separated tags and POSTs on submit', async () => {
    stubMount()
    const wrapper = await mountPage()

    await wrapper.find('button[type="button"]').trigger('click')
    await wrapper.find('input[placeholder="Product title"]').setValue('New Item')
    await wrapper.find('input[type="url"]').setValue('https://example.test/new.jpg')
    await wrapper.find('input[placeholder="summer, fashion, trending"]').setValue('pride,  summer ,winter')

    mockFetch.mockResolvedValueOnce({ id: 'new-prod' })
    stubMount()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const postCall = mockFetch.mock.calls.find(c => c[1]?.method === 'POST')
    expect(postCall![1].body.tags).toEqual(['pride', 'summer', 'winter'])
    expect(postCall![1].body.imageUrl).toBe('https://example.test/new.jpg')
  })
})

describe('products/index.vue — edit flow', () => {
  it('pre-fills the modal, including joined tags, and PATCHes on submit', async () => {
    stubMount({ products: [makeProduct()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    await wrapper.find('button.text-indigo-600').trigger('click') // "Edit"
    expect(wrapper.find('h3').text()).toBe('Edit Product')
    expect((wrapper.find('input[placeholder="Product title"]').element as HTMLInputElement).value).toBe('Rainbow Harness')
    expect((wrapper.find('input[placeholder="summer, fashion, trending"]').element as HTMLInputElement).value).toBe('pride, summer')

    mockFetch.mockResolvedValueOnce({ id: 'prod-1' })
    stubMount()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const patchCall = mockFetch.mock.calls.find(c => c[1]?.method === 'PATCH')
    expect(patchCall?.[0]).toBe('http://localhost:3001/api/admin/products/prod-1')
  })
})

describe('products/index.vue — delete flow', () => {
  it('shows a confirmation naming the product, then DELETEs on confirm', async () => {
    stubMount({ products: [makeProduct({ title: 'Leather Cuffs' })], pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
    const wrapper = await mountPage()

    await wrapper.find('button.text-red-600').trigger('click') // "Delete"
    expect(wrapper.text()).toContain('Leather Cuffs')

    mockFetch.mockResolvedValueOnce({})
    stubMount()

    const deleteButtons = wrapper.findAll('button').filter(b => b.text() === 'Delete')
    await deleteButtons[deleteButtons.length - 1].trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/products/prod-1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})

describe('products/index.vue — pagination', () => {
  it('Next fetches the following page when one is available', async () => {
    stubMount({ products: [makeProduct()], pagination: { page: 1, limit: 20, total: 40, pages: 2 } })
    const wrapper = await mountPage()

    stubMount({ products: [makeProduct({ id: 'prod-2' })], pagination: { page: 2, limit: 20, total: 40, pages: 2 } })
    const next = wrapper.findAll('button').find(b => b.text() === 'Next')
    await next?.trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/products',
      expect.objectContaining({ query: { page: 2, limit: 20, search: undefined } })
    )
  })
})

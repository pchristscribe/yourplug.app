/**
 * Characterization tests for categories.vue's actual rendered behavior —
 * written BEFORE extracting the shared useAdminCrudList composable (see
 * TECH_DEBT.md #6) so the refactor has a real safety net. Unlike
 * reviews.test.ts, this mounts the real component and drives it through
 * @vue/test-utils rather than re-implementing its logic in parallel
 * functions, so it actually catches regressions in the component itself.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, onMounted } from 'vue'

// ─── Stub Nuxt auto-imports with real Vue APIs so the SFC compiles/runs ─────
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

const CategoriesPage = (await import('../app/pages/categories.vue')).default

const makeCategory = (overrides = {}) => ({
  id: 'cat-1',
  name: 'Harnesses',
  slug: 'harnesses',
  description: 'Body harnesses',
  imageUrl: 'https://example.test/img.jpg',
  _count: { products: 3 },
  ...overrides,
})

const emptyList = { categories: [], pagination: null }

async function mountPage() {
  const wrapper = mount(CategoriesPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mockFetch.mockReset()
  mockAlert.mockReset()
  mockConfirm.mockReset().mockReturnValue(true)
})

describe('categories.vue — initial load', () => {
  it('fetches categories on mount and renders them', async () => {
    mockFetch.mockResolvedValueOnce({
      categories: [makeCategory()],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    })
    const wrapper = await mountPage()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/categories',
      expect.objectContaining({ credentials: 'include', query: { page: 1, limit: 50, search: undefined } })
    )
    expect(wrapper.text()).toContain('Harnesses')
    expect(wrapper.text()).toContain('3 products')
  })

  it('shows an empty state when there are no categories', async () => {
    mockFetch.mockResolvedValueOnce(emptyList)
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No categories found')
  })

  it('alerts and stops loading if the initial fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const wrapper = await mountPage()
    expect(mockAlert).toHaveBeenCalledWith('Failed to load categories. Please try again.')
    expect(wrapper.text()).not.toContain('Loading categories')
  })
})

describe('categories.vue — create flow', () => {
  it('opens the create modal with blank fields and posts on submit', async () => {
    mockFetch.mockResolvedValueOnce(emptyList) // initial load
    const wrapper = await mountPage()

    await wrapper.find('button[type="button"]').trigger('click') // "Add Category"
    expect(wrapper.find('h3').text()).toBe('Create Category')

    await wrapper.find('input[placeholder="e.g., Men\'s Fashion"]').setValue('Toys')
    await wrapper.find('input[placeholder="e.g., mens-fashion"]').setValue('toys')

    mockFetch.mockResolvedValueOnce({ id: 'new-1' }) // POST response
    mockFetch.mockResolvedValueOnce(emptyList) // reload after save

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/categories',
      expect.objectContaining({ method: 'POST', body: { name: 'Toys', slug: 'toys' } })
    )
  })

  it('rejects an invalid image URL without calling the API', async () => {
    mockFetch.mockResolvedValueOnce(emptyList)
    const wrapper = await mountPage()

    await wrapper.find('button[type="button"]').trigger('click')
    await wrapper.find('input[placeholder="e.g., Men\'s Fashion"]').setValue('Toys')
    await wrapper.find('input[placeholder="e.g., mens-fashion"]').setValue('toys')
    await wrapper.find('input[type="url"]').setValue('javascript:alert(1)')

    const callsBeforeSubmit = mockFetch.mock.calls.length
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockAlert).toHaveBeenCalledWith(
      'Invalid image URL. Please provide a valid HTTP or HTTPS URL, or leave it empty.'
    )
    expect(mockFetch.mock.calls.length).toBe(callsBeforeSubmit)
  })
})

describe('categories.vue — edit flow', () => {
  it('pre-fills the modal with the selected category and PATCHes on submit', async () => {
    mockFetch.mockResolvedValueOnce({
      categories: [makeCategory()],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    })
    const wrapper = await mountPage()

    await wrapper.find('button.text-indigo-600').trigger('click') // "Edit"
    expect(wrapper.find('h3').text()).toBe('Edit Category')
    expect((wrapper.find('input[placeholder="e.g., Men\'s Fashion"]').element as HTMLInputElement).value).toBe('Harnesses')

    mockFetch.mockResolvedValueOnce({ id: 'cat-1' })
    mockFetch.mockResolvedValueOnce(emptyList)

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/categories/cat-1',
      expect.objectContaining({ method: 'PATCH' })
    )
  })
})

describe('categories.vue — delete flow', () => {
  it('shows a confirmation naming the category, then DELETEs on confirm', async () => {
    mockFetch.mockResolvedValueOnce({
      categories: [makeCategory({ name: 'Rope' })],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    })
    const wrapper = await mountPage()

    await wrapper.find('button.text-red-600').trigger('click') // "Delete"
    expect(wrapper.text()).toContain('Are you sure you want to delete')
    expect(wrapper.text()).toContain('Rope')

    mockFetch.mockResolvedValueOnce({}) // DELETE response
    mockFetch.mockResolvedValueOnce(emptyList) // reload

    const deleteButtons = wrapper.findAll('button').filter(b => b.text() === 'Delete')
    await deleteButtons[deleteButtons.length - 1].trigger('click') // modal's own "Delete" button
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/categories/cat-1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('cancel closes the confirmation without deleting', async () => {
    mockFetch.mockResolvedValueOnce({
      categories: [makeCategory()],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    })
    const wrapper = await mountPage()

    await wrapper.find('button.text-red-600').trigger('click')
    const callsBeforeCancel = mockFetch.mock.calls.length

    const cancelButtons = wrapper.findAll('button').filter(b => b.text() === 'Cancel')
    await cancelButtons[cancelButtons.length - 1].trigger('click')

    expect(wrapper.text()).not.toContain('Are you sure you want to delete')
    expect(mockFetch.mock.calls.length).toBe(callsBeforeCancel)
  })
})

describe('categories.vue — pagination', () => {
  it('disables Previous on page 1 and Next on the last page', async () => {
    mockFetch.mockResolvedValueOnce({
      categories: [makeCategory()],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    })
    const wrapper = await mountPage()

    const prev = wrapper.findAll('button').find(b => b.text() === 'Previous')
    const next = wrapper.findAll('button').find(b => b.text() === 'Next')
    expect(prev?.attributes('disabled')).toBeDefined()
    expect(next?.attributes('disabled')).toBeDefined()
  })

  it('Next fetches the following page when one is available', async () => {
    mockFetch.mockResolvedValueOnce({
      categories: [makeCategory()],
      pagination: { page: 1, limit: 50, total: 100, pages: 2 },
    })
    const wrapper = await mountPage()

    mockFetch.mockResolvedValueOnce({
      categories: [makeCategory({ id: 'cat-2' })],
      pagination: { page: 2, limit: 50, total: 100, pages: 2 },
    })
    const next = wrapper.findAll('button').find(b => b.text() === 'Next')
    await next?.trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenLastCalledWith(
      'http://localhost:3001/api/admin/categories',
      expect.objectContaining({ query: { page: 2, limit: 50, search: undefined } })
    )
  })
})

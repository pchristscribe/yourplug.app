/**
 * Page tests for consignment.vue — this page previously had zero coverage.
 * Also locks in a real bug fix found while writing these tests: the page
 * destructured a nonexistent `token` property from useCsrf() and called
 * `.value` on it, which threw before every approve()/confirmReject() call
 * ever reached $fetch. Fixed to use useCsrf()'s csrfHeaders() instead.
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

const ConsignmentPage = (await import('../app/pages/consignment.vue')).default

function makeListing(overrides = {}) {
  return {
    id: 'listing-1',
    title: 'Vintage Leather Jacket',
    sellerDisplayName: 'seller123',
    category: 'Apparel',
    askingPrice: 45,
    moderationStatus: 'PENDING',
    moderationReason: null,
    primaryImage: null,
    ...overrides,
  }
}

const emptyPage = { data: [], pagination: { pages: 1 } }

function stubMount(listResponse = emptyPage) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/consignment/listings')) {
      return Promise.resolve(listResponse)
    }
    return Promise.resolve({ data: [] })
  })
}

async function mountPage() {
  const wrapper = mount(ConsignmentPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mockFetch.mockReset()
  sessionStorage.clear()
})

describe('consignment.vue — initial load', () => {
  it('loads listings on mount and renders a row', async () => {
    stubMount({ data: [makeListing()], pagination: { pages: 1 } })
    const wrapper = await mountPage()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/consignment/listings?page=1&limit=20'),
      expect.objectContaining({ credentials: 'include' })
    )
    expect(wrapper.text()).toContain('Vintage Leather Jacket')
    expect(wrapper.text()).toContain('$45.00')
    expect(wrapper.text()).toContain('PENDING')
  })

  it('shows an empty state when there are no listings', async () => {
    stubMount()
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No listings.')
  })

  it('reloads with a moderationStatus filter when the dropdown changes', async () => {
    stubMount()
    const wrapper = await mountPage()

    await wrapper.find('select').setValue('FLAGGED')
    await flushPromises()

    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.stringContaining('moderationStatus=FLAGGED'),
      expect.anything()
    )
  })
})

describe('consignment.vue — approve', () => {
  it('sends a CSRF header and reloads on approve (regression: useCsrf() destructuring bug)', async () => {
    stubMount({ data: [makeListing()], pagination: { pages: 1 } })
    const wrapper = await mountPage()

    const approveButton = wrapper.findAll('button').find(b => b.text() === 'Approve')
    await approveButton?.trigger('click')
    await flushPromises()

    const approveCall = mockFetch.mock.calls.find(c => String(c[0]).includes('/approve'))
    expect(approveCall).toBeTruthy()
    expect(approveCall![1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({ 'X-CSRF-Token': expect.any(String) }),
      })
    )
    // Reload after approve
    expect(mockFetch.mock.calls.filter(c => String(c[0]).includes('/consignment/listings?')).length).toBeGreaterThan(1)
  })

  it('does not render Approve for an already-approved listing', async () => {
    stubMount({ data: [makeListing({ moderationStatus: 'APPROVED' })], pagination: { pages: 1 } })
    const wrapper = await mountPage()

    expect(wrapper.findAll('button').find(b => b.text() === 'Approve')).toBeUndefined()
  })
})

describe('consignment.vue — reject', () => {
  it('disables submit until a reason is entered, then PATCHes with the reason and a CSRF header', async () => {
    stubMount({ data: [makeListing()], pagination: { pages: 1 } })
    const wrapper = await mountPage()

    const rejectButton = wrapper.findAll('button').find(b => b.text() === 'Reject')
    await rejectButton?.trigger('click')

    // The modal's own submit button is styled bg-red-600, distinct from the
    // row-level "Reject" button (text-red-600) that opened the modal.
    const submitButton = wrapper.find('button.bg-red-600')
    expect(submitButton.attributes('disabled')).toBeDefined()

    await wrapper.find('textarea').setValue('Not compliant with guidelines')
    expect(wrapper.find('button.bg-red-600').attributes('disabled')).toBeUndefined()
    await wrapper.find('button.bg-red-600').trigger('click')
    await flushPromises()

    const rejectCall = mockFetch.mock.calls.find(c => String(c[0]).includes('/reject'))
    expect(rejectCall).toBeTruthy()
    expect(rejectCall![1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: { reason: 'Not compliant with guidelines' },
        headers: expect.objectContaining({ 'X-CSRF-Token': expect.any(String) }),
      })
    )
    expect(wrapper.text()).not.toContain('Reason for rejection')
  })
})

describe('consignment.vue — AI logs modal', () => {
  it('fetches and displays moderation logs', async () => {
    stubMount({ data: [makeListing()], pagination: { pages: 1 } })
    const wrapper = await mountPage()

    mockFetch.mockImplementationOnce((url: string) => {
      if (String(url).includes('/moderation-logs/')) {
        return Promise.resolve({
          data: [{ id: 'log-1', checkType: 'toxicity', passed: false, reason: 'flagged language', result: { score: 0.9 } }],
        })
      }
      return Promise.resolve(emptyPage)
    })

    await wrapper.find('button.text-indigo-600').trigger('click') // "View AI logs"
    await flushPromises()

    expect(wrapper.text()).toContain('toxicity')
    expect(wrapper.text()).toContain('FAILED')
    expect(wrapper.text()).toContain('flagged language')
  })
})

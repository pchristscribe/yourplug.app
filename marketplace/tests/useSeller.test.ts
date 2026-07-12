import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const fetchMock = vi.fn()
const getAuthHeadersMock = vi.fn().mockResolvedValue({ Authorization: 'Bearer tok' })

vi.stubGlobal('ref', ref)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:3001' } }))
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useAuthHeaders', () => ({ getAuthHeaders: getAuthHeadersMock }))

const { useSeller } = await import('../app/composables/useSeller')

describe('useSeller', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('fetchMyListings stores results', async () => {
    fetchMock.mockResolvedValue([{ id: 'l1', title: 'Test' }])
    const { listings, error, fetchMyListings } = useSeller()
    await fetchMyListings()
    expect(listings.value).toEqual([{ id: 'l1', title: 'Test' }])
    expect(error.value).toBeNull()
  })

  it('fetchMyListings captures Error failures in error', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('boom')))
    const { error, fetchMyListings } = useSeller()
    await fetchMyListings()
    expect(error.value).toBe('boom')
  })

  it('fetchMyListings falls back to a default message for non-Error rejections', async () => {
    fetchMock.mockImplementation(() => Promise.reject('not an Error instance'))
    const { error, fetchMyListings } = useSeller()
    await fetchMyListings()
    expect(error.value).toBe('Failed to load your listings')
  })

  it('createListing prepends the new listing to state', async () => {
    fetchMock.mockResolvedValue({ id: 'l1', title: 'New' })
    const { listings, createListing } = useSeller()
    const created = await createListing({ title: 'New', condition: 'NEW', category: 'APPAREL', askingPrice: 10 })
    expect(created).toEqual({ id: 'l1', title: 'New' })
    expect(listings.value[0]).toEqual({ id: 'l1', title: 'New' })
  })

  it('deleteListing removes the listing from state on success', async () => {
    fetchMock.mockResolvedValueOnce([{ id: 'l1' }, { id: 'l2' }]).mockResolvedValueOnce(undefined)
    const { listings, fetchMyListings, deleteListing } = useSeller()
    await fetchMyListings()
    await deleteListing('l1')
    expect(listings.value).toEqual([{ id: 'l2' }])
  })

  it('submitListing refetches the seller listings', async () => {
    fetchMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ id: 'l1', status: 'PENDING_MODERATION' }])
    const { listings, submitListing } = useSeller()
    await submitListing('l1')
    expect(listings.value).toEqual([{ id: 'l1', status: 'PENDING_MODERATION' }])
  })
})

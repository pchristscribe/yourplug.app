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

  it('createListing sets error and rethrows on Error failures', async () => {
    fetchMock.mockRejectedValue(new Error('validation failed'))
    const { createListing, error, listings } = useSeller()
    await expect(createListing({ title: 't', condition: 'NEW', category: 'HARNESS', askingPrice: 1 }))
      .rejects.toThrow('validation failed')
    expect(error.value).toBe('validation failed')
    expect(listings.value).toEqual([])
  })

  it('createListing falls back to a default message for non-Error rejections', async () => {
    fetchMock.mockRejectedValue('boom')
    const { createListing, error } = useSeller()
    await expect(createListing({ title: 't', condition: 'NEW', category: 'HARNESS', askingPrice: 1 }))
      .rejects.toBeDefined()
    expect(error.value).toBe('Failed to create listing')
  })

  it('submitListing sets error and rethrows on failure', async () => {
    fetchMock.mockRejectedValue(new Error('not ready'))
    const { submitListing, error } = useSeller()
    await expect(submitListing('l1')).rejects.toThrow('not ready')
    expect(error.value).toBe('not ready')
  })

  it('submitListing falls back to a default message for non-Error rejections', async () => {
    fetchMock.mockRejectedValue({ status: 500 })
    const { submitListing, error } = useSeller()
    await expect(submitListing('l1')).rejects.toBeDefined()
    expect(error.value).toBe('Failed to submit listing')
  })

  it('does not refetch listings when submitListing fails', async () => {
    fetchMock.mockRejectedValue(new Error('nope'))
    const { submitListing } = useSeller()
    await expect(submitListing('l1')).rejects.toThrow()
    // one call for the submit itself, none for the follow-up refetch
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deleteListing sets error and rethrows without mutating state', async () => {
    fetchMock.mockResolvedValueOnce([{ id: 'l1' }, { id: 'l2' }])
    const { fetchMyListings, deleteListing, listings, error } = useSeller()
    await fetchMyListings()

    fetchMock.mockRejectedValue(new Error('conflict'))
    await expect(deleteListing('l1')).rejects.toThrow('conflict')
    expect(error.value).toBe('conflict')
    expect(listings.value).toHaveLength(2)
  })

  it('deleteListing falls back to a default message for non-Error rejections', async () => {
    fetchMock.mockRejectedValue(null)
    const { deleteListing, error } = useSeller()
    await expect(deleteListing('l1')).rejects.toBeDefined()
    expect(error.value).toBe('Failed to delete listing')
  })

  it('clears a previous error at the start of a new operation', async () => {
    fetchMock.mockRejectedValue(new Error('first failure'))
    const { fetchMyListings, error } = useSeller()
    await fetchMyListings()
    expect(error.value).toBe('first failure')

    fetchMock.mockReset()
    fetchMock.mockResolvedValue([])
    await fetchMyListings()
    expect(error.value).toBeNull()
  })
})

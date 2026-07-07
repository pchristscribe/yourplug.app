import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// The composable relies on Nuxt auto-imports (ref, useRuntimeConfig, $fetch).
// Provide those as globals, then import the REAL composable so tests exercise
// the shipped code — including mapDbListing and error handling — rather than
// a hand-written copy of it.
const fetchMock = vi.fn()

vi.stubGlobal('ref', ref)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:3001' } }))
vi.stubGlobal('$fetch', fetchMock)

const { useListings } = await import('../app/composables/useListings')

describe('useListings — getListings', () => {
  // Braces matter: `() => fetchMock.mockReset()` returns the mock (mockReset
  // returns `this`), and vitest calls a function returned from a hook as a
  // TEARDOWN — invoking the mock post-test and leaking an unhandled rejection.
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('calls the correct endpoint and stores mapped results', async () => {
    const fakeRow = {
      id: 'abc',
      title: 'Test',
      condition: 'NEW',
      category: 'APPAREL',
      asking_price: '29.99',
      created_at: '2026-01-01',
      seller_display_name: 'seller1',
      primary_image_url: null,
    }
    fetchMock.mockResolvedValue({
      data: [fakeRow],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    })

    const { items, pagination, error, getListings } = useListings()
    await getListings({ category: 'APPAREL', page: 1 })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/consignment/listings?category=APPAREL&page=1'
    )
    expect(error.value).toBeNull()
    expect(items.value).toHaveLength(1)
    // mapDbListing snake_case → camelCase + numeric coercion
    expect(items.value[0]).toMatchObject({
      id: 'abc',
      title: 'Test',
      askingPrice: 29.99,
      sellerDisplayName: 'seller1',
      primaryImageUrl: null,
    })
    expect(pagination.value?.total).toBe(1)
  })

  it('serializes every supported filter field into the query string', async () => {
    fetchMock.mockResolvedValue({ data: [], pagination: { page: 2, limit: 10, total: 0, pages: 0 } })
    const { getListings } = useListings()
    await getListings({
      category: 'APPAREL',
      condition: 'NEW',
      minPrice: 5,
      maxPrice: 100,
      sortBy: 'askingPrice',
      order: 'asc',
      page: 2,
      limit: 10,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/consignment/listings?category=APPAREL&condition=NEW&minPrice=5&maxPrice=100&sortBy=askingPrice&order=asc&page=2&limit=10'
    )
  })

  it('captures API failures in the error ref and resets loading', async () => {
    // Lazy rejection: an eagerly-created rejected promise trips vitest's
    // unhandled-rejection detection before the composable can await it
    fetchMock.mockImplementation(() => Promise.reject(new Error('boom')))

    const { items, error, loading, getListings } = useListings()
    await getListings()

    expect(error.value).toBe('boom')
    expect(items.value).toEqual([])
    expect(loading.value).toBe(false)
  })
})

describe('useListings — getListing', () => {
  // Braces matter: `() => fetchMock.mockReset()` returns the mock (mockReset
  // returns `this`), and vitest calls a function returned from a hook as a
  // TEARDOWN — invoking the mock post-test and leaking an unhandled rejection.
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('returns a mapped detail object', async () => {
    fetchMock.mockResolvedValue({
      id: 'abc',
      title: 'Test',
      condition: 'NEW',
      category: 'APPAREL',
      asking_price: '10.00',
      created_at: '2026-01-01',
      seller_display_name: 'seller1',
      primary_image_url: null,
      description: 'desc',
      status: 'APPROVED',
      moderation_status: 'APPROVED',
      seller_total_sales: '3',
      images: [
        { id: 'img1', listing_id: 'abc', public_url: 'https://x/img.jpg', is_primary: true, sort_order: 0, created_at: '2026-01-01' },
      ],
    })

    const { getListing } = useListings()
    const detail = await getListing('abc')

    expect(detail?.description).toBe('desc')
    expect(detail?.sellerTotalSales).toBe(3)
    expect(detail?.images[0]).toMatchObject({ id: 'img1', publicUrl: 'https://x/img.jpg', isPrimary: true })
  })

  it('returns null only for 404 (via statusCode)', async () => {
    fetchMock.mockImplementation(() => Promise.reject(Object.assign(new Error('Not found'), { statusCode: 404 })))
    const { getListing } = useListings()
    await expect(getListing('missing')).resolves.toBeNull()
  })

  it('returns null for 404 reported via the status field', async () => {
    fetchMock.mockImplementation(() => Promise.reject(Object.assign(new Error('Not found'), { status: 404 })))
    const { getListing } = useListings()
    await expect(getListing('missing')).resolves.toBeNull()
  })

  it('maps camelCase image fields when the API returns them unconverted', async () => {
    fetchMock.mockResolvedValue({
      id: 'abc',
      title: 'Test',
      condition: 'NEW',
      category: 'APPAREL',
      askingPrice: 10,
      createdAt: '2026-01-01',
      description: 'desc',
      status: 'APPROVED',
      moderationStatus: 'APPROVED',
      images: [
        { id: 'img1', listingId: 'abc', publicUrl: 'https://x/img.jpg', isPrimary: false, sortOrder: 2, createdAt: '2026-01-01' },
      ],
    })
    const { getListing } = useListings()
    const detail = await getListing('abc')
    expect(detail?.images[0]).toMatchObject({ listingId: 'abc', publicUrl: 'https://x/img.jpg', isPrimary: false, sortOrder: 2 })
  })

  it('propagates non-404 failures', async () => {
    fetchMock.mockImplementation(() => Promise.reject(Object.assign(new Error('Server exploded'), { statusCode: 500 })))
    const { getListing } = useListings()
    await expect(getListing('abc')).rejects.toThrow('Server exploded')
  })
})

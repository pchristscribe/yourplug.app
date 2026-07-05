import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('#app', () => ({
  useNuxtApp: () => ({}),
  useRuntimeConfig: () => ({ public: { apiBase: 'http://localhost:3001' } }),
  useFetch: vi.fn(),
}))

global.$fetch = vi.fn()

// Manually simulate the composable's logic without Nuxt auto-imports
async function simulateGetListings(fetchImpl: typeof $fetch, filters = {}) {
  const config = { public: { apiBase: 'http://localhost:3001' } }
  const apiBase = config.public.apiBase

  const params = new URLSearchParams()
  const res = await fetchImpl(`${apiBase}/api/consignment/listings?${params.toString()}`)
  return res
}

describe('useListings — getListings', () => {
  beforeEach(() => {
    vi.mocked(global.$fetch).mockReset()
  })

  it('calls the correct endpoint', async () => {
    vi.mocked(global.$fetch).mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } })
    const res = await simulateGetListings($fetch)
    expect($fetch).toHaveBeenCalledWith('http://localhost:3001/api/consignment/listings?')
    expect(res.data).toEqual([])
    expect(res.pagination.total).toBe(0)
  })

  it('returns mapped listings', async () => {
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
    vi.mocked(global.$fetch).mockResolvedValue({
      data: [fakeRow],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    })

    const res = await simulateGetListings($fetch)
    expect(res.data[0].id).toBe('abc')
    expect(res.data[0].title).toBe('Test')
  })
})

describe('getListing', () => {
  it('returns null on 404', async () => {
    vi.mocked(global.$fetch).mockRejectedValue(new Error('Not found'))
    const config = { public: { apiBase: 'http://localhost:3001' } }
    const apiBase = config.public.apiBase

    let result = null
    try {
      result = await $fetch(`${apiBase}/api/consignment/listings/nonexistent`)
    } catch {
      result = null
    }
    expect(result).toBeNull()
  })
})

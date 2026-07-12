import type { SellerListing } from '~/types/listings'

export function useSeller() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase
  const { getAuthHeaders } = useAuthHeaders()

  const listings = ref<SellerListing[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMyListings() {
    loading.value = true
    error.value = null
    try {
      const headers = await getAuthHeaders()
      listings.value = await $fetch(`${apiBase}/api/consignment/seller/listings`, { headers })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load your listings'
    } finally {
      loading.value = false
    }
  }

  async function createListing(payload: {
    title: string
    description?: string
    condition: string
    category: string
    askingPrice: number
  }): Promise<SellerListing> {
    error.value = null
    try {
      const headers = await getAuthHeaders()
      const listing = await $fetch<SellerListing>(`${apiBase}/api/consignment/seller/listings`, {
        method: 'POST',
        headers,
        body: payload,
      })
      listings.value.unshift(listing)
      return listing
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create listing'
      throw err
    }
  }

  async function submitListing(id: string) {
    error.value = null
    try {
      const headers = await getAuthHeaders()
      await $fetch(`${apiBase}/api/consignment/seller/listings/${id}/submit`, {
        method: 'POST',
        headers,
      })
      await fetchMyListings()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit listing'
      throw err
    }
  }

  async function deleteListing(id: string) {
    error.value = null
    try {
      const headers = await getAuthHeaders()
      await $fetch(`${apiBase}/api/consignment/seller/listings/${id}`, {
        method: 'DELETE',
        headers,
      })
      listings.value = listings.value.filter(l => l.id !== id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete listing'
      throw err
    }
  }

  return { listings, loading, error, fetchMyListings, createListing, submitListing, deleteListing }
}

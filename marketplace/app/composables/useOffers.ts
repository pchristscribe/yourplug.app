import type { ConsignmentOffer } from '~/types/listings'

export function useOffers() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase
  const { getAuthHeaders } = useAuthHeaders()

  const offers = ref<ConsignmentOffer[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMyOffers() {
    loading.value = true
    error.value = null
    try {
      const headers = await getAuthHeaders()
      offers.value = await $fetch(`${apiBase}/api/consignment/offers`, { headers })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load offers'
    } finally {
      loading.value = false
    }
  }

  async function submitOffer(listingId: string, payload: { amount: number; message?: string }): Promise<ConsignmentOffer> {
    loading.value = true
    error.value = null
    try {
      const headers = await getAuthHeaders()
      return await $fetch(`${apiBase}/api/consignment/offers/listings/${listingId}/offers`, {
        method: 'POST',
        headers,
        body: payload,
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit offer'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function withdrawOffer(offerId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const headers = await getAuthHeaders()
      await $fetch(`${apiBase}/api/consignment/offers/${offerId}`, {
        method: 'DELETE',
        headers,
      })
      offers.value = offers.value.filter(o => o.id !== offerId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to withdraw offer'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function initiateCheckout(offerId: string): Promise<{ checkoutUrl: string }> {
    loading.value = true
    error.value = null
    try {
      const headers = await getAuthHeaders()
      return await $fetch(`${apiBase}/api/consignment/offers/transactions`, {
        method: 'POST',
        headers,
        body: { offerId },
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start checkout'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { offers, loading, error, fetchMyOffers, submitOffer, withdrawOffer, initiateCheckout }
}

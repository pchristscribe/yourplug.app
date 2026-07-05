import type { ConsignmentOffer } from '~/types/listings'

export function useOffers() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase
  const supabase = useSupabaseClient()

  const offers = ref<ConsignmentOffer[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

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
    const headers = await getAuthHeaders()
    return $fetch(`${apiBase}/api/consignment/offers/listings/${listingId}/offers`, {
      method: 'POST',
      headers,
      body: payload,
    })
  }

  async function withdrawOffer(offerId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await $fetch(`${apiBase}/api/consignment/offers/${offerId}`, {
      method: 'DELETE',
      headers,
    })
    offers.value = offers.value.filter(o => o.id !== offerId)
  }

  async function initiateCheckout(offerId: string): Promise<{ checkoutUrl: string }> {
    const headers = await getAuthHeaders()
    return $fetch(`${apiBase}/api/consignment/offers/transactions`, {
      method: 'POST',
      headers,
      body: { offerId },
    })
  }

  return { offers, loading, error, fetchMyOffers, submitOffer, withdrawOffer, initiateCheckout }
}

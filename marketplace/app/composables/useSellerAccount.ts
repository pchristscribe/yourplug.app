export function useSellerAccount() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase
  const { getAuthHeaders } = useAuthHeaders()

  const onboarded = ref(false)
  const hasAccount = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchStripeStatus() {
    loading.value = true
    error.value = null
    try {
      const headers = await getAuthHeaders()
      const status = await $fetch<{ onboarded: boolean; hasAccount: boolean }>(
        `${apiBase}/api/consignment/seller/stripe/status`,
        { headers }
      )
      onboarded.value = status.onboarded
      hasAccount.value = status.hasAccount
    } catch (err) {
      // A failed status check is NOT the same as "not onboarded" — surface it
      // so the UI can distinguish an outage from a seller who needs onboarding.
      error.value = err instanceof Error ? err.message : 'Failed to load Stripe status'
    } finally {
      loading.value = false
    }
  }

  async function startOnboarding(): Promise<{ url?: string; alreadyOnboarded?: boolean }> {
    const headers = await getAuthHeaders()
    return $fetch(`${apiBase}/api/consignment/seller/stripe/onboard`, {
      method: 'POST',
      headers,
    })
  }

  // Shared onboarding + redirect flow — used by both StripeOnboardBanner.vue
  // and account/stripe.vue so error handling isn't duplicated between them.
  async function goToOnboarding(): Promise<{ success: boolean; alreadyOnboarded?: boolean; error?: string }> {
    try {
      const result = await startOnboarding()
      if (result.url) {
        await navigateTo(result.url, { external: true })
        return { success: true }
      }
      if (result.alreadyOnboarded) {
        return { success: true, alreadyOnboarded: true }
      }
      return { success: false, error: 'Could not start Stripe onboarding. Try again.' }
    } catch {
      return { success: false, error: 'Could not start Stripe onboarding. Try again.' }
    }
  }

  return { onboarded, hasAccount, loading, error, fetchStripeStatus, startOnboarding, goToOnboarding, getAuthHeaders }
}

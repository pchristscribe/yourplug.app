export function useSellerAccount() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase
  const supabase = useSupabaseClient()

  const onboarded = ref(false)
  const hasAccount = ref(false)
  const loading = ref(false)

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function fetchStripeStatus() {
    loading.value = true
    try {
      const headers = await getAuthHeaders()
      const status = await $fetch<{ onboarded: boolean; hasAccount: boolean }>(
        `${apiBase}/api/consignment/seller/stripe/status`,
        { headers }
      )
      onboarded.value = status.onboarded
      hasAccount.value = status.hasAccount
    } catch {
      onboarded.value = false
      hasAccount.value = false
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

  return { onboarded, hasAccount, loading, fetchStripeStatus, startOnboarding, getAuthHeaders }
}

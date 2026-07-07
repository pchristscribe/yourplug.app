// Single source of truth for bearer-token auth headers — previously
// duplicated across useOffers, useSeller, and useSellerAccount.
export function useAuthHeaders() {
  const supabase = useSupabaseClient()

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  return { getAuthHeaders }
}

export default defineNuxtRouteMiddleware(async () => {
  const supabase = useSupabaseClient()
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      return navigateTo('/login')
    }
  } catch {
    return navigateTo('/login')
  }
})

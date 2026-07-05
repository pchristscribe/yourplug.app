export default defineNuxtRouteMiddleware(async () => {
  const supabase = useSupabaseClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    return navigateTo('/login')
  }
})

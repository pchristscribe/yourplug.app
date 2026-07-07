<template>
  <div class="min-h-screen flex items-center justify-center">
    <p v-if="!timedOut" class="text-ink-muted">Signing you in…</p>
    <p v-else class="text-status-error text-sm">
      Sign-in is taking longer than expected.
      <NuxtLink to="/login" class="underline">Try again</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
// Redirecting immediately on mount can race Supabase's session exchange —
// wait for the user to actually materialize before leaving this page.
const user = useSupabaseUser()
const timedOut = ref(false)

watch(user, (u) => {
  if (u) navigateTo('/')
}, { immediate: true })

onMounted(() => {
  setTimeout(() => {
    if (!user.value) timedOut.value = true
  }, 10000)
})
</script>

<template>
  <div class="min-h-screen bg-surface-light dark:bg-surface-dark font-sans">
    <header class="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-surface/95 dark:bg-surface-raised/95 backdrop-blur">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="font-bold text-lg text-brand">Plug Market</NuxtLink>

        <nav class="hidden sm:flex items-center gap-6 text-sm font-medium text-ink-muted">
          <NuxtLink to="/" class="hover:text-ink">Browse</NuxtLink>
          <NuxtLink to="/sell" class="hover:text-ink">Sell</NuxtLink>
          <NuxtLink to="/dashboard" class="hover:text-ink">Dashboard</NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <template v-if="user">
            <NuxtLink to="/dashboard" class="text-sm text-ink-muted hover:text-ink">{{ user.email }}</NuxtLink>
            <button @click="signOut" class="text-sm text-ink-subtle hover:text-ink">Sign out</button>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="text-sm font-medium bg-brand text-white px-4 py-1.5 rounded-input hover:bg-brand-hover">
              Sign in
            </NuxtLink>
          </template>
        </div>
      </div>
    </header>

    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

async function signOut() {
  await supabase.auth.signOut()
  navigateTo('/login')
}
</script>

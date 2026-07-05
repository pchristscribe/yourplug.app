<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-ink">Sign in to Plug Market</h1>
        <p class="text-sm text-ink-muted mt-1">Buy and sell with the community</p>
      </div>

      <div class="space-y-3">
        <button @click="signIn('google')" class="w-full flex items-center justify-center gap-3 rounded-input border border-gray-200 px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-light dark:hover:bg-surface-raised">
          <span>Continue with Google</span>
        </button>
        <button @click="signIn('github')" class="w-full flex items-center justify-center gap-3 rounded-input border border-gray-200 px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-light dark:hover:bg-surface-raised">
          <span>Continue with GitHub</span>
        </button>
        <button @click="signIn('discord')" class="w-full flex items-center justify-center gap-3 rounded-input border border-gray-200 px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-light dark:hover:bg-surface-raised">
          <span>Continue with Discord</span>
        </button>
      </div>

      <p class="text-xs text-center text-ink-subtle">
        By signing in you agree to our terms. This marketplace is for adults 18+.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const config = useRuntimeConfig()

async function signIn(provider: 'google' | 'github' | 'discord') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${config.public.siteUrl}/confirm`,
    },
  })
  if (error) console.error(error)
}
</script>

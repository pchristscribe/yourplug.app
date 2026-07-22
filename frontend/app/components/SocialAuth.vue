<template>
  <div class="flex flex-col gap-3 w-full">
    <p v-if="error" class="text-sm text-status-error text-center" role="alert">
      {{ error }}
    </p>

    <button
      v-for="provider in providers"
      :key="provider.id"
      type="button"
      :disabled="loading === provider.id"
      class="relative flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface dark:bg-surface-raised text-ink dark:text-ink-inverse font-medium text-sm transition-colors duration-base hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
      @click="handleSignIn(provider.id)"
    >
      <!-- Spinner -->
      <span
        v-if="loading === provider.id"
        class="absolute left-4 w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"
        aria-hidden="true"
      />

      <!-- Provider icon -->
      <component :is="provider.icon" v-else class="w-5 h-5 shrink-0" aria-hidden="true" />

      <span>{{ loading === provider.id ? 'Redirecting…' : `Continue with ${provider.label}` }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'
import type { Provider } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Provider icon components — defined at module scope so withDefaults can
// reference them (defineProps is hoisted outside setup() by the compiler)
// ---------------------------------------------------------------------------

const GoogleIcon = defineComponent({
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', {
        d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z',
        fill: '#4285F4',
      }),
      h('path', {
        d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z',
        fill: '#34A853',
      }),
      h('path', {
        d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z',
        fill: '#FBBC05',
      }),
      h('path', {
        d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z',
        fill: '#EA4335',
      }),
    ])
  },
})

const GitHubIcon = defineComponent({
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', {
        d: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
      }),
    ])
  },
})

const DiscordIcon = defineComponent({
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: '#5865F2' }, [
      h('path', {
        d: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
      }),
    ])
  },
})

export interface OAuthProvider {
  id: Provider
  label: string
  icon: ReturnType<typeof defineComponent>
}

export const defaultProviders: OAuthProvider[] = [
  { id: 'google' as Provider, label: 'Google', icon: GoogleIcon },
  { id: 'github' as Provider, label: 'GitHub', icon: GitHubIcon },
  { id: 'discord' as Provider, label: 'Discord', icon: DiscordIcon },
]
</script>

<script setup lang="ts">
// ---------------------------------------------------------------------------
// Props & setup
// ---------------------------------------------------------------------------

const props = withDefaults(
  defineProps<{
    providers?: OAuthProvider[]
  }>(),
  {
    providers: () => defaultProviders,
  }
)

const { signInWithOAuth } = useAuth()
const loading = ref<Provider | null>(null)
const error = ref<string | null>(null)

async function handleSignIn(provider: Provider) {
  error.value = null
  loading.value = provider
  try {
    await signInWithOAuth(provider)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
    loading.value = null
  }
}
</script>

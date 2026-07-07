<template>
  <div v-if="show" class="bg-brand text-white px-4 py-3 flex items-center justify-between gap-4">
    <p class="text-sm font-medium">
      Complete your Stripe setup to start selling and receive payouts.
    </p>
    <div class="shrink-0 flex flex-col items-end gap-1">
      <button
        @click="onboard"
        :disabled="loading"
        class="rounded-input bg-white text-brand text-sm font-semibold px-4 py-1.5 hover:bg-brand-muted disabled:opacity-60"
      >
        {{ loading ? 'Loading…' : 'Set up payouts' }}
      </button>
      <p v-if="errorMessage" class="text-xs text-white/90" role="alert">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ show: boolean }>()
const { startOnboarding } = useSellerAccount()
const loading = ref(false)
const errorMessage = ref<string | null>(null)

async function onboard() {
  loading.value = true
  errorMessage.value = null
  try {
    const result = await startOnboarding()
    if (result.url) {
      await navigateTo(result.url, { external: true })
    } else if (!result.alreadyOnboarded) {
      errorMessage.value = 'Could not start Stripe onboarding. Try again.'
    }
  } catch {
    errorMessage.value = 'Could not start Stripe onboarding. Try again.'
  } finally {
    loading.value = false
  }
}
</script>

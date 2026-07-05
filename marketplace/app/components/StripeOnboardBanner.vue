<template>
  <div v-if="show" class="bg-brand text-white px-4 py-3 flex items-center justify-between gap-4">
    <p class="text-sm font-medium">
      Complete your Stripe setup to start selling and receive payouts.
    </p>
    <button
      @click="onboard"
      :disabled="loading"
      class="shrink-0 rounded-input bg-white text-brand text-sm font-semibold px-4 py-1.5 hover:bg-brand-muted disabled:opacity-60"
    >
      {{ loading ? 'Loading…' : 'Set up payouts' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ show: boolean }>()
const { startOnboarding } = useSellerAccount()
const loading = ref(false)

async function onboard() {
  loading.value = true
  try {
    const result = await startOnboarding()
    if (result.url) {
      navigateTo(result.url, { external: true })
    }
  } finally {
    loading.value = false
  }
}
</script>

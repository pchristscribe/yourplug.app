<template>
  <div class="max-w-xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-ink mb-6">Stripe Payouts</h1>

    <div v-if="loading" class="text-ink-muted text-sm">Loading…</div>

    <div v-else-if="onboarded" class="rounded-card bg-green-50 border border-green-200 p-6 dark:bg-green-900/20">
      <p class="font-semibold text-green-800 dark:text-green-400">Stripe setup complete ✓</p>
      <p class="text-sm text-green-700 dark:text-green-500 mt-1">Your payouts are active. You'll receive 85% of each sale price.</p>
    </div>

    <div v-else class="space-y-4">
      <p class="text-ink-muted text-sm">
        Connect your bank account via Stripe to receive payouts from your sales. The platform keeps a 15% fee.
      </p>
      <p v-if="route.query.onboard === 'success'" class="rounded-input bg-green-50 border border-green-200 p-3 text-sm text-green-800">
        Onboarding complete! It may take a few minutes to activate.
      </p>
      <p v-if="route.query.onboard === 'refresh'" class="rounded-input bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
        Onboarding incomplete. Please try again.
      </p>
      <button
        @click="startSetup"
        :disabled="startingSetup"
        class="px-6 py-2.5 bg-brand text-white font-semibold rounded-input hover:bg-brand-hover disabled:opacity-50"
      >
        {{ startingSetup ? 'Loading…' : 'Connect with Stripe' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const { onboarded, loading, fetchStripeStatus, startOnboarding } = useSellerAccount()
const startingSetup = ref(false)

onMounted(fetchStripeStatus)

async function startSetup() {
  startingSetup.value = true
  try {
    const result = await startOnboarding()
    if (result.url) navigateTo(result.url, { external: true })
  } finally {
    startingSetup.value = false
  }
}
</script>

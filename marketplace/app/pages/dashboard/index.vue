<template>
  <div class="max-w-4xl mx-auto px-4 py-8 space-y-10">
    <StripeOnboardBanner :show="!stripeOnboarded" />

    <div v-if="loadError" class="rounded-input bg-brand-muted border border-brand p-3 text-sm text-brand" role="alert">
      {{ loadError }}
    </div>

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-ink">Your Listings</h2>
        <NuxtLink to="/sell" class="text-sm font-medium text-brand hover:text-brand-hover">+ New listing</NuxtLink>
      </div>
      <div v-if="sellerLoading" class="text-ink-muted text-sm">Loading…</div>
      <div v-else-if="listings.length === 0" class="text-ink-muted text-sm">No listings yet.</div>
      <div v-else class="space-y-3">
        <div v-for="l in listings" :key="l.id" class="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
          <div class="w-14 h-14 rounded-input overflow-hidden bg-surface-light shrink-0">
            <img v-if="l.images?.[0]?.publicUrl" :src="l.images[0].publicUrl" class="w-full h-full object-cover" :alt="l.title" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-ink truncate">{{ l.title }}</p>
            <p class="text-sm text-ink-muted">${{ Number(l.askingPrice).toFixed(2) }} · {{ l.status }}</p>
          </div>
          <ModerationBadge :status="l.moderationStatus" />
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-xl font-bold text-ink mb-4">My Offers</h2>
      <div v-if="checkoutError" class="mb-3 rounded-input bg-brand-muted border border-brand p-3 text-sm text-brand" role="alert">
        {{ checkoutError }}
      </div>
      <div v-if="offersLoading" class="text-ink-muted text-sm">Loading…</div>
      <div v-else-if="offers.length === 0" class="text-ink-muted text-sm">No offers yet.</div>
      <div v-else class="space-y-3">
        <div v-for="o in offers" :key="o.id" class="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-ink truncate">{{ o.listingTitle }}</p>
            <p class="text-sm text-ink-muted">Your offer: ${{ Number(o.amount).toFixed(2) }} · {{ o.status }}</p>
          </div>
          <button
            v-if="o.status === 'ACCEPTED'"
            @click="checkout(o.id)"
            class="shrink-0 px-4 py-1.5 bg-brand text-white text-sm font-semibold rounded-input hover:bg-brand-hover"
          >
            Pay now
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { listings, loading: sellerLoading, fetchMyListings } = useSeller()
const { offers, loading: offersLoading, fetchMyOffers, initiateCheckout } = useOffers()
const { onboarded: stripeOnboarded, fetchStripeStatus } = useSellerAccount()

const loadError = ref<string | null>(null)
const checkoutError = ref<string | null>(null)

onMounted(async () => {
  // Each fetcher stores its own error state; this catch covers anything that
  // still rejects so a single failure can't leave the dashboard half-dead
  // with no explanation.
  try {
    await Promise.all([fetchMyListings(), fetchMyOffers(), fetchStripeStatus()])
  } catch {
    loadError.value = 'Some dashboard data failed to load. Try refreshing.'
  }
})

async function checkout(offerId: string) {
  checkoutError.value = null
  try {
    const { checkoutUrl } = await initiateCheckout(offerId)
    if (!checkoutUrl) {
      checkoutError.value = 'Checkout could not be started. Please try again.'
      return
    }
    await navigateTo(checkoutUrl, { external: true })
  } catch (err: unknown) {
    const apiErr = err as { data?: { error?: string } }
    checkoutError.value = apiErr?.data?.error ?? 'Checkout failed. Please try again.'
  }
}
</script>

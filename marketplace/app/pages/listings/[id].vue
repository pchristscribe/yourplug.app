<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div v-if="loading" class="text-ink-muted">Loading…</div>
    <div v-else-if="error || !listing" class="text-status-error">{{ error ?? 'Listing not found' }}</div>
    <template v-else>
      <!-- Images -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div class="aspect-square rounded-card overflow-hidden bg-surface-light">
          <img v-if="activeImage" :src="activeImage" :alt="listing.title" class="h-full w-full object-cover" />
          <div v-else class="flex h-full items-center justify-center text-4xl">📦</div>
        </div>
        <div v-if="listing.images.length > 1" class="grid grid-cols-3 gap-2 content-start">
          <button
            v-for="img in listing.images" :key="img.id"
            @click="activeImage = img.publicUrl"
            :class="['aspect-square rounded-input overflow-hidden border-2 transition-colors', activeImage === img.publicUrl ? 'border-brand' : 'border-transparent']"
          >
            <img :src="img.publicUrl" class="h-full w-full object-cover" :alt="listing.title" />
          </button>
        </div>
      </div>

      <!-- Detail -->
      <div class="space-y-4">
        <div class="flex items-start justify-between gap-4">
          <h1 class="text-2xl font-bold text-ink">{{ listing.title }}</h1>
          <span class="text-2xl font-bold text-brand shrink-0">${{ listing.askingPrice.toFixed(2) }}</span>
        </div>

        <div class="flex gap-2 flex-wrap">
          <span class="rounded-pill bg-brand-muted text-brand text-sm px-3 py-0.5">{{ listing.condition }}</span>
          <span class="rounded-pill bg-accent-muted text-ink-muted text-sm px-3 py-0.5">{{ listing.category }}</span>
        </div>

        <p v-if="listing.description" class="text-ink-muted text-sm leading-relaxed">{{ listing.description }}</p>

        <p class="text-xs text-ink-subtle">
          Sold by {{ listing.sellerDisplayName || 'a verified seller' }}
          <span v-if="listing.sellerTotalSales > 0"> · {{ listing.sellerTotalSales }} sales</span>
        </p>

        <div v-if="user" class="pt-2">
          <button
            @click="offerOpen = true"
            class="w-full sm:w-auto px-6 py-2.5 bg-brand text-white font-semibold rounded-input hover:bg-brand-hover"
          >
            Make an Offer
          </button>
        </div>
        <div v-else class="pt-2">
          <NuxtLink to="/login" class="inline-block px-6 py-2.5 bg-brand text-white font-semibold rounded-input hover:bg-brand-hover">
            Sign in to make an offer
          </NuxtLink>
        </div>
      </div>

      <OfferModal
        :open="offerOpen"
        :listing-id="listing.id"
        :asking-price="listing.askingPrice"
        @close="offerOpen = false"
        @submitted="offerOpen = false"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const user = useSupabaseUser()
const { getListing } = useListings()

const listing = ref<Awaited<ReturnType<typeof getListing>>>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const activeImage = ref<string | null>(null)
const offerOpen = ref(false)

async function load(id: string) {
  loading.value = true
  error.value = null
  activeImage.value = null
  try {
    listing.value = await getListing(id)
    if (!listing.value) {
      error.value = 'Listing not found'
    } else {
      const primary = listing.value.images.find(i => i.isPrimary) ?? listing.value.images[0]
      activeImage.value = primary?.publicUrl ?? null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load listing'
  } finally {
    loading.value = false
  }
}

// Watch the route param, not just onMounted: client-side navigation between
// two listings reuses this component instance, which would otherwise keep
// showing the previous listing under the new URL.
watch(() => route.params.id, (id) => {
  if (typeof id === 'string') load(id)
}, { immediate: true })
</script>

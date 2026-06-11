<script setup lang="ts">
import type { Product, Pagination } from '~/types'
import { getSeason, SEASON_LIST } from '~/utils/seasons'

const route = useRoute()
const slug = computed(() => route.params.season as string)
const season = computed(() => getSeason(slug.value))

const supabaseProducts = useSupabaseProducts()

const { data, pending: loading, error } = await useAsyncData(
  `season-${slug.value}`,
  () => {
    const s = season.value
    if (!s) return Promise.resolve({ products: [] as Product[], pagination: null as Pagination | null })
    return supabaseProducts.getProducts({
      tag: s.tag,
      limit: 24,
      sortBy: 'createdAt',
      order: 'desc',
    })
  },
  { watch: [slug] },
)

const products = computed(() => data.value?.products ?? [])
const pagination = computed(() => data.value?.pagination ?? null)

useHead(() => ({
  title: season.value
    ? `${season.value.label} Picks · yourplug`
    : 'Seasonal · yourplug',
  meta: [
    {
      name: 'description',
      content: season.value?.blurb ?? 'Seasonal product recommendations.',
    },
  ],
}))
</script>

<template>
  <div class="space-y-8">
    <!-- Unknown season -->
    <div v-if="!season" class="text-center py-12">
      <h1 class="text-2xl font-bold text-ink dark:text-ink-inverse mb-4">
        Unknown season
      </h1>
      <p class="text-ink-muted dark:text-ink-subtle mb-6">
        We don't have a collection for "{{ slug }}".
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <NuxtLink
          v-for="s in SEASON_LIST"
          :key="s.slug"
          :to="`/seasonal/${s.slug}`"
          class="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-sm hover:bg-brand hover:text-white hover:border-brand transition-colors"
        >
          {{ s.label }}
        </NuxtLink>
      </div>
    </div>

    <template v-else>
      <!-- Hero -->
      <header class="bg-gradient-to-r from-brand to-accent rounded-xl p-8 text-white shadow-card">
        <p class="text-sm uppercase tracking-wider opacity-80 mb-1">In season</p>
        <h1 class="text-4xl font-bold mb-2">{{ season.label }} Picks</h1>
        <p class="text-lg opacity-90">{{ season.blurb }}</p>
      </header>

      <!-- Season nav -->
      <nav class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="s in SEASON_LIST"
          :key="s.slug"
          :to="`/seasonal/${s.slug}`"
          class="px-3 py-1.5 rounded-full text-sm border transition-colors"
          :class="s.slug === season.slug
            ? 'border-brand bg-brand text-white'
            : 'border-gray-300 dark:border-gray-600 text-ink dark:text-ink-muted hover:border-brand hover:text-brand'"
        >
          {{ s.label }}
        </NuxtLink>
      </nav>

      <!-- Results -->
      <ProductGrid :products="products" :loading="loading" />

      <p
        v-if="!loading && products.length === 0 && !error"
        class="text-center text-ink-muted dark:text-ink-subtle py-8"
      >
        No {{ season.label.toLowerCase() }} products tagged yet. Check back soon.
      </p>

      <p v-if="error" class="text-center text-status-error py-8">{{ error.message }}</p>
    </template>
  </div>
</template>

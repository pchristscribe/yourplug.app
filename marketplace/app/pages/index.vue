<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-ink mb-6">Browse Listings</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <select v-model="filters.category" aria-label="Filter by category" @change="search" class="rounded-input border border-gray-200 px-3 py-1.5 text-sm text-ink dark:bg-surface-dark dark:border-gray-600">
        <option value="">All categories</option>
        <option v-for="c in CATEGORY_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <select v-model="filters.condition" aria-label="Filter by condition" @change="search" class="rounded-input border border-gray-200 px-3 py-1.5 text-sm text-ink dark:bg-surface-dark dark:border-gray-600">
        <option value="">All conditions</option>
        <option v-for="c in CONDITION_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <select v-model="filters.sortBy" aria-label="Sort listings" @change="search" class="rounded-input border border-gray-200 px-3 py-1.5 text-sm text-ink dark:bg-surface-dark dark:border-gray-600">
        <option value="createdAt">Newest</option>
        <option value="askingPrice">Price</option>
      </select>
    </div>

    <div v-if="loading" class="text-ink-muted text-sm">Loading…</div>
    <div v-else-if="error" class="text-status-error text-sm">{{ error }}</div>
    <div v-else-if="items.length === 0" class="text-ink-muted text-sm">No listings found.</div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <ListingCard v-for="item in items" :key="item.id" :listing="item" />
    </div>

    <!-- Pagination (windowed: first, last, current ±1) -->
    <nav v-if="pagination && pagination.pages > 1" aria-label="Pagination" class="mt-8 flex justify-center items-center gap-2">
      <template v-for="(p, i) in pageWindow" :key="`${p}-${i}`">
        <span v-if="p === '…'" class="px-2 text-sm text-ink-subtle">…</span>
        <button
          v-else
          @click="goToPage(p as number)"
          :aria-current="p === pagination.page ? 'page' : undefined"
          :class="['px-3 py-1.5 text-sm rounded-input', p === pagination.page ? 'bg-brand text-white' : 'bg-surface border border-gray-200 text-ink-muted hover:text-ink']"
        >
          {{ p }}
        </button>
      </template>
    </nav>
  </div>
</template>

<script setup lang="ts">
import type { ListingFilters } from '~/types/listings'
import { CATEGORY_OPTIONS, CONDITION_OPTIONS } from '~/utils/listingLabels'

const { items, pagination, loading, error, getListings } = useListings()

// First page, last page, and current ±1 — with ellipsis gaps.
const pageWindow = computed<(number | '…')[]>(() => {
  if (!pagination.value) return []
  const { page, pages } = pagination.value
  const shown = new Set([1, pages, page - 1, page, page + 1].filter(p => p >= 1 && p <= pages))
  const sorted = [...shown].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
})

const filters = ref<ListingFilters>({ sortBy: 'createdAt', order: 'desc', page: 1 })

function search() {
  filters.value.page = 1
  getListings(filters.value)
}

function goToPage(p: number) {
  filters.value.page = p
  getListings(filters.value)
}

onMounted(() => getListings(filters.value))
</script>

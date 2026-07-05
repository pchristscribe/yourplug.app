<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-ink mb-6">Browse Listings</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <select v-model="filters.category" @change="search" class="rounded-input border border-gray-200 px-3 py-1.5 text-sm text-ink dark:bg-surface-dark dark:border-gray-600">
        <option value="">All categories</option>
        <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <select v-model="filters.condition" @change="search" class="rounded-input border border-gray-200 px-3 py-1.5 text-sm text-ink dark:bg-surface-dark dark:border-gray-600">
        <option value="">All conditions</option>
        <option v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <select v-model="filters.sortBy" @change="search" class="rounded-input border border-gray-200 px-3 py-1.5 text-sm text-ink dark:bg-surface-dark dark:border-gray-600">
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

    <!-- Pagination -->
    <div v-if="pagination && pagination.pages > 1" class="mt-8 flex justify-center gap-2">
      <button
        v-for="p in pagination.pages" :key="p"
        @click="goToPage(p)"
        :class="['px-3 py-1.5 text-sm rounded-input', p === pagination.page ? 'bg-brand text-white' : 'bg-surface border border-gray-200 text-ink-muted hover:text-ink']"
      >
        {{ p }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ListingFilters } from '~/types/listings'

const CATEGORIES = [
  { value: 'APPAREL', label: 'Apparel' },
  { value: 'ACCESSORIES', label: 'Accessories' },
  { value: 'UNDERWEAR', label: 'Underwear' },
  { value: 'HARNESS', label: 'Harness' },
  { value: 'TOY', label: 'Toy' },
  { value: 'OTHER', label: 'Other' },
]

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
]

const { items, pagination, loading, error, getListings } = useListings()

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

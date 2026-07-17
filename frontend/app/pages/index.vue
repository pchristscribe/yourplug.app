<script setup lang="ts">
const productStore = useProductStore()
const filterStore = useFilterStore()
const router = useRouter()
const route = useRoute()
const { public: { siteUrl } } = useRuntimeConfig()

useSeoMeta({
  title: 'yourplug',
  description: 'Curated products for gay men — reviewed and hand-picked from DHgate, AliExpress, Amazon, and Wish.',
  ogTitle: 'yourplug — Curated Products for Gay Men',
  ogDescription: 'Curated products for gay men — reviewed and hand-picked from DHgate, AliExpress, Amazon, and Wish.',
  ogUrl: siteUrl,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

// Initialize filters from URL query params on mount
onMounted(async () => {
  // Initialize filters from URL
  filterStore.initFromQuery(route.query)

  // Fetch initial data
  await Promise.all([
    productStore.fetchCategories(),
    applyFilters(),
  ])
})

// Apply filters and update URL
const applyFilters = async () => {
  // Convert filter state to product filters
  const productFilters = filterStore.toProductFilters

  // Fetch products with filters
  await productStore.fetchProducts(productFilters)

  // Update URL with query params
  const queryParams = filterStore.toQueryParams()
  await router.push({
    query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
  })
}

// Handle sorting changes
const handleSortingChange = (sortBy: string, order: 'asc' | 'desc') => {
  filterStore.setSorting(sortBy as any, order)
  applyFilters()
}

// Handle pagination
const handlePageChange = (page: number) => {
  productStore.setFilters({ page })
  productStore.fetchProducts()

  // Scroll to top smoothly
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Watch for URL changes (back/forward navigation)
watch(() => route.query, (newQuery) => {
  filterStore.initFromQuery(newQuery)
  applyFilters()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Hero Section -->
    <div class="relative overflow-hidden bg-gradient-to-r from-brand to-brand-active rounded-card p-8 shadow-raised">
      <div class="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-accent/20 to-transparent pointer-events-none" aria-hidden="true" />
      <h1 class="text-4xl font-bold mb-2 text-ink-inverse">
        Curated Products for Gay Men
      </h1>
      <p class="text-lg text-ink-inverse/90">
        Discover quality products from DHgate, AliExpress, Amazon, and Wish
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Sidebar Filters -->
      <aside class="lg:col-span-1">
        <FiltersProductFilters
          :categories="productStore.categories"
          @apply="applyFilters"
        />
      </aside>

      <!-- Main Content -->
      <main class="lg:col-span-3 space-y-6">
        <!-- Toolbar -->
        <div class="bg-surface dark:bg-surface-raised rounded-card shadow-card border border-gray-100 dark:border-gray-700 px-6 py-4 transition-colors duration-slow">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <!-- Results Count -->
            <div class="text-sm text-ink-muted dark:text-ink-subtle">
              <template v-if="!productStore.loading">
                Showing
                <span class="font-medium text-ink dark:text-ink-inverse">
                  {{ productStore.filteredProducts.length }}
                </span>
                of
                <span class="font-medium text-ink dark:text-ink-inverse">
                  {{ productStore.totalProducts }}
                </span>
                products
              </template>
            </div>

            <!-- Sorting Controls -->
            <FiltersSortingControls @update="handleSortingChange" />
          </div>
        </div>

        <!-- Products Grid -->
        <ProductGrid
          :products="productStore.filteredProducts"
          :loading="productStore.loading"
        />

        <!-- Pagination -->
        <div v-if="productStore.pagination && !productStore.loading">
          <Pagination
            :pagination="productStore.pagination"
            @change="handlePageChange"
          />
        </div>
      </main>
    </div>
  </div>
</template>

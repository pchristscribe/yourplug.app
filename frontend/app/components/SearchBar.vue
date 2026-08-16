<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, useId } from 'vue'
import type { Product } from '~/types'

interface Props {
  placeholder?: string
  debounceMs?: number
  minChars?: number
  maxResults?: number
}

interface Emits {
  (e: 'select', product: Product): void
  (e: 'search', query: string): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search products...',
  debounceMs: 300,
  minChars: 2,
  maxResults: 10,
})

const emit = defineEmits<Emits>()

// Unique per-instance id so multiple SearchBars (e.g. desktop + mobile) don't
// collide on the dropdown id / aria-controls target.
const resultsId = `search-results-${useId()}`

// State
const searchQuery = ref('')
const isOpen = ref(false)
const isFocused = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const results = ref<Product[]>([])
const selectedIndex = ref(-1)
const inputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Data access — Supabase-direct (see composables/useSupabaseProducts.ts)
const api = useSupabaseProducts()

// Computed
const showDropdown = computed(() => {
  return isOpen.value && isFocused.value && searchQuery.value.length >= props.minChars
})

const hasError = computed(() => error.value !== null)

const hasResults = computed(() => results.value.length > 0)

const displayResults = computed(() => {
  return results.value.slice(0, props.maxResults)
})

// Search function
const performSearch = async (query: string) => {
  if (query.length < props.minChars) {
    results.value = []
    isLoading.value = false
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const response = await api.searchProducts(query, { limit: props.maxResults })
    results.value = response.products
    isOpen.value = true
    emit('search', query)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Search failed'
    console.error('Search error:', err)
    results.value = []
    isOpen.value = true // Show dropdown even with error
  } finally {
    isLoading.value = false
  }
}

// Debounced search
const debouncedSearch = (query: string) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    performSearch(query)
  }, props.debounceMs)
}

// Watch search query
watch(searchQuery, (newQuery) => {
  if (newQuery.length === 0) {
    results.value = []
    isOpen.value = false
    selectedIndex.value = -1
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  } else {
    debouncedSearch(newQuery)
  }
})

// Keyboard navigation
const handleKeyDown = (event: KeyboardEvent) => {
  if (!showDropdown.value) {
    if (event.key === 'ArrowDown' && searchQuery.value.length >= props.minChars) {
      isOpen.value = true
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, displayResults.value.length - 1)
      scrollToSelected()
      break

    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
      scrollToSelected()
      break

    case 'Enter':
      event.preventDefault()
      if (selectedIndex.value >= 0 && selectedIndex.value < displayResults.value.length) {
        selectProduct(displayResults.value[selectedIndex.value])
      }
      break

    case 'Escape':
      event.preventDefault()
      closeDropdown()
      inputRef.value?.blur()
      break

    case 'Tab':
      closeDropdown()
      break
  }
}

// Scroll selected item into view
const scrollToSelected = () => {
  if (selectedIndex.value >= 0 && dropdownRef.value) {
    const selectedElement = dropdownRef.value.children[selectedIndex.value] as HTMLElement
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }
}

// Select product
const selectProduct = (product: Product) => {
  emit('select', product)
  searchQuery.value = product.title
  closeDropdown()
  inputRef.value?.blur()
}

// Close dropdown
const closeDropdown = () => {
  isOpen.value = false
  selectedIndex.value = -1
}

// Handle input focus
const handleFocus = () => {
  isFocused.value = true
  if (searchQuery.value.length >= props.minChars && results.value.length > 0) {
    isOpen.value = true
  }
}

// Handle input blur
const handleBlur = () => {
  // Delay to allow click events on dropdown items
  setTimeout(() => {
    isFocused.value = false
    closeDropdown()
  }, 200)
}

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (
    inputRef.value &&
    !inputRef.value.contains(target) &&
    dropdownRef.value &&
    !dropdownRef.value.contains(target)
  ) {
    closeDropdown()
  }
}

// Clear search
const clearSearch = () => {
  searchQuery.value = ''
  results.value = []
  selectedIndex.value = -1
  inputRef.value?.focus()
}

// Lifecycle hooks
onMounted(() => {
  if (process.client) {
    document.addEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  if (process.client) {
    document.removeEventListener('click', handleClickOutside)
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})

// Format currency
const formatPrice = (price: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(price)
}
</script>

<template>
  <div class="relative w-full">
    <!-- Search Input -->
    <div class="relative">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          class="h-5 w-5 text-ink-subtle"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        :placeholder="placeholder"
        class="block w-full rounded-input border border-gray-300 dark:border-gray-600 bg-surface dark:bg-surface-raised py-2 pl-10 pr-10 text-sm text-ink dark:text-ink-inverse placeholder-ink-subtle dark:placeholder-ink-subtle transition-colors duration-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        :aria-label="placeholder"
        :aria-expanded="showDropdown"
        aria-autocomplete="list"
        :aria-controls="resultsId"
        role="combobox"
        @keydown="handleKeyDown"
        @focus="handleFocus"
        @blur="handleBlur"
      >

      <!-- Loading Spinner / Clear Button -->
      <div class="absolute inset-y-0 right-0 flex items-center pr-3">
        <button
          v-if="searchQuery.length > 0 && !isLoading"
          type="button"
          class="text-ink-subtle hover:text-ink dark:hover:text-ink-inverse transition-colors duration-base focus:outline-none"
          aria-label="Clear search"
          @click="clearSearch"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <svg
          v-if="isLoading"
          class="h-5 w-5 animate-spin text-brand"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </div>

    <!-- Dropdown Results -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="showDropdown"
        :id="resultsId"
        ref="dropdownRef"
        class="absolute z-50 mt-1 max-h-96 w-full overflow-auto rounded-input border border-gray-200 dark:border-gray-700 bg-surface dark:bg-surface-raised shadow-overlay transition-colors duration-slow"
        role="listbox"
      >
        <!-- Error State -->
        <div v-if="error" class="px-4 py-3 text-sm text-status-error">
          {{ error }}
        </div>

        <!-- No Results -->
        <div
          v-else-if="!isLoading && !hasResults"
          class="px-4 py-3 text-sm text-ink-muted dark:text-ink-subtle"
        >
          No products found for "{{ searchQuery }}"
        </div>

        <!-- Results List -->
        <div
          v-else-if="hasResults"
          role="group"
          aria-label="Search results"
        >
          <button
            v-for="(product, index) in displayResults"
            :key="product.id"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-base hover:bg-surface-light dark:hover:bg-surface-dark focus:bg-surface-light dark:focus:bg-surface-dark focus:outline-none"
            :class="{
              'bg-brand-muted dark:bg-surface-dark': index === selectedIndex,
            }"
            role="option"
            :aria-selected="index === selectedIndex"
            @click="selectProduct(product)"
            @mouseenter="selectedIndex = index"
          >
            <!-- Product Image -->
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
              :alt="product.title"
              class="h-12 w-12 flex-shrink-0 rounded-input object-cover"
              loading="lazy"
            >
            <div v-else class="h-12 w-12 flex-shrink-0 rounded-input bg-surface-light dark:bg-surface-dark" />

            <!-- Product Info -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-ink dark:text-ink-inverse">
                {{ product.title }}
              </p>
              <div class="mt-1 flex items-center gap-2">
                <span class="text-sm font-semibold text-brand dark:text-brand-hover">
                  {{ formatPrice(product.price, product.currency) }}
                </span>
                <span class="text-xs text-ink-subtle uppercase">
                  {{ product.platform }}
                </span>
              </div>
            </div>

            <!-- Rating (if available) -->
            <div v-if="product.rating" class="flex-shrink-0 text-right">
              <div class="flex items-center gap-1">
                <svg class="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span class="text-xs text-ink-muted dark:text-ink-subtle">{{ product.rating.toFixed(1) }}</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<template>
  <div class="min-h-screen bg-surface-light dark:bg-surface-dark transition-colors duration-slow ease-smooth">
    <!-- Header -->
    <header class="bg-surface dark:bg-surface-raised shadow-card border-b border-gray-100 dark:border-gray-700 transition-colors duration-slow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between gap-4">
          <NuxtLink to="/" class="text-2xl font-bold text-brand dark:text-brand-hover whitespace-nowrap">
            yourplug
          </NuxtLink>
          <div class="hidden sm:block flex-1 max-w-md mx-4">
            <SearchBar
              placeholder="Search products..."
              aria-label="Search products"
              @select="handleSearchSelect"
            />
          </div>
          <nav class="hidden md:flex items-center space-x-8">
            <NuxtLink to="/" class="text-ink dark:text-ink-muted hover:text-brand dark:hover:text-brand-hover transition-colors duration-base">
              Products
            </NuxtLink>
            <NuxtLink to="/categories" class="text-ink dark:text-ink-muted hover:text-brand dark:hover:text-brand-hover transition-colors duration-base">
              Categories
            </NuxtLink>
            <NuxtLink :to="`/seasonal/${currentSeason.slug}`" class="text-ink dark:text-ink-muted hover:text-brand dark:hover:text-brand-hover transition-colors duration-base">
              {{ currentSeason.label }}
            </NuxtLink>

            <!-- Auth controls -->
            <template v-if="user">
              <span class="text-sm text-ink-muted dark:text-ink-subtle truncate max-w-[140px]" :title="user.email">
                {{ user.email }}
              </span>
              <button
                type="button"
                class="text-sm text-ink-muted dark:text-ink-subtle hover:text-brand dark:hover:text-brand-hover transition-colors duration-base"
                @click="handleSignOut"
              >
                Sign out
              </button>
            </template>
            <NuxtLink v-else to="/login" class="text-sm text-ink dark:text-ink-muted hover:text-brand dark:hover:text-brand-hover transition-colors duration-base">
              Sign in
            </NuxtLink>
          </nav>
        </div>
        <!-- Mobile search row -->
        <div class="sm:hidden mt-3">
          <SearchBar
            placeholder="Search products..."
            aria-label="Search products"
            @select="handleSearchSelect"
          />
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>

    <!-- Footer with FTC Disclosure -->
    <footer class="bg-surface dark:bg-surface-raised border-t border-gray-100 dark:border-gray-700 mt-16 transition-colors duration-slow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-sm text-ink-muted dark:text-ink-subtle text-center">
          <p class="mb-2">
            <strong class="text-ink dark:text-ink-inverse">FTC Disclosure:</strong> yourplug participates in affiliate marketing programs.
            When you click on links and make purchases through our site, we may receive monetary compensation.
            This helps support our work in curating quality products for our community.
          </p>
          <p class="text-ink-subtle">
            © {{ new Date().getFullYear() }} yourplug. All rights reserved.
          </p>
        </div>
      </div>
    </footer>

    <!-- Floating dark mode toggle -->
    <DarkModeToggle />

    <!-- Global toast notification stack -->
    <AppFeedbackToastContainer />
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/types'
import { getCurrentSeason } from '~/utils/seasons'

const { init } = useDarkMode()
const { user, signOut } = useAuth()

onMounted(() => {
  init()
})

const currentSeason = getCurrentSeason()

const handleSearchSelect = (product: Product) => {
  navigateTo(`/products/${product.id}`)
}

async function handleSignOut() {
  try {
    await signOut()
  }
  catch {
    // navigation already handled inside signOut; ignore
  }
}
</script>

<style>
a.router-link-active {
  @apply text-brand dark:text-brand-hover font-medium;
}
</style>

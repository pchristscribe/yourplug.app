<script setup lang="ts">
import AffiliateDisclosure from '~/components/AffiliateDisclosure.vue'

const route = useRoute()
const productStore = useProductStore()
const { public: { siteUrl } } = useRuntimeConfig()

const productId = route.params.id as string

const { error: fetchError } = await useAsyncData(
  `product-${productId}`,
  () => productStore.fetchProduct(productId),
)

const product = computed(() => productStore?.currentProduct)

// ---- SEO meta (title/description/OG/Twitter) ----------------------------
useSeoMeta({
  title: () => product.value ? product.value.title : 'Product',
  description: () =>
    product.value
      ? (product.value.description?.slice(0, 200) || `${product.value.title} on yourplug.`)
      : 'yourplug curated product.',
  ogTitle: () => product.value?.title ?? 'yourplug',
  ogDescription: () =>
    product.value?.description?.slice(0, 200)
    ?? 'Curated product for gay men on yourplug.',
  ogImage: () => product.value?.imageUrl ?? undefined,
  ogType: 'website',
  ogUrl: () => `${siteUrl}/products/${productId}`,
  twitterCard: 'summary_large_image',
  twitterImage: () => product.value?.imageUrl ?? undefined,
})

// ---- JSON-LD Product structured data ------------------------------------
// Google uses this to render rich product cards in search results.
const jsonLd = computed(() => {
  const p = product.value
  if (!p) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.description,
    image: p.imageUrl,
    sku: p.externalId,
    brand: { '@type': 'Brand', name: p.platform },
    category: p.category?.name,
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/products/${p.id}`,
      priceCurrency: p.currency,
      price: p.price,
      availability: p.status === 'ACTIVE'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(p.rating && (p.reviewCount ?? p.reviews?.length) ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: p.rating,
        reviewCount: p.reviewCount || p.reviews?.length || 0,
      },
    } : {}),
    ...(p.reviews && p.reviews.length > 0 ? {
      review: p.reviews.map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Organization', name: r.authorName },
        datePublished: r.createdAt,
        reviewBody: r.content,
        name: r.title,
        reviewRating: {
          '@type': 'Rating',
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
      })),
    } : {}),
  }
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => jsonLd.value ? JSON.stringify(jsonLd.value) : ''),
    },
  ],
})

// Handle affiliate link click
const handleAffiliateClick = (url: string) => {
  // Open in new tab
  window.open(url, '_blank')
}
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="productStore?.loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      <p class="mt-4 text-ink-muted dark:text-ink-subtle">Loading product...</p>
    </div>

    <!-- Product Detail -->
    <div v-else-if="product" class="max-w-6xl mx-auto">
      <NuxtLink
        to="/"
        class="inline-flex items-center text-brand hover:text-brand-hover transition-colors duration-base mb-6"
      >
        ← Back to Products
      </NuxtLink>

      <div class="bg-surface dark:bg-surface-raised rounded-card shadow-card border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-slow">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
          <!-- Product Image -->
          <div>
            <img
              :src="product.imageUrl"
              :alt="product.title"
              class="w-full rounded-card"
            />
          </div>

          <!-- Product Info -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <span class="inline-block px-3 py-1 text-sm font-semibold rounded-pill bg-brand-muted text-brand">
                {{ product.platform }}
              </span>
              <span
                v-if="product.status === 'ACTIVE'"
                class="inline-block px-3 py-1 text-sm font-semibold rounded-pill bg-status-success/10 text-status-success"
              >
                In Stock
              </span>
            </div>

            <h1 class="text-3xl font-bold text-ink dark:text-ink-inverse mb-4">
              {{ product.title }}
            </h1>

            <div class="flex items-baseline gap-3 mb-6">
              <span class="text-4xl font-bold text-ink dark:text-ink-inverse">
                ${{ product.price.toFixed(2) }}
              </span>
              <span class="text-sm text-ink-subtle">
                {{ product.currency }}
              </span>
            </div>

            <div class="mb-6">
              <p class="text-ink-muted dark:text-ink-subtle leading-relaxed">
                {{ product.description }}
              </p>
            </div>

            <!-- Category & Tags -->
            <div class="mb-6 space-y-3">
              <div v-if="product.category">
                <span class="text-sm font-medium text-ink dark:text-ink-inverse">Category:</span>
                <span class="ml-2 text-sm text-ink-muted dark:text-ink-subtle">{{ product.category.name }}</span>
              </div>

              <div v-if="product.tags && product.tags.length > 0">
                <span class="text-sm font-medium text-ink dark:text-ink-inverse block mb-2">Tags:</span>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in product.tags"
                    :key="tag"
                    class="px-2 py-1 text-xs rounded-pill bg-surface-light dark:bg-surface-dark text-ink-muted dark:text-ink-subtle"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Price Update Info -->
            <div class="mb-6 p-4 bg-accent-muted dark:bg-surface-dark rounded-card border border-accent/30 dark:border-gray-700 transition-colors duration-slow">
              <p class="text-sm text-ink dark:text-ink-inverse">
                Price last updated: {{ new Date(product.priceUpdatedAt).toLocaleDateString() }}
              </p>
              <p class="text-xs text-ink-muted dark:text-ink-subtle mt-1">
                Actual price may vary. Check seller's site for current pricing.
              </p>
            </div>

            <!-- Affiliate Links -->
            <div v-if="product.affiliateLinks && product.affiliateLinks.length > 0" class="space-y-4">
              <h3 class="text-lg font-semibold text-ink dark:text-ink-inverse">Where to Buy</h3>
              <div
                v-for="link in product.affiliateLinks"
                :key="link.id"
                class="border border-gray-200 dark:border-gray-700 rounded-card p-4 hover:border-brand dark:hover:border-brand-hover transition-colors duration-base"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-ink-muted dark:text-ink-subtle">Affiliate Link</p>
                    <p class="text-xs text-ink-subtle mt-1">
                      {{ link.clicks }} clicks • {{ link.conversions }} conversions
                    </p>
                  </div>
                  <button
                    @click="handleAffiliateClick(link.trackedUrl)"
                    class="px-6 py-3 bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-inverse font-semibold rounded-input focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors duration-base ease-smooth"
                  >
                    Visit Seller →
                  </button>
                </div>
              </div>

              <!-- FTC Disclosure -->
              <div class="mt-4">
                <AffiliateDisclosure variant="inline" />
              </div>
            </div>
          </div>
        </div>

        <!-- Reviews Section -->
        <div v-if="product.reviews && product.reviews.length > 0" class="border-t border-gray-200 dark:border-gray-700 p-8">
          <div class="flex items-baseline justify-between mb-6">
            <h2 class="text-2xl font-bold text-ink dark:text-ink-inverse">Our Reviews</h2>
            <span class="text-sm text-ink-subtle">
              {{ product.reviews.length }} {{ product.reviews.length === 1 ? 'review' : 'reviews' }}
            </span>
          </div>
          <div class="space-y-6">
            <article
              v-for="review in product.reviews"
              :key="review.id"
              class="border border-gray-200 dark:border-gray-700 rounded-card p-6 bg-surface-light dark:bg-surface-dark transition-colors duration-slow"
            >
              <header class="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 v-if="review.title" class="font-semibold text-ink dark:text-ink-inverse">
                    {{ review.title }}
                  </h3>
                  <p class="text-sm text-ink-muted dark:text-ink-subtle">
                    by {{ review.authorName }}
                    <time :datetime="review.createdAt" class="text-ink-subtle">
                      · {{ new Date(review.createdAt).toLocaleDateString() }}
                    </time>
                  </p>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <div class="flex" :aria-label="`${review.rating} out of 5 stars`">
                    <span
                      v-for="i in 5"
                      :key="i"
                      :class="i <= review.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'"
                      aria-hidden="true"
                    >★</span>
                  </div>
                  <span
                    v-if="review.isFeatured"
                    class="inline-flex rounded-pill bg-brand-muted px-2 text-xs font-semibold text-brand"
                  >
                    Featured
                  </span>
                </div>
              </header>

              <p class="text-ink-muted dark:text-ink-subtle mb-4 whitespace-pre-line">{{ review.content }}</p>

              <div class="grid gap-4 sm:grid-cols-2">
                <div v-if="review.pros.length > 0">
                  <p class="text-sm font-medium text-status-success mb-1">Pros</p>
                  <ul class="text-sm text-ink-muted dark:text-ink-subtle list-disc list-inside space-y-1">
                    <li v-for="pro in review.pros" :key="pro">{{ pro }}</li>
                  </ul>
                </div>

                <div v-if="review.cons.length > 0">
                  <p class="text-sm font-medium text-status-error mb-1">Cons</p>
                  <ul class="text-sm text-ink-muted dark:text-ink-subtle list-disc list-inside space-y-1">
                    <li v-for="con in review.cons" :key="con">{{ con }}</li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError || productStore?.error" class="text-center py-12">
      <p class="text-ink-muted dark:text-ink-subtle mb-4">{{ productStore?.error || 'Product not found' }}</p>
      <NuxtLink
        to="/"
        class="inline-block px-4 py-2 bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-inverse font-medium rounded-input transition-colors duration-base ease-smooth"
      >
        Back to Products
      </NuxtLink>
    </div>
  </div>
</template>

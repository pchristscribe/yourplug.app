<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '~/types'
import AffiliateDisclosure from './AffiliateDisclosure.vue'

interface Props {
  product: Product & { originalPrice?: number }
  showDiscount?: boolean
  variant?: 'full' | 'simple'
}

const props = withDefaults(defineProps<Props>(), {
  showDiscount: false,
  variant: 'full',
})

const emit = defineEmits<{
  'add-to-cart': [product: Product]
  'view-details': [productId: string]
}>()

const formattedPrice = computed(() => `$${props.product.price}`)

const hasRating = computed(() =>
  props.product.rating && props.product.reviewCount > 0
)

const discountPercentage = computed(() => {
  if (!props.showDiscount || !props.product.originalPrice) return 0
  return Math.round(
    ((props.product.originalPrice - props.product.price) / props.product.originalPrice) * 100
  )
})

const showDiscountBadge = computed(() =>
  props.showDiscount && discountPercentage.value !== 0
)
</script>

<template>
  <article
    class="bg-surface dark:bg-surface-raised rounded-card shadow-card hover:shadow-raised transition-shadow duration-base ease-smooth overflow-hidden"
    :aria-label="`Product: ${product.title}`"
  >
    <NuxtLink :to="`/products/${product.id}`" class="block">
      <!-- Product Image -->
      <div class="relative">
        <img
          :src="product.imageUrl"
          :alt="product.title"
          :class="['w-full object-cover', variant === 'simple' ? 'h-36' : 'h-48']"
          loading="lazy"
        />

          <!-- Discount Badge — shown in both variants -->
          <div
            v-if="showDiscountBadge"
            class="absolute top-2 right-2 bg-brand text-ink-inverse text-xs font-bold px-2 py-1 rounded-pill shadow-card"
            :aria-label="`${discountPercentage}% discount`"
          >
            {{ discountPercentage }}% OFF
          </div>

          <!-- Affiliate badge — full variant only -->
          <div v-if="variant === 'full'" class="absolute top-2 left-2">
            <AffiliateDisclosure variant="badge" />
          </div>
      </div>

      <!-- Product Details -->
      <div class="p-4">
        <template v-if="variant === 'full'">
          <!-- Platform and Price -->
          <div class="flex items-center justify-between mb-2">
            <span
              class="inline-block px-2 py-1 text-xs font-semibold rounded-pill bg-brand-muted text-brand"
              :aria-label="`Available on ${product.platform}`"
            >
              {{ product.platform }}
            </span>
            <span class="text-lg font-bold text-ink dark:text-ink-inverse" :aria-label="`Price: ${formattedPrice}`">
              {{ formattedPrice }}
            </span>
          </div>

          <!-- Product Title -->
          <h3 class="font-semibold text-ink dark:text-ink-inverse mb-2 line-clamp-2">
            {{ product.title }}
          </h3>

          <!-- Product Description -->
          <p class="text-sm text-ink-muted dark:text-ink-subtle line-clamp-2 mb-3">
            {{ product.description }}
          </p>

          <!-- Category and Rating -->
          <div class="flex items-center justify-between text-sm text-ink-subtle mb-3">
            <span v-if="product.category">{{ product.category.name }}</span>
            <span v-if="hasRating" class="flex items-center gap-1">
              <span aria-hidden="true">⭐</span>
              <span class="sr-only">Rating:</span>
              {{ product.rating?.toFixed(1) }}
              <span class="text-ink-subtle">({{ product.reviewCount }})</span>
            </span>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-inverse font-medium py-2 px-4 rounded-input focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors duration-base ease-smooth"
              :aria-label="`Add ${product.title} to cart`"
              @click.prevent="emit('add-to-cart', product)"
            >
              Add to Cart
            </button>
            <button
              type="button"
              class="flex-1 border border-ink-muted text-ink-muted hover:bg-surface-light dark:hover:bg-surface-raised font-medium py-2 px-4 rounded-input focus:outline-none focus:ring-2 focus:ring-ink-muted focus:ring-offset-2 transition-colors duration-base ease-smooth"
              :aria-label="`View details for ${product.title}`"
              @click.prevent="emit('view-details', product.id)"
            >
              View Details
            </button>
          </div>
        </template>

        <!-- Simple variant — title, price, single action -->
        <template v-else>
          <div class="flex items-start justify-between mb-2">
            <h3 class="font-semibold text-ink dark:text-ink-inverse line-clamp-2 flex-1 mr-2">
              {{ product.title }}
            </h3>
            <span class="font-bold text-ink dark:text-ink-inverse whitespace-nowrap">
              {{ formattedPrice }}
            </span>
          </div>
          <button
            type="button"
            class="w-full bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-inverse font-medium py-2 px-4 rounded-input focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors duration-base ease-smooth"
            :aria-label="`Add ${product.title} to cart`"
            @click.prevent="emit('add-to-cart', product)"
          >
            Add to Cart
          </button>
        </template>
      </div>
    </NuxtLink>
  </article>
</template>

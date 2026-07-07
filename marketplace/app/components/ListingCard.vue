<template>
  <NuxtLink :to="`/listings/${listing.id}`" class="group block rounded-card bg-surface shadow-card hover:shadow-raised transition-shadow duration-base">
    <div class="aspect-square overflow-hidden rounded-t-card bg-surface-light">
      <img
        v-if="listing.primaryImageUrl"
        :src="listing.primaryImageUrl"
        :alt="listing.title"
        class="h-full w-full object-cover transition-transform duration-slow group-hover:scale-105"
      />
      <div v-else class="flex h-full items-center justify-center text-ink-subtle text-4xl">📦</div>
    </div>
    <div class="p-4 space-y-2">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-semibold text-ink line-clamp-2 leading-snug">{{ listing.title }}</h3>
        <span class="shrink-0 text-lg font-bold text-brand">${{ listing.askingPrice.toFixed(2) }}</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="rounded-pill bg-brand-muted text-brand text-xs px-2 py-0.5 font-medium">
          {{ conditionLabel }}
        </span>
        <span class="rounded-pill bg-accent-muted text-ink-muted text-xs px-2 py-0.5">
          {{ categoryLabel }}
        </span>
      </div>
      <p v-if="listing.sellerDisplayName" class="text-xs text-ink-subtle">
        by {{ listing.sellerDisplayName }}
      </p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
// Explicit import (rather than Nuxt auto-import) so the component also
// works under plain vitest/SSR test environments
import { computed } from 'vue'
import type { ListingSummary } from '~/types/listings'
import { CONDITION_LABELS, CATEGORY_LABELS } from '~/utils/listingLabels'

const props = defineProps<{ listing: ListingSummary }>()

const conditionLabel = computed(() => CONDITION_LABELS[props.listing.condition] ?? props.listing.condition)
const categoryLabel = computed(() => CATEGORY_LABELS[props.listing.category] ?? props.listing.category)
</script>

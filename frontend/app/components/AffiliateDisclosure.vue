<script setup lang="ts">
interface Props {
  variant?: 'badge' | 'inline' | 'footer'
}

withDefaults(defineProps<Props>(), {
  variant: 'inline',
})
</script>

<template>
  <div
    v-if="variant === 'badge'"
    class="bg-accent text-ink text-xs font-semibold px-2 py-1 rounded-pill shadow-card"
    title="This is an affiliate link. We may earn a commission from purchases."
    role="note"
    aria-label="Affiliate product"
  >
    Affiliate
  </div>

  <div v-else-if="variant === 'inline'" class="p-3 bg-gray-50 rounded-lg border border-gray-200">
    <p class="text-xs text-gray-600">
      <strong>Disclosure:</strong> This is an affiliate link. We may earn a commission when you make a purchase through this link at no additional cost to you.
    </p>
  </div>

  <p v-else class="mb-2">
    <strong class="text-ink dark:text-ink-inverse">FTC Disclosure:</strong> yourplug participates in affiliate marketing programs.
    When you click on links and make purchases through our site, we may receive monetary compensation.
    This helps support our work in curating quality products for our community.
  </p>
</template>

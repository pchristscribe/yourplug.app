<template>
  <span class="inline-flex items-baseline tracking-tight" :class="sizeClass">
    <span class="font-light">your</span><span class="font-extrabold">plug</span>
    <span v-if="suffix" class="ml-2 font-normal text-ink-muted dark:text-ink-subtle text-base">{{ suffix }}</span>
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    suffix?: string
    sizeClass?: string
  }>(),
  {
    suffix: '',
    sizeClass: 'text-3xl'
  }
)
</script>

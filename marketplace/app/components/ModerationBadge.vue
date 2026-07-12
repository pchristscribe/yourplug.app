<template>
  <span :class="['rounded-pill px-2 py-0.5 text-xs font-medium', colorClass]">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type { ModerationDecision } from '~/types/listings'

const props = defineProps<{ status: ModerationDecision }>()

const CONFIG: Record<ModerationDecision, { label: string; colorClass: string }> = {
  PENDING: { label: 'Under Review', colorClass: 'bg-accent-muted text-ink-muted' },
  APPROVED: { label: 'Approved', colorClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  REJECTED: { label: 'Rejected', colorClass: 'bg-brand-muted text-brand' },
  FLAGGED: { label: 'Flagged', colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
}

const label = computed(() => CONFIG[props.status]?.label ?? props.status)
const colorClass = computed(() => CONFIG[props.status]?.colorClass ?? '')
</script>

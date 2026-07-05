<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-ink-muted">Signing you in…</p>
  </div>
</template>

<script setup lang="ts">
onMounted(() => {
  navigateTo('/')
})
</script>

<template>
  <div class="min-h-screen bg-surface-light dark:bg-surface-dark flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Logo / brand -->
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-block text-3xl font-bold text-brand dark:text-brand-hover">
          yourplug.app
        </NuxtLink>
        <p class="mt-2 text-sm text-ink-muted dark:text-ink-subtle">
          Sign in to your account
        </p>
      </div>

      <!-- Card -->
      <div class="bg-surface dark:bg-surface-raised rounded-2xl shadow-card p-8 border border-gray-100 dark:border-gray-700">
        <SocialAuth />

        <p class="mt-6 text-xs text-center text-ink-subtle dark:text-ink-subtle leading-relaxed">
          By signing in you agree to our
          <a href="#" class="underline hover:text-brand transition-colors">Terms of Service</a>
          and
          <a href="#" class="underline hover:text-brand transition-colors">Privacy Policy</a>.
        </p>
      </div>

      <!-- Back link -->
      <p class="mt-6 text-center text-sm text-ink-muted dark:text-ink-subtle">
        <NuxtLink to="/" class="hover:text-brand transition-colors">
          &larr; Back to store
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

// Redirect already-authenticated users away from the login page
const user = useSupabaseUser()
watchEffect(() => {
  if (user.value) navigateTo('/')
})
</script>

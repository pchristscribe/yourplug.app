<template>
  <div class="min-h-screen bg-surface-light dark:bg-surface-dark flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Logo / brand -->
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-block text-brand dark:text-brand-hover">
          <Wordmark size-class="text-3xl" />
        </NuxtLink>
        <p class="mt-2 text-sm text-ink-muted dark:text-ink-subtle">
          Sign in to keep browsing your finds.
        </p>
        <p class="mt-1 text-xs text-ink-subtle dark:text-ink-subtle">
          Curated picks, no scrolling through junk.
        </p>
      </div>

      <!-- Card — the top edge reads as a socket the wordmark plugs into -->
      <div class="relative">
        <div class="absolute left-1/2 -top-3 -translate-x-1/2 w-12 h-4 bg-accent dark:bg-accent rounded-t-sm" aria-hidden="true" />
        <div class="card-socket relative bg-surface dark:bg-surface-raised shadow-card p-8 pt-9 border border-gray-100 dark:border-gray-700">
          <SocialAuth />

          <p class="mt-6 text-xs text-center text-ink-subtle dark:text-ink-subtle leading-relaxed">
            By signing in you agree to our
            <a href="#" class="underline hover:text-brand transition-colors">Terms of Service</a>
            and
            <a href="#" class="underline hover:text-brand transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>

      <!-- Back link -->
      <p class="mt-6 text-center text-sm text-ink-muted dark:text-ink-subtle">
        <NuxtLink to="/" class="hover:text-brand transition-colors">
          &larr; Back to store
        </NuxtLink>
      </p>
    </div>

    <DarkModeToggle />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

// Redirect already-authenticated users away from the login page
const user = useSupabaseUser()
watchEffect(() => {
  if (user.value) navigateTo('/')
})

const { init } = useDarkMode()
onMounted(() => { init() })
</script>

<style scoped>
/* Card reads as a socket: a rectangular notch cut into the top-center edge,
   sized and centered to match the prong element rendered just above it. */
.card-socket {
  border-radius: 0 0 1rem 1rem;
  clip-path: polygon(
    0 0,
    calc(50% - 28px) 0,
    calc(50% - 28px) 14px,
    calc(50% + 28px) 14px,
    calc(50% + 28px) 0,
    100% 0,
    100% 100%,
    0 100%
  );
}
</style>

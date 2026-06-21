<script setup lang="ts">
const visible = ref(false)

onMounted(() => {
  try {
    const consent = localStorage.getItem('cookieConsent')
    if (consent !== 'accepted' && consent !== 'declined') {
      visible.value = true
    }
  } catch {
    visible.value = true
  }
})

function saveConsent(value: 'accepted' | 'declined') {
  try {
    localStorage.setItem('cookieConsent', value)
  } catch {
    // Storage unavailable (e.g. Safari private mode) — proceed with in-memory only
  }
  visible.value = false
}

function acceptAll() {
  document.cookie = 'analytics_consent=true; path=/; max-age=31536000; SameSite=Lax; Secure'
  saveConsent('accepted')
}

function decline() {
  document.cookie = 'analytics_consent=; path=/; max-age=0; SameSite=Lax; Secure'
  saveConsent('declined')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    decline()
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="translate-y-full"
    enter-to-class="translate-y-0"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-from-class="translate-y-0"
    leave-to-class="translate-y-full"
  >
    <div
      v-if="visible"
      role="region"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-desc"
      class="fixed bottom-0 inset-x-0 z-50 bg-surface dark:bg-surface-raised border-t border-gray-100 dark:border-gray-700 shadow-raised outline-none"
      @keydown="onKeydown"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p id="cookie-consent-desc" class="flex-1 text-sm text-ink dark:text-ink-muted leading-relaxed">
          We use cookies to improve your experience. By continuing, you agree to our
          <NuxtLink to="/privacy" class="text-brand dark:text-brand-hover underline underline-offset-2 hover:text-brand-hover transition-colors duration-base">
            Privacy Policy
          </NuxtLink>
          and use of cookies for analytics and affiliate tracking.
        </p>
        <div class="flex items-center gap-3 shrink-0">
          <button
            type="button"
            class="bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-inverse text-sm font-medium px-4 py-2 rounded-input focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors duration-base ease-smooth"
            @click="acceptAll"
          >
            Accept All
          </button>
          <button
            type="button"
            class="border border-ink-muted text-ink-muted hover:bg-surface-light dark:hover:bg-surface-raised dark:border-ink-subtle dark:text-ink-subtle text-sm font-medium px-4 py-2 rounded-input focus:outline-none focus:ring-2 focus:ring-ink-muted focus:ring-offset-2 transition-colors duration-base ease-smooth"
            @click="decline"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

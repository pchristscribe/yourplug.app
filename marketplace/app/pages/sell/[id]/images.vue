<template>
  <div class="max-w-xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-ink mb-2">Add Photos</h1>
    <p class="text-sm text-ink-muted mb-6">
      Photos must be taken within 15 minutes of upload to prove authenticity.
      At least one photo is required.
    </p>

    <ImageUploader
      :listing-id="listingId"
      :uploaded="uploaded"
      @uploaded="img => uploaded.push(img)"
      @remove="removeImage"
    />

    <div class="mt-8 flex gap-3">
      <button
        v-if="uploaded.length > 0"
        @click="submitListing"
        :disabled="submitting"
        class="px-6 py-2.5 bg-brand text-white font-semibold rounded-input hover:bg-brand-hover disabled:opacity-50"
      >
        {{ submitting ? 'Submitting…' : 'Submit for Review' }}
      </button>
      <NuxtLink to="/dashboard" class="px-6 py-2.5 text-sm text-ink-muted hover:text-ink">
        Save as draft
      </NuxtLink>
    </div>

    <p v-if="submitError" class="mt-3 text-sm text-status-error">{{ submitError }}</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const listingId = route.params.id as string
const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const supabase = useSupabaseClient()

const { submitListing: doSubmit } = useSeller()
const { getAuthHeaders } = useAuthHeaders()
const uploaded = ref<{ id: string; publicUrl: string; storagePath: string }[]>([])
const submitting = ref(false)
const submitError = ref('')

async function removeImage(imageId: string) {
  const headers = await getAuthHeaders()
  try {
    await $fetch(`${apiBase}/api/consignment/seller/images/${imageId}`, { method: 'DELETE', headers })
    // Only drop it from the grid after the server confirms the delete
    uploaded.value = uploaded.value.filter(img => img.id !== imageId)
  } catch (err: unknown) {
    submitError.value = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to remove image'
  }
}

async function submitListing() {
  submitting.value = true
  submitError.value = ''
  try {
    await doSubmit(listingId)
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    submitError.value = (err as { data?: { error?: string } })?.data?.error ?? 'Submission failed'
  } finally {
    submitting.value = false
  }
}
</script>

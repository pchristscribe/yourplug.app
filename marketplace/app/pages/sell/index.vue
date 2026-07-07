<template>
  <div class="max-w-xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-ink mb-6">Create a Listing</h1>

    <form @submit.prevent="submit" class="space-y-5">
      <div>
        <label class="block text-sm font-medium text-ink-muted mb-1">Title</label>
        <input v-model="form.title" type="text" maxlength="120" required
          class="w-full rounded-input border border-gray-200 px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand dark:bg-surface-dark dark:border-gray-600" />
      </div>
      <div>
        <label class="block text-sm font-medium text-ink-muted mb-1">Description</label>
        <textarea v-model="form.description" rows="4" maxlength="2000"
          class="w-full rounded-input border border-gray-200 px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand dark:bg-surface-dark dark:border-gray-600" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-ink-muted mb-1">Condition</label>
          <select v-model="form.condition" required
            class="w-full rounded-input border border-gray-200 px-3 py-2 text-ink dark:bg-surface-dark dark:border-gray-600">
            <option value="">Select…</option>
            <option value="NEW">New</option>
            <option value="LIKE_NEW">Like New</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-ink-muted mb-1">Category</label>
          <select v-model="form.category" required
            class="w-full rounded-input border border-gray-200 px-3 py-2 text-ink dark:bg-surface-dark dark:border-gray-600">
            <option value="">Select…</option>
            <option value="APPAREL">Apparel</option>
            <option value="ACCESSORIES">Accessories</option>
            <option value="UNDERWEAR">Underwear</option>
            <option value="HARNESS">Harness</option>
            <option value="TOY">Toy</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-ink-muted mb-1">Asking price (USD)</label>
        <input v-model.number="form.askingPrice" type="number" min="0.01" step="0.01" required
          class="w-full rounded-input border border-gray-200 px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand dark:bg-surface-dark dark:border-gray-600" />
      </div>

      <p v-if="error" class="text-sm text-status-error">{{ error }}</p>

      <button type="submit" :disabled="submitting"
        class="w-full py-2.5 bg-brand text-white font-semibold rounded-input hover:bg-brand-hover disabled:opacity-50">
        {{ submitting ? 'Creating…' : 'Create Listing' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { createListing } = useSeller()

const form = ref({
  title: '',
  description: '',
  condition: '',
  category: '',
  askingPrice: null as number | null,
})

const submitting = ref(false)
const error = ref('')

async function submit() {
  if (!form.value.askingPrice || form.value.askingPrice < 0.01) {
    error.value = 'Enter a valid price'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const listing = await createListing({
      title: form.value.title,
      description: form.value.description || undefined,
      condition: form.value.condition,
      category: form.value.category,
      askingPrice: form.value.askingPrice,
    })
    await navigateTo(`/sell/${listing.id}/images`)
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create listing'
  } finally {
    submitting.value = false
  }
}
</script>

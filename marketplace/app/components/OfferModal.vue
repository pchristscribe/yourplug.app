<template>
  <HeadlessTransitionRoot :show="open" as="template">
    <HeadlessDialog as="div" class="relative z-50" @close="$emit('close')">
      <HeadlessTransitionChild
        enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100"
        leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0"
        as="template"
      >
        <div class="fixed inset-0 bg-black/40" />
      </HeadlessTransitionChild>

      <div class="fixed inset-0 flex items-center justify-center p-4">
        <HeadlessTransitionChild
          enter="ease-out duration-300" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100"
          leave="ease-in duration-200" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95"
          as="template"
        >
          <HeadlessDialogPanel class="w-full max-w-md rounded-card bg-surface p-6 shadow-overlay dark:bg-surface-raised">
            <HeadlessDialogTitle class="text-lg font-semibold text-ink mb-4">Make an Offer</HeadlessDialogTitle>

            <form @submit.prevent="submit" class="space-y-4">
              <div>
                <label for="offer-amount" class="block text-sm font-medium text-ink-muted mb-1">Your offer (USD)</label>
                <input
                  id="offer-amount"
                  v-model.number="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  :placeholder="`Asking price: $${askingPrice.toFixed(2)}`"
                  class="w-full rounded-input border border-gray-200 px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand dark:bg-surface-dark dark:border-gray-600"
                />
              </div>
              <div>
                <label for="offer-message" class="block text-sm font-medium text-ink-muted mb-1">Message (optional)</label>
                <textarea
                  id="offer-message"
                  v-model="message"
                  rows="3"
                  maxlength="500"
                  placeholder="Add a note to the seller..."
                  class="w-full rounded-input border border-gray-200 px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand dark:bg-surface-dark dark:border-gray-600"
                />
              </div>
              <p v-if="error" class="text-sm text-status-error">{{ error }}</p>
              <div class="flex gap-3 justify-end">
                <button type="button" @click="$emit('close')" class="px-4 py-2 text-sm text-ink-muted hover:text-ink">
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="submitting"
                  class="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-input hover:bg-brand-hover disabled:opacity-50"
                >
                  {{ submitting ? 'Sending...' : 'Send Offer' }}
                </button>
              </div>
            </form>
          </HeadlessDialogPanel>
        </HeadlessTransitionChild>
      </div>
    </HeadlessDialog>
  </HeadlessTransitionRoot>
</template>

<script setup lang="ts">
// Explicit import (rather than Nuxt auto-import) so the component also
// works under plain vitest/SSR test environments
import { ref } from 'vue'

const props = defineProps<{
  open: boolean
  listingId: string
  askingPrice: number
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const { submitOffer } = useOffers()

const amount = ref<number | null>(null)
const message = ref('')
const submitting = ref(false)
const error = ref('')

async function submit() {
  if (!amount.value || amount.value < 0.01) {
    error.value = 'Please enter a valid offer amount'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await submitOffer(props.listingId, { amount: amount.value, message: message.value || undefined })
    emit('submitted')
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to submit offer'
  } finally {
    submitting.value = false
  }
}
</script>

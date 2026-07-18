<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <div class="sm:flex sm:items-center mb-6">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Consignment Queue</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">Review and moderate AI-screened listings</p>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="flex gap-3 mb-6">
      <select
        v-model="statusFilter"
        @change="load(1)"
        class="rounded-md border-gray-300 shadow-sm text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="FLAGGED">Flagged</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
      </select>
    </div>

    <div v-if="loading" class="text-gray-500 text-sm">Loading…</div>
    <div v-else-if="listings.length === 0" class="text-gray-500 text-sm">No listings.</div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="listing in listings" :key="listing.id">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
                  <img
                    v-if="listing.primaryImage?.publicUrl"
                    :src="listing.primaryImage.publicUrl"
                    class="w-full h-full object-cover"
                    :alt="listing.title"
                  />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ listing.title }}</p>
                  <p class="text-xs text-gray-500">{{ listing.sellerDisplayName }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ listing.category }}</td>
            <td class="px-4 py-3 text-sm text-gray-900 dark:text-white">${{ Number(listing.askingPrice ?? 0).toFixed(2) }}</td>
            <td class="px-4 py-3">
              <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statusClass(listing.moderationStatus)]">
                {{ listing.moderationStatus }}
              </span>
              <p v-if="listing.moderationReason" class="text-xs text-gray-400 mt-0.5 max-w-xs truncate" :title="listing.moderationReason">
                {{ listing.moderationReason }}
              </p>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex gap-2">
                <button @click="viewLogs(listing)" class="text-indigo-600 hover:text-indigo-900 text-xs">View AI logs</button>
                <button
                  v-if="listing.moderationStatus !== 'APPROVED'"
                  @click="approve(listing.id)"
                  class="text-green-600 hover:text-green-900 text-xs font-medium"
                >
                  Approve
                </button>
                <button
                  v-if="listing.moderationStatus !== 'REJECTED'"
                  @click="openReject(listing)"
                  class="text-red-600 hover:text-red-900 text-xs font-medium"
                >
                  Reject
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="mt-6 flex gap-2">
      <button
        v-for="p in totalPages" :key="p"
        @click="load(p)"
        :class="['px-3 py-1.5 text-sm rounded', p === page ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300']"
      >
        {{ p }}
      </button>
    </div>

    <!-- AI logs modal -->
    <div v-if="logsModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="logsModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-xl">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Moderation Logs</h2>
        <div v-if="logsLoading" class="text-gray-500 text-sm">Loading…</div>
        <div v-else class="space-y-4">
          <div v-for="log in logs" :key="log.id" class="rounded border border-gray-200 dark:border-gray-700 p-3 text-sm">
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium text-gray-700 dark:text-gray-300">{{ log.checkType }}</span>
              <span :class="['text-xs font-medium', log.passed ? 'text-green-600' : 'text-red-600']">
                {{ log.passed ? 'PASSED' : 'FAILED' }}
              </span>
            </div>
            <p v-if="log.reason" class="text-gray-600 dark:text-gray-400">{{ log.reason }}</p>
            <pre class="mt-2 text-xs bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-x-auto">{{ JSON.stringify(log.result, null, 2) }}</pre>
          </div>
        </div>
        <button @click="logsModal = false" class="mt-4 text-sm text-gray-500 hover:text-gray-700">Close</button>
      </div>
    </div>

    <!-- Reject modal -->
    <div v-if="rejectModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="rejectModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reject Listing</h2>
        <textarea
          v-model="rejectReason"
          rows="3"
          placeholder="Reason for rejection (visible to seller)…"
          class="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
        <div class="flex justify-end gap-3 mt-4">
          <button @click="rejectModal = false" class="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button @click="confirmReject" :disabled="!rejectReason.trim()" class="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
            Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCsrf } from '~/composables/useCsrf'

// Route protection: every other admin page declares the auth middleware —
// without it this page renders for unauthenticated visitors (API calls
// would 401, but the page itself must not be reachable).
definePageMeta({
  middleware: ['auth'],
  layout: 'default',
})

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string
const { csrfHeaders } = useCsrf()

const listings = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const page = ref(1)
const totalPages = ref(1)
const statusFilter = ref('')

const logsModal = ref(false)
const logsLoading = ref(false)
const logs = ref<Record<string, unknown>[]>([])

const rejectModal = ref(false)
const rejectReason = ref('')
const rejectTarget = ref<string | null>(null)

function statusClass(status: string) {
  return {
    PENDING: 'bg-yellow-100 text-yellow-800',
    FLAGGED: 'bg-orange-100 text-orange-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }[status] ?? 'bg-gray-100 text-gray-800'
}

async function load(p = 1) {
  page.value = p
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20' })
    if (statusFilter.value) params.set('moderationStatus', statusFilter.value)
    const res = await $fetch<{ data: Record<string, unknown>[]; pagination: { pages: number } }>(
      `${apiBase}/api/admin/consignment/listings?${params}`,
      { credentials: 'include' }
    )
    listings.value = res.data
    totalPages.value = res.pagination.pages
  } finally {
    loading.value = false
  }
}

async function approve(id: string) {
  await $fetch(`${apiBase}/api/admin/consignment/listings/${id}/approve`, {
    method: 'PATCH',
    credentials: 'include',
    headers: csrfHeaders(),
  })
  await load(page.value)
}

function openReject(listing: Record<string, unknown>) {
  rejectTarget.value = listing.id as string
  rejectReason.value = ''
  rejectModal.value = true
}

async function confirmReject() {
  if (!rejectTarget.value || !rejectReason.value.trim()) return
  await $fetch(`${apiBase}/api/admin/consignment/listings/${rejectTarget.value}/reject`, {
    method: 'PATCH',
    credentials: 'include',
    headers: csrfHeaders(),
    body: { reason: rejectReason.value },
  })
  rejectModal.value = false
  await load(page.value)
}

async function viewLogs(listing: Record<string, unknown>) {
  logsModal.value = true
  logsLoading.value = true
  try {
    const res = await $fetch<{ data: Record<string, unknown>[] }>(
      `${apiBase}/api/admin/consignment/moderation-logs/${listing.id}`,
      { credentials: 'include' }
    )
    logs.value = res.data
  } finally {
    logsLoading.value = false
  }
}

onMounted(() => load(1))
</script>

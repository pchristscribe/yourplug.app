<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900">Reviews</h1>
        <p class="mt-2 text-sm text-gray-700">
          Manage product reviews and featured testimonials
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          type="button"
          @click="openCreateModal"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Add Review
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search reviews..."
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        @input="debouncedSearch"
      />

      <select
        v-model="productFilter"
        @change="loadReviews(1)"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        <option value="">All Products</option>
        <option v-for="product in products" :key="product.id" :value="product.id">
          {{ product.title }}
        </option>
      </select>

      <select
        v-model="ratingFilter"
        @change="loadReviews(1)"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        <option value="">All Ratings</option>
        <option value="5">5 Stars</option>
        <option value="4">4 Stars</option>
        <option value="3">3 Stars</option>
        <option value="2">2 Stars</option>
        <option value="1">1 Star</option>
      </select>

      <select
        v-model="featuredFilter"
        @change="loadReviews(1)"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        <option value="">All Reviews</option>
        <option value="true">Featured</option>
        <option value="false">Not Featured</option>
      </select>
    </div>

    <!-- Bulk Actions Bar -->
    <div v-if="selectedIds.length > 0" class="mt-4 bg-gray-50 px-4 py-3 rounded-md flex items-center justify-between">
      <span class="text-sm text-gray-700">
        {{ selectedIds.length }} {{ selectedIds.length === 1 ? 'review' : 'reviews' }} selected
      </span>
      <div class="flex gap-2">
        <button
          @click="bulkToggleFeatured(true)"
          class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Mark Featured
        </button>
        <button
          @click="bulkToggleFeatured(false)"
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Unmark Featured
        </button>
        <button
          @click="bulkDelete"
          class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Delete Selected
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="mt-8 flex flex-col">
      <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table v-if="!loading && reviews.length > 0" class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left">
                    <input
                      type="checkbox"
                      :checked="selectedIds.length === reviews.length && reviews.length > 0"
                      @change="toggleAll"
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Product</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Rating</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Author</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Content</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Featured</th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-for="review in reviews" :key="review.id">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3">
                    <input
                      type="checkbox"
                      :checked="selectedIds.includes(review.id)"
                      @change="toggleSelection(review.id)"
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                    {{ review.product?.title || 'N/A' }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4">
                    <div class="flex">
                      <svg
                        v-for="i in 5"
                        :key="i"
                        :class="i <= review.rating ? 'text-yellow-400' : 'text-gray-300'"
                        class="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ review.authorName }}
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500">
                    <p class="max-w-xs truncate">{{ review.content }}</p>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm">
                    <span
                      v-if="review.isFeatured"
                      class="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800"
                    >
                      Featured
                    </span>
                    <span v-else class="text-gray-400 text-xs">—</span>
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button @click="editReview(review)" class="text-indigo-600 hover:text-indigo-900 mr-4">
                      Edit
                    </button>
                    <button @click="deleteReview(review)" class="text-red-600 hover:text-red-900">
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="loading" class="text-center py-12">
              <p class="text-gray-500">Loading reviews...</p>
            </div>

            <div v-if="!loading && reviews.length === 0" class="text-center py-12">
              <p class="text-gray-500">No reviews found</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination" class="mt-6 flex items-center justify-between">
      <div class="text-sm text-gray-700">
        Showing <span class="font-medium">{{ (pagination.page - 1) * pagination.limit + 1 }}</span> to
        <span class="font-medium">{{ Math.min(pagination.page * pagination.limit, pagination.total) }}</span> of
        <span class="font-medium">{{ pagination.total }}</span> results
      </div>
      <div class="flex gap-2">
        <button
          :disabled="pagination.page === 1"
          @click="loadReviews(pagination.page - 1)"
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          :disabled="pagination.page === pagination.pages"
          @click="loadReviews(pagination.page + 1)"
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          {{ editingReview ? 'Edit Review' : 'Create Review' }}
        </h3>

        <form @submit.prevent="saveReview">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Product *</label>
              <select
                v-model="formData.productId"
                required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select a product...</option>
                <option v-for="product in products" :key="product.id" :value="product.id">
                  {{ product.title }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Rating *</label>
              <select
                v-model.number="formData.rating"
                required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option :value="5">5 Stars</option>
                <option :value="4">4 Stars</option>
                <option :value="3">3 Stars</option>
                <option :value="2">2 Stars</option>
                <option :value="1">1 Star</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Title</label>
              <input
                v-model="formData.title"
                type="text"
                maxlength="200"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g., Great quality product!"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Content *</label>
              <textarea
                v-model="formData.content"
                required
                minlength="10"
                maxlength="5000"
                rows="4"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Write your review..."
              />
              <p class="mt-1 text-xs text-gray-500">{{ formData.content.length }} / 5000 characters (min 10)</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Pros</label>
              <div v-for="(pro, index) in formData.pros" :key="index" class="flex gap-2 mb-2">
                <input
                  v-model="formData.pros[index]"
                  type="text"
                  maxlength="200"
                  class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Enter a pro..."
                />
                <button
                  type="button"
                  @click="removePro(index)"
                  class="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              <button
                v-if="formData.pros.length < 10"
                type="button"
                @click="addPro"
                class="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + Add Pro
              </button>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Cons</label>
              <div v-for="(con, index) in formData.cons" :key="index" class="flex gap-2 mb-2">
                <input
                  v-model="formData.cons[index]"
                  type="text"
                  maxlength="200"
                  class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Enter a con..."
                />
                <button
                  type="button"
                  @click="removeCon(index)"
                  class="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              <button
                v-if="formData.cons.length < 10"
                type="button"
                @click="addCon"
                class="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + Add Con
              </button>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Author Name</label>
              <input
                v-model="formData.authorName"
                type="text"
                maxlength="100"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="yourplug Team"
              />
            </div>

            <div class="flex items-center">
              <input
                v-model="formData.isFeatured"
                type="checkbox"
                class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label class="ml-2 block text-sm text-gray-900">
                Mark as Featured
              </label>
            </div>
          </div>

          <div class="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Saving...' : (editingReview ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Delete Review</h3>
        <p class="text-sm text-gray-500 mb-4">
          Are you sure you want to delete this review? This action cannot be undone.
        </p>
        <div class="flex gap-3 justify-end">
          <button
            @click="cancelDelete"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="confirmDelete"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { sanitizeText } from '~/utils/security'
import { useAdminCrudList } from '~/composables/useAdminCrudList'

definePageMeta({
  middleware: ['auth'],
  layout: 'default'
})

const config = useRuntimeConfig()
const saving = ref(false)
const products = ref<any[]>([])
const searchQuery = ref('')
const productFilter = ref('')
const ratingFilter = ref('')
const featuredFilter = ref('')
const selectedIds = ref<string[]>([])
const formData = ref({
  productId: '',
  rating: 5,
  title: '',
  content: '',
  pros: [] as string[],
  cons: [] as string[],
  authorName: 'yourplug Team',
  isFeatured: false
})

const crud = useAdminCrudList<any>('reviews')
const {
  loading,
  items: reviews,
  pagination,
  showModal,
  editingItem: editingReview,
  closeModal,
  showDeleteConfirm,
  deletingItem: deletingReview,
  cancelDelete,
} = crud

const loadReviews = (page = 1) => crud.load(async (p) => {
  const query: any = {
    page: p,
    limit: 20
  }
  if (searchQuery.value) query.search = searchQuery.value
  if (productFilter.value) query.productId = productFilter.value
  if (ratingFilter.value) query.rating = ratingFilter.value
  if (featuredFilter.value) query.isFeatured = featuredFilter.value

  const data = await $fetch(`${config.public.apiBase}/api/admin/reviews`, {
    credentials: 'include',
    query
  })
  return { items: data.reviews, pagination: data.pagination }
}, page)

const loadProducts = async () => {
  try {
    const data = await $fetch(`${config.public.apiBase}/api/admin/products`, {
      credentials: 'include',
      query: { limit: 1000 }
    })
    products.value = data.products
  } catch (err) {
    console.error('Failed to load products:', err)
  }
}

const debouncedSearch = (() => {
  let timeout: NodeJS.Timeout
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => loadReviews(1), 500)
  }
})()

const toggleSelection = (id: string) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const toggleAll = () => {
  if (selectedIds.value.length === reviews.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = reviews.value.map(r => r.id)
  }
}

const openCreateModal = () => {
  crud.openCreateModal()
  formData.value = {
    productId: '',
    rating: 5,
    title: '',
    content: '',
    pros: [],
    cons: [],
    authorName: 'yourplug Team',
    isFeatured: false
  }
}

const editReview = (review: any) => {
  crud.openEditModal(review)
  formData.value = {
    productId: review.productId,
    rating: review.rating,
    title: review.title || '',
    content: review.content,
    pros: review.pros || [],
    cons: review.cons || [],
    authorName: review.authorName || 'yourplug Team',
    isFeatured: review.isFeatured || false
  }
}

const addPro = () => {
  if (formData.value.pros.length < 10) {
    formData.value.pros.push('')
  }
}

const removePro = (index: number) => {
  formData.value.pros.splice(index, 1)
}

const addCon = () => {
  if (formData.value.cons.length < 10) {
    formData.value.cons.push('')
  }
}

const removeCon = (index: number) => {
  formData.value.cons.splice(index, 1)
}

const saveReview = async () => {
  if (saving.value) return // Prevent double-submission

  saving.value = true
  try {
    // Sanitize all text inputs to prevent HTML injection
    const cleanData: any = {
      productId: formData.value.productId,
      rating: formData.value.rating,
      content: sanitizeText(formData.value.content),
      isFeatured: formData.value.isFeatured
    }

    if (formData.value.title) {
      cleanData.title = sanitizeText(formData.value.title)
    }

    if (formData.value.authorName) {
      cleanData.authorName = sanitizeText(formData.value.authorName)
    }

    // Filter empty items and sanitize
    const pros = formData.value.pros
      .filter(p => p.trim())
      .map(p => sanitizeText(p))
    const cons = formData.value.cons
      .filter(c => c.trim())
      .map(c => sanitizeText(c))

    if (pros.length > 0) cleanData.pros = pros
    if (cons.length > 0) cleanData.cons = cons

    if (editingReview.value) {
      await $fetch(`${config.public.apiBase}/api/admin/reviews/${editingReview.value.id}`, {
        method: 'PATCH',
        credentials: 'include',
        body: cleanData
      })
    } else {
      await $fetch(`${config.public.apiBase}/api/admin/reviews`, {
        method: 'POST',
        credentials: 'include',
        body: cleanData
      })
    }

    closeModal()
    await loadReviews(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to save review:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to save review'
    alert(errorMessage)
  } finally {
    saving.value = false
  }
}

const deleteReview = (review: any) => {
  crud.requestDelete(review)
}

const confirmDelete = async () => {
  try {
    await $fetch(`${config.public.apiBase}/api/admin/reviews/${deletingReview.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    cancelDelete()
    await loadReviews(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to delete review:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to delete review'
    alert(errorMessage)
  }
}

const bulkDelete = async () => {
  if (!confirm(`Delete ${selectedIds.value.length} reviews?`)) return

  try {
    await $fetch(`${config.public.apiBase}/api/admin/reviews/bulk/delete`, {
      method: 'POST',
      credentials: 'include',
      body: { reviewIds: selectedIds.value }
    })

    selectedIds.value = []
    await loadReviews(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to bulk delete:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to delete reviews'
    alert(errorMessage)
  }
}

const bulkToggleFeatured = async (isFeatured: boolean) => {
  try {
    await $fetch(`${config.public.apiBase}/api/admin/reviews/bulk/toggle-featured`, {
      method: 'POST',
      credentials: 'include',
      body: {
        reviewIds: selectedIds.value,
        isFeatured
      }
    })

    selectedIds.value = []
    await loadReviews(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to toggle featured:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to update reviews'
    alert(errorMessage)
  }
}

onMounted(() => {
  loadProducts()
  loadReviews()
})
</script>

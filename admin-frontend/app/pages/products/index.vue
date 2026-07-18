<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900">Products</h1>
        <p class="mt-2 text-sm text-gray-700">
          Manage your affiliate products
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          type="button"
          @click="openCreateModal"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
        >
          Add Product
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="mt-6 flex gap-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search products..."
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        @input="debouncedSearch"
      />
    </div>

    <!-- Products Table -->
    <div class="mt-8 flex flex-col">
      <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table v-if="!loading && products.length > 0" class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Product</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Platform</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Category</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Price</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-for="product in products" :key="product.id">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3">
                    <div class="flex items-center">
                      <div class="h-10 w-10 flex-shrink-0">
                        <img class="h-10 w-10 rounded object-cover" :src="getSafeImageUrl(product.imageUrl)" :alt="product.title" />
                      </div>
                      <div class="ml-4">
                        <div class="font-medium text-gray-900 truncate max-w-xs">{{ product.title }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{{ product.platform }}</td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{{ product.category.name }}</td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${{ product.price.toFixed(2) }}</td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm">
                    <span :class="[
                      product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      product.status === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800',
                      'inline-flex rounded-full px-2 text-xs font-semibold leading-5'
                    ]">
                      {{ product.status }}
                    </span>
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button @click="editProduct(product)" class="text-indigo-600 hover:text-indigo-900 mr-4">
                      Edit
                    </button>
                    <button @click="deleteProduct(product)" class="text-red-600 hover:text-red-900">
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="loading" class="text-center py-12">
              <p class="text-gray-500">Loading products...</p>
            </div>

            <div v-if="!loading && products.length === 0" class="text-center py-12">
              <p class="text-gray-500">No products found</p>
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
          @click="loadProducts(pagination.page - 1)"
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          :disabled="pagination.page === pagination.pages"
          @click="loadProducts(pagination.page + 1)"
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
          {{ editingProduct ? 'Edit Product' : 'Create Product' }}
        </h3>

        <form @submit.prevent="saveProduct">
          <div class="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Title *</label>
                <input
                  v-model="formData.title"
                  type="text"
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Product title"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Platform *</label>
                <select
                  v-model="formData.platform"
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select platform</option>
                  <option value="DHGATE">DHgate</option>
                  <option value="ALIEXPRESS">AliExpress</option>
                  <option value="AMAZON">Amazon</option>
                  <option value="WISH">Wish</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Description *</label>
              <textarea
                v-model="formData.description"
                required
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Product description..."
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Image URL *</label>
              <input
                v-model="formData.imageUrl"
                type="url"
                required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="https://example.com/image.jpg"
              />
              <p class="mt-1 text-xs text-gray-500">Full URL to product image</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Price *</label>
                <input
                  v-model.number="formData.price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Currency</label>
                <input
                  v-model="formData.currency"
                  type="text"
                  maxlength="3"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="USD"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Status *</label>
                <select
                  v-model="formData.status"
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Category *</label>
                <select
                  v-model="formData.categoryId"
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select category</option>
                  <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">External ID *</label>
                <input
                  v-model="formData.externalId"
                  type="text"
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Platform product ID"
                />
                <p class="mt-1 text-xs text-gray-500">Product ID from the platform</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Rating (1-5)</label>
                <input
                  v-model.number="formData.rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="4.5"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Review Count</label>
                <input
                  v-model.number="formData.reviewCount"
                  type="number"
                  min="0"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
              <input
                v-model="tagsInput"
                type="text"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="summer, fashion, trending"
              />
              <p class="mt-1 text-xs text-gray-500">Separate tags with commas</p>
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
              {{ saving ? 'Saving...' : (editingProduct ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Delete Product</h3>
        <p class="text-sm text-gray-500 mb-4">
          Are you sure you want to delete <span class="font-semibold">{{ deletingProduct?.title }}</span>?
          This action cannot be undone.
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
import { getSafeImageUrl, isValidHttpUrl } from '~/utils/security'
import { useAdminCrudList } from '~/composables/useAdminCrudList'

definePageMeta({
  middleware: ['auth'],
  layout: 'default'
})

const config = useRuntimeConfig()
const saving = ref(false)
const categories = ref<any[]>([])
const searchQuery = ref('')
const tagsInput = ref('')

const formData = ref({
  title: '',
  platform: '',
  description: '',
  imageUrl: '',
  price: 0,
  currency: 'USD',
  status: 'ACTIVE',
  categoryId: '',
  externalId: '',
  rating: null as number | null,
  reviewCount: 0,
  tags: [] as string[]
})

const crud = useAdminCrudList<any>('products')
const {
  loading,
  items: products,
  pagination,
  showModal,
  editingItem: editingProduct,
  closeModal,
  showDeleteConfirm,
  deletingItem: deletingProduct,
  cancelDelete,
} = crud

const loadProducts = (page = 1) => crud.load(async (p) => {
  const data = await $fetch(`${config.public.apiBase}/api/admin/products`, {
    credentials: 'include',
    query: {
      page: p,
      limit: 20,
      search: searchQuery.value || undefined
    }
  })
  return { items: data.products, pagination: data.pagination }
}, page)

const loadCategories = async () => {
  try {
    const data = await $fetch(`${config.public.apiBase}/api/admin/categories`, {
      credentials: 'include',
      query: { limit: 100 }
    })
    categories.value = data.categories
  } catch (err) {
    console.error('Failed to load categories:', err)
  }
}

const debouncedSearch = (() => {
  let timeout: NodeJS.Timeout
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => loadProducts(1), 500)
  }
})()

const openCreateModal = () => {
  crud.openCreateModal()
  formData.value = {
    title: '',
    platform: '',
    description: '',
    imageUrl: '',
    price: 0,
    currency: 'USD',
    status: 'ACTIVE',
    categoryId: '',
    externalId: '',
    rating: null,
    reviewCount: 0,
    tags: []
  }
  tagsInput.value = ''
}

const editProduct = (product: any) => {
  crud.openEditModal(product)
  formData.value = {
    title: product.title,
    platform: product.platform,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price,
    currency: product.currency || 'USD',
    status: product.status,
    categoryId: product.categoryId,
    externalId: product.externalId,
    rating: product.rating,
    reviewCount: product.reviewCount || 0,
    tags: product.tags || []
  }
  tagsInput.value = (product.tags || []).join(', ')
}

const saveProduct = async () => {
  if (saving.value) return // Prevent double-submission

  // Validate image URL before submission
  if (!isValidHttpUrl(formData.value.imageUrl)) {
    alert('Invalid image URL. Please provide a valid HTTP or HTTPS URL.')
    return
  }

  saving.value = true
  try {
    // Parse tags from comma-separated input
    const tags = tagsInput.value
      ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t)
      : []

    // Clean up form data
    const cleanData: any = {
      title: formData.value.title,
      platform: formData.value.platform,
      description: formData.value.description,
      imageUrl: formData.value.imageUrl.trim(), // Trim whitespace
      price: parseFloat(formData.value.price.toString()),
      currency: formData.value.currency,
      status: formData.value.status,
      categoryId: formData.value.categoryId,
      externalId: formData.value.externalId,
      reviewCount: parseInt(formData.value.reviewCount.toString()) || 0,
      tags
    }

    // Only include rating if it's set
    if (formData.value.rating !== null && formData.value.rating !== undefined) {
      cleanData.rating = parseFloat(formData.value.rating.toString())
    }

    if (editingProduct.value) {
      await $fetch(`${config.public.apiBase}/api/admin/products/${editingProduct.value.id}`, {
        method: 'PATCH',
        credentials: 'include',
        body: cleanData
      })
    } else {
      await $fetch(`${config.public.apiBase}/api/admin/products`, {
        method: 'POST',
        credentials: 'include',
        body: cleanData
      })
    }

    closeModal()
    await loadProducts(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to save product:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to save product'
    alert(errorMessage)
  } finally {
    saving.value = false
  }
}

const deleteProduct = (product: any) => {
  crud.requestDelete(product)
}

const confirmDelete = async () => {
  try {
    await $fetch(`${config.public.apiBase}/api/admin/products/${deletingProduct.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    cancelDelete()
    await loadProducts(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to delete product:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to delete product'
    alert(errorMessage)
  }
}

onMounted(async () => {
  await Promise.all([loadProducts(), loadCategories()])
})
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900">Categories</h1>
        <p class="mt-2 text-sm text-gray-700">
          Manage product categories and organize your catalog
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          type="button"
          @click="openCreateModal"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Add Category
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="mt-6">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search categories..."
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        @input="debouncedSearch"
      />
    </div>

    <!-- Bulk Actions Bar -->
    <div v-if="selectedIds.length > 0" class="mt-4 bg-gray-50 px-4 py-3 rounded-md flex items-center justify-between">
      <span class="text-sm text-gray-700">
        {{ selectedIds.length }} {{ selectedIds.length === 1 ? 'category' : 'categories' }} selected
      </span>
      <button
        @click="bulkDelete"
        class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        Delete Selected
      </button>
    </div>

    <!-- Table -->
    <div class="mt-8 flex flex-col">
      <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table v-if="!loading && categories.length > 0" class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left">
                    <input
                      type="checkbox"
                      :checked="selectedIds.length === categories.length && categories.length > 0"
                      @change="toggleAll"
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Image</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Slug</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Products</th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-for="category in categories" :key="category.id">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3">
                    <input
                      type="checkbox"
                      :checked="selectedIds.includes(category.id)"
                      @change="toggleSelection(category.id)"
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </td>
                  <td class="whitespace-nowrap px-3 py-4">
                    <img
                      v-if="category.imageUrl"
                      :src="getSafeImageUrl(category.imageUrl)"
                      :alt="category.name"
                      class="h-10 w-10 rounded object-cover"
                    />
                    <div v-else class="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                      <span class="text-gray-400 text-xs">No img</span>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                    {{ category.name }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ category.slug }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <span class="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800">
                      {{ category._count?.products || 0 }} products
                    </span>
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button @click="editCategory(category)" class="text-indigo-600 hover:text-indigo-900 mr-4">
                      Edit
                    </button>
                    <button @click="deleteCategory(category)" class="text-red-600 hover:text-red-900">
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="loading" class="text-center py-12">
              <p class="text-gray-500">Loading categories...</p>
            </div>

            <div v-if="!loading && categories.length === 0" class="text-center py-12">
              <p class="text-gray-500">No categories found</p>
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
          @click="loadCategories(pagination.page - 1)"
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          :disabled="pagination.page === pagination.pages"
          @click="loadCategories(pagination.page + 1)"
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          {{ editingCategory ? 'Edit Category' : 'Create Category' }}
        </h3>

        <form @submit.prevent="saveCategory">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Name *</label>
              <input
                v-model="formData.name"
                type="text"
                required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g., Men's Fashion"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Slug *</label>
              <input
                v-model="formData.slug"
                type="text"
                required
                pattern="[a-z0-9-]+"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g., mens-fashion"
              />
              <p class="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                v-model="formData.description"
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Optional description..."
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Image URL</label>
              <input
                v-model="formData.imageUrl"
                type="url"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="https://example.com/image.jpg"
              />
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
              {{ saving ? 'Saving...' : (editingCategory ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Delete Category</h3>
        <p class="text-sm text-gray-500 mb-4">
          Are you sure you want to delete <span class="font-semibold">{{ deletingCategory?.name }}</span>?
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
const searchQuery = ref('')
const selectedIds = ref<string[]>([])
const formData = ref({
  name: '',
  slug: '',
  description: '',
  imageUrl: ''
})

const crud = useAdminCrudList<any>('categories')
const {
  loading,
  items: categories,
  pagination,
  showModal,
  editingItem: editingCategory,
  closeModal,
  showDeleteConfirm,
  deletingItem: deletingCategory,
  cancelDelete,
} = crud

const loadCategories = (page = 1) => crud.load(async (p) => {
  const data = await $fetch(`${config.public.apiBase}/api/admin/categories`, {
    credentials: 'include',
    query: {
      page: p,
      limit: 50,
      search: searchQuery.value || undefined
    }
  })
  return { items: data.categories, pagination: data.pagination }
}, page)

const debouncedSearch = (() => {
  let timeout: NodeJS.Timeout
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => loadCategories(1), 500)
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
  if (selectedIds.value.length === categories.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = categories.value.map(c => c.id)
  }
}

const openCreateModal = () => {
  crud.openCreateModal()
  formData.value = {
    name: '',
    slug: '',
    description: '',
    imageUrl: ''
  }
}

const editCategory = (category: any) => {
  crud.openEditModal(category)
  formData.value = {
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    imageUrl: category.imageUrl || ''
  }
}

const saveCategory = async () => {
  if (saving.value) return // Prevent double-submission

  // Validate image URL if provided
  if (formData.value.imageUrl && !isValidHttpUrl(formData.value.imageUrl)) {
    alert('Invalid image URL. Please provide a valid HTTP or HTTPS URL, or leave it empty.')
    return
  }

  saving.value = true
  try {
    // Clean up form data - remove empty strings
    const cleanData: any = {
      name: formData.value.name,
      slug: formData.value.slug
    }
    if (formData.value.description) cleanData.description = formData.value.description
    if (formData.value.imageUrl) cleanData.imageUrl = formData.value.imageUrl.trim()

    if (editingCategory.value) {
      await $fetch(`${config.public.apiBase}/api/admin/categories/${editingCategory.value.id}`, {
        method: 'PATCH',
        credentials: 'include',
        body: cleanData
      })
    } else {
      await $fetch(`${config.public.apiBase}/api/admin/categories`, {
        method: 'POST',
        credentials: 'include',
        body: cleanData
      })
    }

    closeModal()
    await loadCategories(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to save category:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to save category'
    alert(errorMessage)
  } finally {
    saving.value = false
  }
}

const deleteCategory = (category: any) => {
  crud.requestDelete(category)
}

const confirmDelete = async () => {
  try {
    await $fetch(`${config.public.apiBase}/api/admin/categories/${deletingCategory.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    cancelDelete()
    await loadCategories(pagination.value?.page || 1)
  } catch (err: any) {
    console.error('Failed to delete category:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to delete category'
    alert(errorMessage)
  }
}

const bulkDelete = async () => {
  if (!confirm(`Delete ${selectedIds.value.length} categories?`)) return

  try {
    const response = await $fetch(`${config.public.apiBase}/api/admin/categories/bulk/delete`, {
      method: 'POST',
      credentials: 'include',
      body: { categoryIds: selectedIds.value }
    })

    if (response.error) {
      alert(response.message)
    } else {
      selectedIds.value = []
      await loadCategories(pagination.value?.page || 1)
    }
  } catch (err: any) {
    console.error('Failed to bulk delete:', err)
    const errorMessage = err.data?.message || err.data?.error || 'Failed to delete categories'
    alert(errorMessage)
  }
}

onMounted(() => loadCategories())
</script>

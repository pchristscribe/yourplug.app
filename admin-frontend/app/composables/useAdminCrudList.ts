import type { Ref } from 'vue'

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface LoadResult<T> {
  items: T[]
  pagination: Pagination | null
}

/**
 * Shared pagination/loading + create-edit-modal + delete-confirm state for the
 * admin CRUD pages (categories, reviews, products). Fetch logic, form fields,
 * and save/delete requests stay in each page since those genuinely differ.
 */
export function useAdminCrudList<T extends { id: string }>(entityLabel: string) {
  const loading = ref(true)
  const items = ref<T[]>([]) as Ref<T[]>
  const pagination = ref<Pagination | null>(null)

  const load = async (fetcher: (page: number) => Promise<LoadResult<T>>, page = 1) => {
    loading.value = true
    try {
      const result = await fetcher(page)
      items.value = result.items
      pagination.value = result.pagination
    } catch (err) {
      console.error(`Failed to load ${entityLabel}:`, err)
      alert(`Failed to load ${entityLabel}. Please try again.`)
    } finally {
      loading.value = false
    }
  }

  const showModal = ref(false)
  const editingItem = ref<T | null>(null) as Ref<T | null>

  const openCreateModal = () => {
    editingItem.value = null
    showModal.value = true
  }

  const openEditModal = (item: T) => {
    editingItem.value = item
    showModal.value = true
  }

  const closeModal = () => {
    showModal.value = false
    editingItem.value = null
  }

  const showDeleteConfirm = ref(false)
  const deletingItem = ref<T | null>(null) as Ref<T | null>

  const requestDelete = (item: T) => {
    deletingItem.value = item
    showDeleteConfirm.value = true
  }

  const cancelDelete = () => {
    showDeleteConfirm.value = false
    deletingItem.value = null
  }

  return {
    loading,
    items,
    pagination,
    load,
    showModal,
    editingItem,
    openCreateModal,
    openEditModal,
    closeModal,
    showDeleteConfirm,
    deletingItem,
    requestDelete,
    cancelDelete,
  }
}

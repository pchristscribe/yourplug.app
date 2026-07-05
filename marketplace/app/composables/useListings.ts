import type {
  ListingSummary,
  ListingDetail,
  ListingFilters,
  PaginatedListings,
} from '~/types/listings'

function mapDbListing(row: Record<string, unknown>): ListingSummary {
  return {
    id: row.id as string,
    title: row.title as string,
    condition: row.condition as ListingSummary['condition'],
    category: row.category as ListingSummary['category'],
    askingPrice: Number(row.asking_price ?? row.askingPrice),
    createdAt: (row.created_at ?? row.createdAt) as string,
    sellerDisplayName: (row.seller_display_name ?? row.sellerDisplayName) as string | null,
    primaryImageUrl: (row.primary_image_url ?? row.primaryImageUrl) as string | null,
  }
}

export function useListings() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  const items = ref<ListingSummary[]>([])
  const pagination = ref<PaginatedListings['pagination'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getListings(filters: ListingFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.category) params.set('category', filters.category)
      if (filters.condition) params.set('condition', filters.condition)
      if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
      if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.order) params.set('order', filters.order)
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))

      const res = await $fetch<{ data: Record<string, unknown>[]; pagination: PaginatedListings['pagination'] }>(
        `${apiBase}/api/consignment/listings?${params.toString()}`
      )
      items.value = res.data.map(mapDbListing)
      pagination.value = res.pagination
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load listings'
    } finally {
      loading.value = false
    }
  }

  async function getListing(id: string): Promise<ListingDetail | null> {
    try {
      const row = await $fetch<Record<string, unknown>>(`${apiBase}/api/consignment/listings/${id}`)
      return {
        ...mapDbListing(row),
        description: row.description as string,
        status: row.status as ListingDetail['status'],
        moderationStatus: row.moderation_status as ListingDetail['moderationStatus'],
        moderationReason: (row.moderation_reason ?? null) as string | null,
        sellerTotalSales: Number(row.seller_total_sales ?? 0),
        images: (row.images as Record<string, unknown>[]).map(img => ({
          id: img.id as string,
          listingId: (img.listing_id ?? img.listingId) as string,
          publicUrl: (img.public_url ?? img.publicUrl) as string,
          isPrimary: (img.is_primary ?? img.isPrimary) as boolean,
          sortOrder: Number(img.sort_order ?? img.sortOrder ?? 0),
          createdAt: (img.created_at ?? img.createdAt) as string,
        })),
      }
    } catch {
      return null
    }
  }

  return { items, pagination, loading, error, getListings, getListing }
}

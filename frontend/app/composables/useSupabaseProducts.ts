import type { Database } from '~/types/supabase'
import type { Product, Category, Pagination, ProductFilters, Review } from '~/types'

type DbProduct = Database['public']['Tables']['products']['Row']
type DbCategory = Database['public']['Tables']['categories']['Row']

function mapDbCategory(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDbProduct(row: DbProduct & { categories?: DbCategory | null }): Product {
  return {
    id: row.id,
    externalId: row.external_id,
    platform: row.platform,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    price: row.price,
    currency: row.currency,
    priceUpdatedAt: row.price_updated_at,
    categoryId: row.category_id,
    category: row.categories ? mapDbCategory(row.categories) : undefined,
    status: row.status,
    rating: row.rating ?? undefined,
    reviewCount: row.review_count,
    tags: row.tags,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const useSupabaseProducts = () => {
  const supabase = useSupabaseClient<Database>()

  const getProducts = async (filters: ProductFilters = {}): Promise<{ products: Product[]; pagination: Pagination }> => {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('products')
      .select('*, categories(*)', { count: 'exact' })

    if (filters.status) {
      query = query.eq('status', filters.status)
    } else {
      query = query.eq('status', 'ACTIVE')
    }

    if (filters.platform) {
      query = query.eq('platform', filters.platform)
    }

    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }

    if (filters.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice)
    }

    if (filters.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice)
    }

    if (filters.minRating !== undefined) {
      query = query.gte('rating', filters.minRating)
    }

    if (filters.tag) {
      query = query.contains('tags', [filters.tag])
    }

    const sortColumn = filters.sortBy === 'createdAt' ? 'created_at'
      : filters.sortBy === 'price' ? 'price'
      : filters.sortBy === 'rating' ? 'rating'
      : 'created_at'

    query = query
      .order(sortColumn, { ascending: filters.order === 'asc' })
      .range(from, to)

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    const total = count ?? 0
    return {
      products: (data ?? []).map(mapDbProduct),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  const getProduct = async (id: string): Promise<Product> => {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*), affiliate_links(*), reviews(*)')
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Product not found')

    const product = mapDbProduct(data)
    if (data.affiliate_links) {
      product.affiliateLinks = data.affiliate_links.map((link) => ({
        id: link.id,
        productId: link.product_id,
        originalUrl: link.original_url,
        trackedUrl: link.tracked_url,
        dubLinkId: link.dub_link_id ?? undefined,
        clicks: link.clicks,
        conversions: link.conversions,
        revenue: link.revenue,
        lastClickedAt: link.last_clicked_at ?? undefined,
        createdAt: link.created_at,
        updatedAt: link.updated_at,
      }))
    }
    if (data.reviews) {
      product.reviews = data.reviews
        .map((row): Review => ({
          id: row.id,
          productId: row.product_id,
          rating: row.rating,
          title: row.title ?? undefined,
          content: row.content,
          pros: row.pros ?? [],
          cons: row.cons ?? [],
          authorName: row.author_name,
          isFeatured: row.is_featured,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
        .sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
          return b.createdAt.localeCompare(a.createdAt)
        })
    }

    return product
  }

  const getCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(count)')
      .order('name')

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      ...mapDbCategory(row),
      _count: {
        products: (row.products as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
      },
    }))
  }

  const getCategory = async (identifier: string): Promise<Category> => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq(isUuid ? 'id' : 'slug', identifier)
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Category not found')

    return mapDbCategory(data)
  }

  const searchProducts = async (query: string, filters: ProductFilters = {}): Promise<{ products: Product[]; pagination: Pagination }> => {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Escape LIKE wildcards, then strip PostgREST filter delimiters (comma
    // separates OR clauses; parens allow nested groups). Dot-operator paths
    // remain theoretically injectable — full mitigation requires a Postgres
    // RPC or .textSearch() (tracked in TECH_DEBT.md Phase 3).
    const sanitized = query
      .replace(/[%_\\]/g, '\\$&')
      .replace(/[,()]/g, ' ')
      .replace(/['"]/g, '')
    const { data, error, count } = await supabase
      .from('products')
      .select('*, categories(*)', { count: 'exact' })
      .eq('status', 'ACTIVE')
      .or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)

    const total = count ?? 0
    return {
      products: (data ?? []).map(mapDbProduct),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  return {
    getProducts,
    getProduct,
    getCategories,
    getCategory,
    searchProducts,
  }
}

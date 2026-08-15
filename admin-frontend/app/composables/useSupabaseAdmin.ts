import type { Database } from '~/types/supabase'

type DbProduct = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export interface AdminProduct {
  id: string
  externalId: string
  platform: string
  title: string
  description: string
  imageUrl: string
  price: number
  currency: string
  categoryId: string
  status: string
  rating: number | null
  reviewCount: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface AdminCategory {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  productCount?: number
}

function mapProduct(row: DbProduct): AdminProduct {
  return {
    id: row.id,
    externalId: row.external_id,
    platform: row.platform,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    price: row.price,
    currency: row.currency,
    categoryId: row.category_id,
    status: row.status,
    rating: row.rating,
    reviewCount: row.review_count,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const useSupabaseAdmin = () => {
  const supabase = useSupabaseClient<Database>()

  // ─── Products ────────────────────────────────────────────────────────────

  const listProducts = async (options: {
    page?: number
    limit?: number
    status?: string
    platform?: string
    categoryId?: string
  } = {}) => {
    const page = options.page ?? 1
    const limit = options.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (options.status) query = query.eq('status', options.status)
    if (options.platform) query = query.eq('platform', options.platform)
    if (options.categoryId) query = query.eq('category_id', options.categoryId)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    return {
      products: (data ?? []).map(mapProduct),
      total: count ?? 0,
      page,
      limit,
    }
  }

  const createProduct = async (product: ProductInsert): Promise<AdminProduct> => {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapProduct(data)
  }

  const updateProduct = async (id: string, updates: ProductUpdate): Promise<AdminProduct> => {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapProduct(data)
  }

  const deleteProduct = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  const updateProductStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'): Promise<AdminProduct> => {
    return updateProduct(id, { status })
  }

  // ─── Categories ──────────────────────────────────────────────────────────

  const listCategories = async (): Promise<AdminCategory[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(count)')
      .order('name')

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      productCount: (row as any).products?.[0]?.count ?? 0,
    }))
  }

  const createCategory = async (category: CategoryInsert): Promise<AdminCategory> => {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single()

    if (error) throw new Error(error.message)

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      imageUrl: data.image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  const updateCategory = async (id: string, updates: CategoryUpdate): Promise<AdminCategory> => {
    const { data, error } = await supabase
      .from('categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      imageUrl: data.image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  const deleteCategory = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  // ─── Analytics ───────────────────────────────────────────────────────────

  // NOTE: unused today. `revenue` is no longer readable via the anon-key
  // client (migration 014 restricts it to service_role) — wire this through
  // a backend admin route using the service-role Postgres connection before
  // calling it from a page.
  const getAffiliateStats = async () => {
    const { data, error } = await supabase
      .from('affiliate_links')
      .select('clicks, conversions, revenue')

    if (error) throw new Error(error.message)

    return (data ?? []).reduce(
      (acc, row) => ({
        totalClicks: acc.totalClicks + row.clicks,
        totalConversions: acc.totalConversions + row.conversions,
        totalRevenue: acc.totalRevenue + row.revenue,
      }),
      { totalClicks: 0, totalConversions: 0, totalRevenue: 0 },
    )
  }

  return {
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStatus,
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getAffiliateStats,
  }
}

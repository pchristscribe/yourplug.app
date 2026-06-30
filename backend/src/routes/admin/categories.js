import { adminAuth, csrfProtection } from '../../middleware/adminAuth.js'
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  listCategoriesSchema,
  bulkDeleteCategoriesSchema
} from '../../schemas/category.js'
import { UUID_RE } from '../../utils/constants.js'
import { withCountShape } from '../../utils/countShape.js'

// Allowlist for sortBy → DB column mapping. Anything not in this map
// falls back to `name` so the ORDER BY can never be user-controlled SQL.
const SORTABLE = {
  name: 'name',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

// updated_at is maintained by the categories_updated_at BEFORE UPDATE trigger
// defined in supabase/migrations/001_initial_schema.sql — no need to include it here
const CATEGORY_WRITEABLE_FIELDS = ['name', 'slug', 'description', 'imageUrl']
const TO_COLUMN = {
  imageUrl: 'image_url'
}

const toColumn = (key) => TO_COLUMN[key] || key

export default async function adminCategoryRoutes(fastify, options) {
  const { sql, redis } = fastify

  fastify.addHook('onRequest', adminAuth)
  fastify.addHook('onRequest', csrfProtection)

  // List categories
  fastify.get('/', { schema: listCategoriesSchema }, async (request, reply) => {
    const {
      search,
      page = 1,
      limit = 50,
      sortBy = 'name',
      order = 'asc'
    } = request.query

    const safeLimit = Math.min(parseInt(limit, 10) || 50, 200)
    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const skip = (safePage - 1) * safeLimit
    const sortColumn = SORTABLE[sortBy] || 'name'
    const sortOrder = order === 'desc' ? sql`desc` : sql`asc`
    const searchPattern = search ? `%${search.replace(/[%_\\]/g, '\\$&')}%` : null

    const whereClause = searchPattern === null
      ? sql`true`
      : sql`(c.name ilike ${searchPattern} or c.description ilike ${searchPattern})`

    const [rows, [{ count }]] = await Promise.all([
      sql`
        select
          c.*,
          (select count(*)::int from products p where p.category_id = c.id) as product_count
        from categories c
        where ${whereClause}
        order by ${sql(sortColumn)} ${sortOrder}
        limit ${safeLimit}
        offset ${skip}
      `,
      sql`select count(*)::int as count from categories c where ${whereClause}`
    ])

    return {
      categories: rows.map(withCountShape),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count,
        pages: Math.ceil(count / safeLimit)
      }
    }
  })

  // Get single category
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params

    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Category not found' }
    }

    const [row] = await sql`
      select
        c.*,
        (select count(*)::int from products p where p.category_id = c.id) as product_count
      from categories c
      where c.id = ${id}
    `

    if (!row) {
      reply.code(404)
      return { error: 'Category not found' }
    }

    return withCountShape(row)
  })

  // Create category
  fastify.post('/', { schema: createCategorySchema }, async (request, reply) => {
    const data = request.body
    const insertObj = Object.fromEntries(
      CATEGORY_WRITEABLE_FIELDS
        .filter(k => data[k] !== undefined)
        .map(k => [toColumn(k), data[k]])
    )

    try {
      const [category] = await sql`
        insert into categories ${sql(insertObj)}
        returning *
      `
      await redis.del('categories:all')
      reply.code(201)
      return category
    } catch (error) {
      if (error.code === '23505') {
        reply.code(409)
        return {
          error: 'Conflict',
          message: 'Category with this name or slug already exists'
        }
      }
      throw error
    }
  })

  // Update category
  fastify.patch('/:id', { schema: updateCategorySchema }, async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Category not found' }
    }
    const data = request.body
    const updateObj = Object.fromEntries(
      CATEGORY_WRITEABLE_FIELDS
        .filter(k => data[k] !== undefined)
        .map(k => [toColumn(k), data[k]])
    )

    if (Object.keys(updateObj).length === 0) {
      const [row] = await sql`select * from categories where id = ${id}`
      if (!row) {
        reply.code(404)
        return { error: 'Category not found' }
      }
      return row
    }

    try {
      const [category] = await sql`
        update categories
        set ${sql(updateObj)}
        where id = ${id}
        returning *
      `

      if (!category) {
        reply.code(404)
        return { error: 'Category not found' }
      }

      await redis.del('categories:all')
      return category
    } catch (error) {
      if (error.code === '23505') {
        reply.code(409)
        return {
          error: 'Conflict',
          message: 'Category with this name or slug already exists'
        }
      }
      throw error
    }
  })

  // Delete category
  fastify.delete('/:id', { schema: deleteCategorySchema }, async (request, reply) => {
    const { id } = request.params

    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Category not found' }
    }

    const [{ count: productsCount }] = await sql`
      select count(*)::int as count from products where category_id = ${id}
    `

    if (productsCount > 0) {
      reply.code(409)
      return {
        error: 'Cannot Delete',
        message: `Category has ${productsCount} products. Please reassign or delete them first.`
      }
    }

    let result
    try {
      result = await sql`delete from categories where id = ${id}`
    } catch (error) {
      // 23503 = FK violation: a product was inserted between the count check and the delete
      if (error.code === '23503') {
        reply.code(409)
        return { error: 'Cannot Delete', message: 'Category has products. Please reassign or delete them first.' }
      }
      throw error
    }

    if (Number(result.count) === 0) {
      reply.code(404)
      return { error: 'Category not found' }
    }

    await redis.del('categories:all')
    reply.code(204)
    return
  })

  // Bulk delete categories
  fastify.post('/bulk/delete', { schema: bulkDeleteCategoriesSchema }, async (request, reply) => {
    const { categoryIds } = request.body

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      reply.code(400)
      return { error: 'categoryIds array is required' }
    }

    if (categoryIds.some(id => !UUID_RE.test(id))) {
      reply.code(400)
      return { error: 'Invalid category ID format' }
    }

    const blocking = await sql`
      select c.id, c.name,
        (select count(*)::int from products p where p.category_id = c.id) as product_count
      from categories c
      where c.id in ${sql(categoryIds)}
    `

    const cannotDelete = blocking.filter(c => c.productCount > 0)

    if (cannotDelete.length > 0) {
      reply.code(409)
      return {
        error: 'Cannot delete categories with products',
        message: `${cannotDelete.length} categories have products and cannot be deleted`,
        categories: cannotDelete.map(cat => ({
          id: cat.id,
          name: cat.name,
          productCount: cat.productCount
        }))
      }
    }

    const result = await sql`
      delete from categories where id in ${sql(categoryIds)}
    `

    await redis.del('categories:all')
    return {
      success: true,
      deleted: result.count,
      message: `Successfully deleted ${result.count} categories`
    }
  })
}

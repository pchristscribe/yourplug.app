import { adminAuth } from '../../middleware/adminAuth.js'
import { UUID_RE } from '../../utils/constants.js'

const VALID_TYPES = ['size', 'color', 'material', 'style', 'pack_size']
const VALID_STOCK = ['in_stock', 'low_stock', 'out_of_stock']
const WRITABLE    = ['product_id', 'variant_type', 'value', 'price_modifier',
                     'sku', 'stock_status', 'image_url', 'sort_order', 'is_default']

const TO_COLUMN = {
  productId:     'product_id',
  variantType:   'variant_type',
  priceModifier: 'price_modifier',
  stockStatus:   'stock_status',
  imageUrl:      'image_url',
  sortOrder:     'sort_order',
  isDefault:     'is_default'
}
const toColumn = (k) => TO_COLUMN[k] || k

const bodySchema = (required = []) => ({
  type: 'object',
  ...(required.length && { required }),
  properties: {
    productId:     { type: 'string', format: 'uuid' },
    variantType:   { type: 'string', enum: VALID_TYPES },
    value:         { type: 'string', minLength: 1, maxLength: 100 },
    priceModifier: { type: 'number' },
    sku:           { type: 'string', maxLength: 100 },
    stockStatus:   { type: 'string', enum: VALID_STOCK },
    imageUrl:      { type: 'string', maxLength: 2048 },
    sortOrder:     { type: 'integer', minimum: 0 },
    isDefault:     { type: 'boolean' }
  },
  additionalProperties: false
})

export default async function adminProductVariantRoutes(fastify, _options) {
  const { sql, redis } = fastify

  fastify.addHook('onRequest', adminAuth)

  const bustProductCache = async (productId) => {
    await Promise.all([
      redis.del(`product:${productId}`),
      redis.del(`variants:${productId}`)
    ])
  }

  // ── List variants for a product ───────────────────────────────────────────
  // GET /api/admin/variants?productId=<uuid>

  fastify.get('/', async (request, reply) => {
    const { productId } = request.query
    if (!productId || !UUID_RE.test(productId)) {
      reply.code(400)
      return { error: 'productId (uuid) is required' }
    }

    const variants = await sql`
      select * from product_variants
      where product_id = ${productId}
      order by variant_type, sort_order, value
    `
    return { data: variants }
  })

  // ── Create ────────────────────────────────────────────────────────────────

  fastify.post('/', { schema: { body: bodySchema(['productId', 'variantType', 'value']) } },
  async (request, reply) => {
    const data = request.body

    if (!UUID_RE.test(data.productId)) {
      reply.code(400)
      return { error: 'Invalid productId' }
    }

    const insertObj = Object.fromEntries(
      Object.keys(data).map(k => [toColumn(k), data[k]])
    )

    try {
      const variant = await sql.begin(async sql => {
        // Clear existing default for this type before inserting to avoid constraint violation
        if (data.isDefault) {
          await sql`
            update product_variants
            set is_default = false
            where product_id = ${data.productId} and variant_type = ${data.variantType}
          `
        }
        const [v] = await sql`insert into product_variants ${sql(insertObj)} returning *`
        return v
      })
      await bustProductCache(data.productId)
      reply.code(201)
      return variant
    } catch (err) {
      if (err.code === '23505') {
        reply.code(409)
        return { error: 'Variant already exists for this product/type/value' }
      }
      if (err.code === '23503') {
        reply.code(404)
        return { error: 'Product not found' }
      }
      throw err
    }
  })

  // ── Bulk upsert (replace all variants for a product) ─────────────────────

  fastify.put('/bulk', {
    schema: {
      body: {
        type: 'object',
        required: ['productId', 'variants'],
        properties: {
          productId: { type: 'string', format: 'uuid' },
          variants:  { type: 'array', items: bodySchema(['variantType', 'value']) }
        },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { productId, variants } = request.body

    if (!UUID_RE.test(productId)) {
      reply.code(400)
      return { error: 'Invalid productId' }
    }

    let saved
    try {
      saved = await sql.begin(async sql => {
        // Verify product exists before deleting existing variants
        const [product] = await sql`select id from products where id = ${productId}`
        if (!product) throw Object.assign(new Error('Product not found'), { isNotFound: true })

        await sql`delete from product_variants where product_id = ${productId}`
        if (!variants.length) return []

        const rows = variants.map(v => ({
          product_id:     productId,
          variant_type:   v.variantType,
          value:          v.value,
          price_modifier: v.priceModifier ?? 0,
          sku:            v.sku ?? null,
          stock_status:   v.stockStatus ?? 'in_stock',
          image_url:      v.imageUrl ?? null,
          sort_order:     v.sortOrder ?? 0,
          is_default:     v.isDefault ?? false
        }))
        return await sql`insert into product_variants ${sql(rows)} returning *`
      })
    } catch (err) {
      if (err.isNotFound) {
        reply.code(404)
        return { error: 'Product not found' }
      }
      if (err.code === '23503') {
        reply.code(404)
        return { error: 'Product not found' }
      }
      if (err.code === '23505') {
        reply.code(409)
        return { error: 'Duplicate variant type/value combination' }
      }
      throw err
    }

    await bustProductCache(productId)
    return { data: saved }
  })

  // ── Update ────────────────────────────────────────────────────────────────

  fastify.patch('/:id', { schema: { body: bodySchema() } }, async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Variant not found' }
    }

    const data = request.body
    const updateObj = Object.fromEntries(
      Object.keys(data).map(k => [toColumn(k), data[k]])
    )

    if (!Object.keys(updateObj).length) {
      const [v] = await sql`select * from product_variants where id = ${id}`
      if (!v) {
        reply.code(404)
        return { error: 'Variant not found' }
      }
      return v
    }

    let variant, oldProductId
    try {
      const result = await sql.begin(async sql => {
        const [existing] = await sql`select product_id, variant_type, is_default from product_variants where id = ${id}`
        if (!existing) throw Object.assign(new Error('Variant not found'), { isNotFound: true })

        const effectivePid  = updateObj.product_id   ?? existing.productId
        const effectiveType = updateObj.variant_type ?? existing.variantType
        const willBeDefault = updateObj.is_default   ?? existing.isDefault

        if (willBeDefault) {
          await sql`
            update product_variants set is_default = false
            where product_id = ${effectivePid}
              and variant_type = ${effectiveType}
              and id <> ${id}
          `
        }

        const [v] = await sql`
          update product_variants set ${sql(updateObj)} where id = ${id} returning *
        `
        if (!v) throw Object.assign(new Error('Variant not found'), { isNotFound: true })
        return { variant: v, prevProductId: existing.productId }
      })
      variant      = result.variant
      oldProductId = result.prevProductId
    } catch (err) {
      if (err.isNotFound) {
        reply.code(404)
        return { error: 'Variant not found' }
      }
      if (err.code === '23503') {
        reply.code(404)
        return { error: 'Product not found' }
      }
      if (err.code === '23505') {
        reply.code(409)
        return { error: 'Duplicate variant type/value combination' }
      }
      throw err
    }

    // Bust cache for new productId; also evict old if the variant moved products
    await bustProductCache(variant.productId)
    if (oldProductId !== variant.productId) await bustProductCache(oldProductId)
    return variant
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) {
      reply.code(404)
      return { error: 'Variant not found' }
    }

    const [v] = await sql`select product_id from product_variants where id = ${id}`
    if (!v) {
      reply.code(404)
      return { error: 'Variant not found' }
    }

    await sql`delete from product_variants where id = ${id}`
    await bustProductCache(v.productId)
    reply.code(204)
  })
}

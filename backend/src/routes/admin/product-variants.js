import { adminAuth } from '../../middleware/adminAuth.js'
import { UUID_RE } from '../../utils/constants.js'

const VALID_TYPES   = ['size', 'color', 'material', 'style', 'pack_size']
const VALID_STOCK   = ['in_stock', 'low_stock', 'out_of_stock']
const WRITABLE      = ['product_id', 'variant_type', 'value', 'price_modifier',
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
      reply.code(400); return { error: 'productId (uuid) is required' }
    }

    const variants = await sql`
      select * from product_variants
      where product_id = ${productId}
      order by variant_type, sort_order, value
    `
    return { variants }
  })

  // ── Create ────────────────────────────────────────────────────────────────

  fastify.post('/', { schema: { body: bodySchema(['productId', 'variantType', 'value']) } },
  async (request, reply) => {
    const data = request.body

    if (!UUID_RE.test(data.productId)) {
      reply.code(400); return { error: 'Invalid productId' }
    }

    const insertObj = Object.fromEntries(
      Object.keys(data).map(k => [toColumn(k), data[k]])
    )

    // If this variant is being set as default, clear existing default for that type
    if (data.isDefault) {
      await sql`
        update product_variants
        set is_default = false
        where product_id = ${data.productId} and variant_type = ${data.variantType}
      `
    }

    try {
      const [variant] = await sql`insert into product_variants ${sql(insertObj)} returning *`
      await bustProductCache(data.productId)
      reply.code(201)
      return variant
    } catch (err) {
      if (err.code === '23505') { reply.code(409); return { error: 'Variant already exists for this product/type/value' } }
      if (err.code === '23503') { reply.code(404); return { error: 'Product not found' } }
      throw err
    }
  })

  // ── Bulk upsert (replace all variants for a product) ─────────────────────
  // Useful for initial import and admin panel batch saves.

  fastify.put('/bulk', {
    schema: {
      body: {
        type: 'object',
        required: ['productId', 'variants'],
        properties: {
          productId: { type: 'string', format: 'uuid' },
          variants:  {
            type: 'array',
            items: bodySchema(['variantType', 'value'])
          }
        },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { productId, variants } = request.body

    if (!UUID_RE.test(productId)) {
      reply.code(400); return { error: 'Invalid productId' }
    }

    // Run in an implicit transaction (postgres-js wraps array in a transaction)
    await sql`delete from product_variants where product_id = ${productId}`

    let saved = []
    if (variants.length) {
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
      saved = await sql`insert into product_variants ${sql(rows)} returning *`
    }

    await bustProductCache(productId)
    return { variants: saved }
  })

  // ── Update ────────────────────────────────────────────────────────────────

  fastify.patch('/:id', { schema: { body: bodySchema() } }, async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'Variant not found' } }

    const data = request.body

    // If making this the default, clear others first
    if (data.isDefault) {
      const [existing] = await sql`select product_id, variant_type from product_variants where id = ${id}`
      if (existing) {
        await sql`
          update product_variants set is_default = false
          where product_id = ${existing.productId} and variant_type = ${existing.variantType} and id <> ${id}
        `
      }
    }

    const updateObj = Object.fromEntries(
      Object.keys(data).map(k => [toColumn(k), data[k]])
    )

    if (!Object.keys(updateObj).length) {
      const [v] = await sql`select * from product_variants where id = ${id}`
      if (!v) { reply.code(404); return { error: 'Variant not found' } }
      return v
    }

    const [variant] = await sql`
      update product_variants set ${sql(updateObj)} where id = ${id} returning *
    `
    if (!variant) { reply.code(404); return { error: 'Variant not found' } }

    await bustProductCache(variant.productId)
    return variant
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'Variant not found' } }

    const [v] = await sql`select product_id from product_variants where id = ${id}`
    if (!v) { reply.code(404); return { error: 'Variant not found' } }

    await sql`delete from product_variants where id = ${id}`
    await bustProductCache(v.productId)
    reply.code(204)
  })
}

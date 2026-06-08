import { describe, it, expect, vi } from 'vitest'
import { attachRelations } from '../src/utils/relations.js'

// postgres-js sql() is called two ways:
//   1. Tagged template: sql`select ...` — strings is a TemplateStringsArray (has .raw)
//   2. Value helper:   sql(array)       — used to build IN-list params; we just pass it through
//
// We distinguish by checking for the .raw property that TemplateStringsArray always has.
function makeSql(handlers = {}) {
  return vi.fn((strings, ...values) => {
    const isTaggedTemplate = strings != null && typeof strings === 'object' && 'raw' in strings
    if (!isTaggedTemplate) {
      // Regular call — sql(array) for parameterization; return array as-is
      return strings
    }
    // Tagged template — look at the first text segment to route to the right handler
    const key = String(strings[0]).replace(/\s+/g, ' ').trim().toLowerCase()
    for (const [pattern, result] of Object.entries(handlers)) {
      if (key.includes(pattern.toLowerCase())) return Promise.resolve(result)
    }
    return Promise.resolve([])
  })
}

const makeProduct = (overrides = {}) => ({ id: 'p1', categoryId: 'c1', ...overrides })

describe('attachRelations', () => {
  it('returns empty array immediately when no products provided', async () => {
    const sql = makeSql()
    const result = await attachRelations(sql, [])
    expect(result).toEqual([])
    expect(sql).not.toHaveBeenCalled()
  })

  it('attaches empty affiliateLinks and zero review count when none exist', async () => {
    const sql = makeSql()
    const result = await attachRelations(sql, [makeProduct()])
    expect(result[0].affiliateLinks).toEqual([])
    expect(result[0]._count.reviews).toBe(0)
    expect(result[0].category).toBeNull()
  })

  it('attaches category when categoryId matches', async () => {
    const category = { id: 'c1', name: 'Swords' }
    const sql = makeSql({ 'from categories': [category] })
    const result = await attachRelations(sql, [makeProduct()])
    expect(result[0].category).toEqual(category)
  })

  it('handles products with no categoryId (skips category query)', async () => {
    const sql = makeSql()
    const result = await attachRelations(sql, [makeProduct({ categoryId: null })])
    expect(result[0].category).toBeNull()
    // categories query should NOT have been called with any ids
    const calls = sql.mock.calls.filter(([s]) => s != null && 'raw' in s && String(s[0]).includes('from categories'))
    expect(calls).toHaveLength(0)
  })

  it('groups multiple affiliate links by product', async () => {
    const links = [
      { productId: 'p1', id: 'al1' },
      { productId: 'p1', id: 'al2' },
    ]
    const sql = makeSql({ 'from affiliate_links': links })
    const result = await attachRelations(sql, [makeProduct()])
    expect(result[0].affiliateLinks).toHaveLength(2)
  })

  it('attaches review count for each product', async () => {
    const sql = makeSql({ 'from reviews': [{ productId: 'p1', count: 5 }] })
    const result = await attachRelations(sql, [makeProduct()])
    expect(result[0]._count.reviews).toBe(5)
  })

  it('latestLinkOnly uses distinct-on query path', async () => {
    let usedDistinct = false
    const sql = vi.fn((strings, ...values) => {
      const isTaggedTemplate = strings != null && typeof strings === 'object' && 'raw' in strings
      if (!isTaggedTemplate) return strings
      const q = String(strings[0]).toLowerCase()
      if (q.includes('distinct on')) usedDistinct = true
      return Promise.resolve([])
    })
    await attachRelations(sql, [makeProduct()], { latestLinkOnly: true })
    expect(usedDistinct).toBe(true)
  })

  it('handles multiple products with different categories', async () => {
    const cats = [{ id: 'c1', name: 'Swords' }, { id: 'c2', name: 'Shields' }]
    const sql = makeSql({ 'from categories': cats })
    const products = [makeProduct({ id: 'p1', categoryId: 'c1' }), makeProduct({ id: 'p2', categoryId: 'c2' })]
    const result = await attachRelations(sql, products)
    expect(result[0].category?.name).toBe('Swords')
    expect(result[1].category?.name).toBe('Shields')
  })
})

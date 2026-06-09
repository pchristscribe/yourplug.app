import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSupabaseProducts } from '../app/composables/useSupabaseProducts'

// Chainable Supabase client mock — each method returns mockChain so the fluent
// builder resolves; range() resolves the promise so searchProducts() can await.
type MockChain = Record<string, ReturnType<typeof vi.fn>>
const mockChain: MockChain = {} as MockChain
mockChain.select = vi.fn(() => mockChain)
mockChain.eq = vi.fn(() => mockChain)
mockChain.or = vi.fn(() => mockChain)
mockChain.order = vi.fn(() => mockChain)
mockChain.range = vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))

vi.stubGlobal('useSupabaseClient', () => ({ from: () => mockChain }))

function lastOrArg(): string {
  const call = mockChain.or.mock.lastCall
  return call ? (call[0] as string) : ''
}

describe('useSupabaseProducts – searchProducts sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore return values cleared by clearAllMocks
    mockChain.select.mockReturnValue(mockChain)
    mockChain.eq.mockReturnValue(mockChain)
    mockChain.or.mockReturnValue(mockChain)
    mockChain.order.mockReturnValue(mockChain)
    mockChain.range.mockResolvedValue({ data: [], error: null, count: 0 })
  })

  it('passes a normal query through unchanged', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('sword fighter')
    expect(lastOrArg()).toBe(
      'title.ilike.%sword fighter%,description.ilike.%sword fighter%'
    )
  })

  it('escapes % LIKE wildcard so it is treated as a literal percent', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('%foo%')
    expect(lastOrArg()).toContain('ilike.%\\%foo\\%%')
  })

  it('escapes _ LIKE wildcard so it is treated as a literal underscore', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('_abc')
    expect(lastOrArg()).toContain('ilike.%\\_abc%')
  })

  it('escapes backslash escape character', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('foo\\bar')
    expect(lastOrArg()).toContain('ilike.%foo\\\\bar%')
  })

  it('strips PostgREST comma OR-clause separator', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('title,description')
    expect(lastOrArg()).toContain('ilike.%title description%')
  })

  it('strips PostgREST parentheses for nested groups', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('(evil)')
    expect(lastOrArg()).toContain('ilike.% evil %')
  })

  it('handles a query of only special chars without throwing', async () => {
    const { searchProducts } = useSupabaseProducts()
    await expect(searchProducts('%_\\,()')).resolves.toBeDefined()
    expect(mockChain.or).toHaveBeenCalled()
  })

  it('handles empty string without throwing', async () => {
    const { searchProducts } = useSupabaseProducts()
    await expect(searchProducts('')).resolves.toBeDefined()
    expect(lastOrArg()).toBe('title.ilike.%%,description.ilike.%%')
  })

  it('strips single-quote injection attempt', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts("O'Reilly")
    // Single quotes are stripped by the sanitization
    expect(lastOrArg()).toContain("ilike.%OReilly%")
  })

  it('strips double-quote injection attempt', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('say "hello"')
    expect(lastOrArg()).toContain('ilike.%say hello%')
  })

  it('returns pagination metadata from searchProducts', async () => {
    mockChain.range.mockResolvedValueOnce({ data: [], error: null, count: 42 })
    const { searchProducts } = useSupabaseProducts()
    const result = await searchProducts('query', { page: 2, limit: 10 })
    expect(result.pagination.total).toBe(42)
    expect(result.pagination.page).toBe(2)
    expect(result.pagination.limit).toBe(10)
    expect(result.pagination.pages).toBe(5)
  })

  it('propagates Supabase errors thrown by searchProducts', async () => {
    mockChain.range.mockResolvedValueOnce({ data: null, error: { message: 'DB error' }, count: null })
    const { searchProducts } = useSupabaseProducts()
    await expect(searchProducts('any')).rejects.toThrow('DB error')
  })

  it('filters products by ACTIVE status in searchProducts', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('test')
    // eq should be called with 'status', 'ACTIVE'
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'ACTIVE')
  })

  it('orders search results by created_at descending', async () => {
    const { searchProducts } = useSupabaseProducts()
    await searchProducts('test')
    expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('useSupabaseProducts – getProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChain.select = vi.fn(() => mockChain)
    mockChain.eq = vi.fn(() => mockChain)
    mockChain.or = vi.fn(() => mockChain)
    mockChain.order = vi.fn(() => mockChain)
    mockChain.range = vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
    // Add missing methods for getProducts filter chain
    ;(mockChain as MockChain).gte = vi.fn(() => mockChain)
    ;(mockChain as MockChain).lte = vi.fn(() => mockChain)
    ;(mockChain as MockChain).contains = vi.fn(() => mockChain)
  })

  it('defaults to page 1 and limit 20', async () => {
    const { getProducts } = useSupabaseProducts()
    await getProducts()
    // range(0, 19) corresponds to page=1, limit=20
    expect(mockChain.range).toHaveBeenCalledWith(0, 19)
  })

  it('calculates correct range for page 2 with limit 10', async () => {
    const { getProducts } = useSupabaseProducts()
    await getProducts({ page: 2, limit: 10 })
    expect(mockChain.range).toHaveBeenCalledWith(10, 19)
  })

  it('returns an empty products array and zero-total pagination when no data', async () => {
    const { getProducts } = useSupabaseProducts()
    const result = await getProducts()
    expect(result.products).toEqual([])
    expect(result.pagination.total).toBe(0)
    expect(result.pagination.pages).toBe(0)
  })

  it('propagates Supabase errors', async () => {
    mockChain.range.mockResolvedValueOnce({ data: null, error: { message: 'Query failed' }, count: null })
    const { getProducts } = useSupabaseProducts()
    await expect(getProducts()).rejects.toThrow('Query failed')
  })

  it('defaults to ACTIVE status filter when no status filter provided', async () => {
    const { getProducts } = useSupabaseProducts()
    await getProducts()
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'ACTIVE')
  })

  it('uses provided status filter when status is specified', async () => {
    const { getProducts } = useSupabaseProducts()
    await getProducts({ status: 'INACTIVE' })
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'INACTIVE')
  })
})

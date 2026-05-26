import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSupabaseProducts } from '../app/composables/useSupabaseProducts'

// Chainable Supabase client mock — each method returns mockChain so the fluent
// builder resolves; range() resolves the promise so searchProducts() can await.
const mockChain: Record<string, any> = {}
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
})

import { describe, it, expect } from 'vitest'
import {
  formatSearchResults,
  formatProduct,
  formatProductComparison,
  formatCount,
  truncateResponse,
  toMarkdown,
  toJSON,
} from '../src/utils/formatters.js'
import type { Product, SearchResult } from '../src/types.js'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Rainbow Pride Flag',
    price: 12.99,
    currency: 'USD',
    rating: 4.5,
    reviewCount: 120,
    imageUrl: 'https://example.com/flag.jpg',
    productUrl: 'https://dhgate.com/product/p1',
    shipping: { free: true },
    seller: { name: 'Pride Store', rating: 98 },
    ...overrides,
  }
}

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    totalResults: 1,
    page: 1,
    products: [makeProduct()],
    hasMore: false,
    ...overrides,
  }
}

describe('formatCount', () => {
  it('leaves small counts as-is', () => {
    expect(formatCount(42)).toBe('42')
  })

  it('formats thousands with a K suffix', () => {
    expect(formatCount(1500)).toBe('1.5K')
  })

  it('formats millions with an M suffix', () => {
    expect(formatCount(2500000)).toBe('2.5M')
  })

  it('handles the exact 1000 boundary', () => {
    expect(formatCount(1000)).toBe('1.0K')
  })
})

describe('truncateResponse', () => {
  it('leaves short responses unchanged', () => {
    expect(truncateResponse('short')).toBe('short')
  })

  it('truncates and appends a notice when over the character limit', () => {
    const long = 'x'.repeat(30000)
    const result = truncateResponse(long)
    expect(result.length).toBeLessThan(long.length)
    expect(result).toContain('Response truncated due to length')
  })
})

describe('formatSearchResults', () => {
  it('concise format includes count, price, rating, and shipping', () => {
    const result = formatSearchResults(makeSearchResult(), 'concise')
    expect(result).toContain('Found 1 products (page 1)')
    expect(result).toContain('Rainbow Pride Flag')
    expect(result).toContain('$12.99 USD')
    expect(result).toContain('🚚 Free shipping')
  })

  it('concise format shows paid shipping when not free', () => {
    const result = formatSearchResults(
      makeSearchResult({ products: [makeProduct({ shipping: { free: false } })] }),
      'concise'
    )
    expect(result).toContain('📦 Paid shipping')
  })

  it('concise format appends a pagination hint when hasMore is true', () => {
    const result = formatSearchResults(makeSearchResult({ hasMore: true }), 'concise')
    expect(result).toContain('More results available')
  })

  it('concise format omits the pagination hint when hasMore is false', () => {
    const result = formatSearchResults(makeSearchResult({ hasMore: false }), 'concise')
    expect(result).not.toContain('More results available')
  })

  it('detailed format returns valid JSON matching the input', () => {
    const searchResult = makeSearchResult()
    const result = formatSearchResults(searchResult, 'detailed')
    expect(JSON.parse(result)).toEqual(searchResult)
  })
})

describe('formatProduct', () => {
  it('concise format includes title, price, rating, and seller', () => {
    const result = formatProduct(makeProduct(), 'concise')
    expect(result).toContain('Rainbow Pride Flag')
    expect(result).toContain('$12.99 USD')
    expect(result).toContain('Pride Store')
    expect(result).toContain('98%')
  })

  it('concise format shows estimated delivery days when shipping is not free', () => {
    const result = formatProduct(
      makeProduct({ shipping: { free: false, estimatedDays: '7-10' } }),
      'concise'
    )
    expect(result).toContain('7-10 days')
  })

  it('detailed format returns valid JSON matching the input', () => {
    const product = makeProduct()
    const result = formatProduct(product, 'detailed')
    expect(JSON.parse(result)).toEqual(product)
  })
})

describe('formatProductComparison', () => {
  it('renders a markdown table with one row per product', () => {
    const products = [makeProduct({ id: 'a', title: 'A' }), makeProduct({ id: 'b', title: 'B', shipping: { free: false } })]
    const result = formatProductComparison(products)
    expect(result).toContain('Comparing 2 products')
    expect(result).toContain('| A |')
    expect(result).toContain('| B |')
    expect(result).toContain('✅ Free')
    expect(result).toContain('❌ Paid')
  })

  it('truncates long titles to 30 characters with an ellipsis', () => {
    const longTitle = 'A'.repeat(50)
    const result = formatProductComparison([makeProduct({ title: longTitle })])
    expect(result).toContain('A'.repeat(27) + '...')
    expect(result).not.toContain(longTitle)
  })
})

describe('toMarkdown / toJSON', () => {
  it('toMarkdown passes content through unchanged', () => {
    expect(toMarkdown('# Title')).toBe('# Title')
  })

  it('toJSON pretty-prints arbitrary data', () => {
    expect(toJSON({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2))
  })
})

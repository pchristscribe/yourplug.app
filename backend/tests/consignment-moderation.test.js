import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {
      this.messages = { create: mockCreate }
    }
  },
}))

vi.mock('exif-reader', () => ({ read: vi.fn(() => null) }))

const mockSql = (rows = []) => {
  const fn = vi.fn(() => Promise.resolve(rows))
  fn.json = vi.fn(v => v)
  return fn
}

describe('moderateListingText', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  it('returns APPROVED decision and logs result', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({ decision: 'APPROVED', reason: 'ok', flags: [] }) }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const sql = mockSql()
    const { moderateListingText } = await import('../src/lib/moderation.js')
    const result = await moderateListingText(sql, {
      id: 'listing-1',
      title: 'Rainbow jockstrap',
      description: 'Barely worn, great condition',
      category: 'UNDERWEAR',
      condition: 'LIKE_NEW',
      askingPrice: 15,
    })

    expect(result.decision).toBe('APPROVED')
    expect(result.reason).toBe('ok')
    expect(sql).toHaveBeenCalled()
  })

  it('returns REJECTED for disallowed content', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({ decision: 'REJECTED', reason: 'illegal item', flags: ['illegal'] }) }],
      usage: { input_tokens: 80, output_tokens: 30 },
    })

    const sql = mockSql()
    const { moderateListingText } = await import('../src/lib/moderation.js')
    const result = await moderateListingText(sql, {
      id: 'listing-2',
      title: 'Contraband',
      description: '',
      category: 'OTHER',
      condition: 'GOOD',
      askingPrice: 9.99,
    })

    expect(result.decision).toBe('REJECTED')
    expect(result.flags).toContain('illegal')
  })

  it('returns FLAGGED for borderline content', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({ decision: 'FLAGGED', reason: 'borderline', flags: [] }) }],
      usage: { input_tokens: 90, output_tokens: 40 },
    })

    const sql = mockSql()
    const { moderateListingText } = await import('../src/lib/moderation.js')
    const result = await moderateListingText(sql, {
      id: 'listing-3',
      title: 'Borderline item',
      description: 'Needs human review',
      category: 'OTHER',
      condition: 'FAIR',
      askingPrice: 5,
    })

    expect(result.decision).toBe('FLAGGED')
  })

  it('handles malformed JSON response by returning FLAGGED', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'not valid json at all' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    const sql = mockSql()
    const { moderateListingText } = await import('../src/lib/moderation.js')
    const result = await moderateListingText(sql, {
      id: 'listing-4',
      title: 'Test',
      description: '',
      category: 'OTHER',
      condition: 'NEW',
      askingPrice: 1,
    })

    expect(result.decision).toBe('FLAGGED')
  })
})

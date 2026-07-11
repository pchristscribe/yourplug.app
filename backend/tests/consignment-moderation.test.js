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

  it('handles malformed JSON response by returning FLAGGED with parse-error reason and empty flags', async () => {
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
    expect(result.reason).toBe('Moderation response parse error')
    expect(result.flags).toEqual([])
  })

  it('propagates Anthropic API failures (network/API error) to the caller', async () => {
    mockCreate.mockRejectedValue(new Error('529 overloaded'))

    const sql = mockSql()
    const { moderateListingText } = await import('../src/lib/moderation.js')
    await expect(moderateListingText(sql, {
      id: 'listing-5',
      title: 'Test',
      description: '',
      category: 'OTHER',
      condition: 'NEW',
      askingPrice: 1,
    })).rejects.toThrow('529 overloaded')

    // Nothing should be logged to the moderation ledger on transport failure
    expect(sql).not.toHaveBeenCalled()
  })
})

describe('runFullModeration failure recovery', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  it('flags the listing for human review when moderation throws', async () => {
    mockCreate.mockRejectedValue(new Error('API down'))

    const calls = []
    // Tagged-template mock: first call returns the listing, second the images,
    // subsequent calls (the recovery update) are recorded.
    let call = 0
    const sql = vi.fn((strings, ...values) => {
      calls.push({ text: Array.isArray(strings) ? strings.join('?') : String(strings), values })
      call += 1
      if (call === 1) return Promise.resolve([{ id: 'l1', title: 't', description: '', category: 'OTHER', condition: 'NEW', askingPrice: 1 }])
      if (call === 2) return Promise.resolve([])
      return Promise.resolve([])
    })
    sql.json = vi.fn(v => v)

    const { runFullModeration } = await import('../src/lib/moderation.js')
    await expect(runFullModeration(sql, 'l1')).rejects.toThrow('API down')

    // The recovery write must set FLAGGED with a Moderation error reason
    const recovery = calls.find(c => c.text.includes('moderation_status') && c.values.some(v => typeof v === 'string' && v.startsWith('Moderation error:')))
    expect(recovery).toBeTruthy()
  })
})

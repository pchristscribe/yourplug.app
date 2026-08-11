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

// Query-aware tagged-template mock for the multi-step moderation pipeline.
function pipelineSql({ listing, images = [] }) {
  const sql = vi.fn((strings) => {
    const q = Array.isArray(strings) ? strings.join(' ') : String(strings)
    if (q.includes('select') && q.includes('from consignment_listings')) return Promise.resolve(listing ? [listing] : [])
    if (q.includes('select') && q.includes('from consignment_images')) return Promise.resolve(images)
    return Promise.resolve([])
  })
  sql.json = v => v
  return sql
}

describe('moderateImage', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  it('returns APPROVED and marks the image as passing', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({ decision: 'APPROVED', reason: 'ok', isStockPhoto: false, matchesDescription: true }) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const updates = []
    const sql = vi.fn((strings, ...values) => {
      const q = Array.isArray(strings) ? strings.join(' ') : String(strings)
      if (q.includes('update consignment_images')) updates.push(values)
      return Promise.resolve([])
    })
    sql.json = v => v

    const { moderateImage } = await import('../src/lib/moderation.js')
    const result = await moderateImage(sql, { id: 'i1', listingId: 'l1', publicUrl: 'https://img.test/1.jpg' }, { title: 'T', category: 'TOY' })
    expect(result.decision).toBe('APPROVED')
    expect(updates.length).toBe(1)
    expect(updates[0][0]).toBe(true) // moderation_passed
  })

  it('flags an image when the model returns malformed JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'not json' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const sql = pipelineSql({})
    const { moderateImage } = await import('../src/lib/moderation.js')
    const result = await moderateImage(sql, { id: 'i1', listingId: 'l1', publicUrl: 'https://img.test/1.jpg' }, { title: 'T', category: 'TOY' })
    expect(result.decision).toBe('FLAGGED')
    expect(result.reason).toMatch(/parse error/i)
  })
})

describe('runFullModeration success paths', () => {
  const listing = { id: 'l1', title: 't', description: '', category: 'OTHER', condition: 'NEW', askingPrice: 1 }

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  it('APPROVES when text and every image pass', async () => {
    mockCreate
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'APPROVED', reason: 'ok', flags: [] }) }], usage: { input_tokens: 1, output_tokens: 1 } })
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'APPROVED', reason: 'ok', isStockPhoto: false, matchesDescription: true }) }], usage: { input_tokens: 1, output_tokens: 1 } })

    const sql = pipelineSql({ listing, images: [{ id: 'i1', listingId: 'l1', publicUrl: 'https://img.test/1.jpg' }] })
    const { runFullModeration } = await import('../src/lib/moderation.js')
    const out = await runFullModeration(sql, 'l1')
    expect(out.decision).toBe('APPROVED')
  })

  it('REJECTS when the text check rejects', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'REJECTED', reason: 'counterfeit', flags: [] }) }], usage: { input_tokens: 1, output_tokens: 1 } })
    const sql = pipelineSql({ listing, images: [] })
    const { runFullModeration } = await import('../src/lib/moderation.js')
    const out = await runFullModeration(sql, 'l1')
    expect(out.decision).toBe('REJECTED')
    expect(out.reason).toBe('counterfeit')
  })

  it('FLAGS a borderline listing for human review', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'FLAGGED', reason: 'needs review', flags: [] }) }], usage: { input_tokens: 1, output_tokens: 1 } })
    const sql = pipelineSql({ listing, images: [] })
    const { runFullModeration } = await import('../src/lib/moderation.js')
    const out = await runFullModeration(sql, 'l1')
    expect(out.decision).toBe('FLAGGED')
  })

  it('throws when the listing does not exist', async () => {
    const sql = pipelineSql({ listing: null })
    const { runFullModeration } = await import('../src/lib/moderation.js')
    await expect(runFullModeration(sql, 'missing')).rejects.toThrow(/not found/i)
  })

  it('REJECTS when the text passes but an image is rejected', async () => {
    mockCreate
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'APPROVED', reason: 'ok', flags: [] }) }], usage: { input_tokens: 1, output_tokens: 1 } })
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'REJECTED', reason: 'stock photo', isStockPhoto: true, matchesDescription: false }) }], usage: { input_tokens: 1, output_tokens: 1 } })
    const sql = pipelineSql({ listing, images: [{ id: 'i1', listingId: 'l1', publicUrl: 'https://img.test/1.jpg' }] })
    const { runFullModeration } = await import('../src/lib/moderation.js')
    const out = await runFullModeration(sql, 'l1')
    expect(out.decision).toBe('REJECTED')
    expect(out.reason).toBe('stock photo')
  })

  it('FLAGS when the text passes but an image is flagged', async () => {
    mockCreate
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'APPROVED', reason: 'ok', flags: [] }) }], usage: { input_tokens: 1, output_tokens: 1 } })
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify({ decision: 'FLAGGED', reason: 'blurry', isStockPhoto: false, matchesDescription: true }) }], usage: { input_tokens: 1, output_tokens: 1 } })
    const sql = pipelineSql({ listing, images: [{ id: 'i1', listingId: 'l1', publicUrl: 'https://img.test/1.jpg' }] })
    const { runFullModeration } = await import('../src/lib/moderation.js')
    const out = await runFullModeration(sql, 'l1')
    expect(out.decision).toBe('FLAGGED')
    expect(out.reason).toBe('blurry')
  })
})

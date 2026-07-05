import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn()
  return { default: vi.fn(() => ({ messages: { create } })) }
})

vi.mock('exif-reader', () => ({ read: vi.fn(() => null) }))

const mockSql = (rows = []) => {
  const fn = vi.fn(() => Promise.resolve(rows))
  fn.json = vi.fn(v => v)
  return fn
}

async function importMod() {
  const mod = await import('../src/lib/moderation.js')
  return mod
}

describe('moderateListingText', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    vi.resetModules()
  })

  it('returns APPROVED decision and logs result', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    Anthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ decision: 'APPROVED', reason: 'ok', flags: [] }) }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      },
    }))

    const calls = []
    const sql = vi.fn((...args) => {
      calls.push(args)
      return Promise.resolve([])
    })
    sql.json = vi.fn(v => v)

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
    vi.resetModules()
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    Anthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ decision: 'REJECTED', reason: 'illegal item', flags: ['illegal'] }) }],
          usage: { input_tokens: 80, output_tokens: 30 },
        }),
      },
    }))

    const sql = vi.fn(() => Promise.resolve([]))
    sql.json = vi.fn(v => v)

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
    vi.resetModules()
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    Anthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ decision: 'FLAGGED', reason: 'borderline', flags: [] }) }],
          usage: { input_tokens: 90, output_tokens: 40 },
        }),
      },
    }))

    const sql = vi.fn(() => Promise.resolve([]))
    sql.json = vi.fn(v => v)

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
    vi.resetModules()
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    Anthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: 'not valid json at all' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      },
    }))

    const sql = vi.fn(() => Promise.resolve([]))
    sql.json = vi.fn(v => v)

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

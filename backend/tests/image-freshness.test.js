import { describe, it, expect } from 'vitest'

// Isolated freshness logic test — extracted from the route handler
const FRESHNESS_LIMIT_SEC = 900

function checkFreshness(capturedAt) {
  if (!capturedAt) return { freshnessOk: null, freshnessDeltaSec: null, tooOld: false }
  const freshnessDeltaSec = Math.round((Date.now() - capturedAt.getTime()) / 1000)
  return {
    freshnessOk: freshnessDeltaSec <= FRESHNESS_LIMIT_SEC,
    freshnessDeltaSec,
    tooOld: freshnessDeltaSec > FRESHNESS_LIMIT_SEC,
  }
}

describe('image freshness', () => {
  it('accepts a fresh image taken 5 minutes ago', () => {
    const capturedAt = new Date(Date.now() - 5 * 60 * 1000)
    const result = checkFreshness(capturedAt)
    expect(result.freshnessOk).toBe(true)
    expect(result.tooOld).toBe(false)
    expect(result.freshnessDeltaSec).toBeLessThanOrEqual(FRESHNESS_LIMIT_SEC)
  })

  it('rejects a stale image taken 20 minutes ago', () => {
    const capturedAt = new Date(Date.now() - 20 * 60 * 1000)
    const result = checkFreshness(capturedAt)
    expect(result.freshnessOk).toBe(false)
    expect(result.tooOld).toBe(true)
    expect(result.freshnessDeltaSec).toBeGreaterThan(FRESHNESS_LIMIT_SEC)
  })

  it('treats missing EXIF as null freshness and proceeds', () => {
    const result = checkFreshness(null)
    expect(result.freshnessOk).toBeNull()
    expect(result.freshnessDeltaSec).toBeNull()
    expect(result.tooOld).toBe(false)
  })

  it('accepts an image taken exactly at the boundary (900s)', () => {
    const capturedAt = new Date(Date.now() - 900 * 1000)
    const result = checkFreshness(capturedAt)
    expect(result.tooOld).toBe(false)
  })

  it('rejects an image taken 901 seconds ago', () => {
    const capturedAt = new Date(Date.now() - 901 * 1000)
    const result = checkFreshness(capturedAt)
    expect(result.tooOld).toBe(true)
  })
})

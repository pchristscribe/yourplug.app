import { describe, it, expect } from 'vitest'
// Test the REAL implementation the upload route uses — a reimplemented
// copy here would let regressions in the actual logic slip through.
import {
  checkFreshness,
  extractExifDate,
  extractExifSegment,
  FRESHNESS_LIMIT_SEC,
} from '../src/lib/imageFreshness.js'

describe('checkFreshness', () => {
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
    const now = Date.now()
    const capturedAt = new Date(now - FRESHNESS_LIMIT_SEC * 1000)
    const result = checkFreshness(capturedAt, now)
    expect(result.tooOld).toBe(false)
    expect(result.freshnessOk).toBe(true)
  })

  it('rejects an image taken 901 seconds ago', () => {
    const now = Date.now()
    const capturedAt = new Date(now - (FRESHNESS_LIMIT_SEC + 1) * 1000)
    const result = checkFreshness(capturedAt, now)
    expect(result.tooOld).toBe(true)
    expect(result.freshnessOk).toBe(false)
  })
})

describe('extractExifSegment', () => {
  it('returns null for a non-JPEG buffer', () => {
    expect(extractExifSegment(Buffer.from('not an image'))).toBeNull()
  })

  it('returns null for a JPEG with no APP1/EXIF segment', () => {
    // SOI + APP0 (JFIF stub) + SOS
    const jpeg = Buffer.concat([
      Buffer.from([0xFF, 0xD8]),
      Buffer.from([0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00]),
      Buffer.from([0xFF, 0xDA, 0x00, 0x02]),
    ])
    expect(extractExifSegment(jpeg)).toBeNull()
  })

  it('extracts the Exif payload from an APP1 segment', () => {
    const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from([0x49, 0x49, 0x2A, 0x00])])
    const app1 = Buffer.concat([
      Buffer.from([0xFF, 0xE1]),
      (() => { const b = Buffer.alloc(2); b.writeUInt16BE(exifPayload.length + 2); return b })(),
      exifPayload,
    ])
    const jpeg = Buffer.concat([Buffer.from([0xFF, 0xD8]), app1, Buffer.from([0xFF, 0xDA, 0x00, 0x02])])
    const segment = extractExifSegment(jpeg)
    expect(segment).not.toBeNull()
    expect(segment.subarray(0, 6).toString('latin1')).toBe('Exif\0\0')
  })
})

describe('extractExifDate', () => {
  it('returns null for buffers without EXIF', () => {
    expect(extractExifDate(Buffer.from('garbage'))).toBeNull()
    expect(extractExifDate(null)).toBeNull()
  })
})

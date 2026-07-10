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

  it('rejects images without a parseable timestamp (PNG/WebP bypass prevention)', () => {
    const result = checkFreshness(null)
    expect(result.freshnessOk).toBe(false)
    expect(result.freshnessDeltaSec).toBeNull()
    expect(result.tooOld).toBe(true)
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

// Builds a minimal little-endian TIFF/EXIF blob (the payload exif-reader
// expects, i.e. what extractExifSegment hands it) with an ExifIFD containing
// DateTimeOriginal and, optionally, OffsetTimeOriginal — both as ASCII tags.
function buildExifSegment({ dateTimeOriginal, offsetTimeOriginal }) {
  const IFD0_OFFSET = 8
  const IFD0_ENTRY_COUNT = 1
  const EXIF_IFD_OFFSET = IFD0_OFFSET + 2 + IFD0_ENTRY_COUNT * 12 + 4
  const exifEntryCount = offsetTimeOriginal ? 2 : 1
  let dataOffset = EXIF_IFD_OFFSET + 2 + exifEntryCount * 12 + 4

  const dateTimeStr = `${dateTimeOriginal}\0`
  const dateTimeOffset = dataOffset
  dataOffset += dateTimeStr.length

  let offsetStr, offsetOffset
  if (offsetTimeOriginal) {
    offsetStr = `${offsetTimeOriginal}\0`
    offsetOffset = dataOffset
    dataOffset += offsetStr.length
  }

  const buf = Buffer.alloc(dataOffset)
  buf.write('II', 0, 'latin1')
  buf.writeUInt16LE(42, 2)
  buf.writeUInt32LE(IFD0_OFFSET, 4)

  // IFD0: single entry pointing at the Exif SubIFD (tag 0x8769, type LONG)
  let p = IFD0_OFFSET
  buf.writeUInt16LE(IFD0_ENTRY_COUNT, p); p += 2
  buf.writeUInt16LE(0x8769, p); p += 2
  buf.writeUInt16LE(4, p); p += 2
  buf.writeUInt32LE(1, p); p += 4
  buf.writeUInt32LE(EXIF_IFD_OFFSET, p); p += 4
  buf.writeUInt32LE(0, p); p += 4 // no next IFD

  // Exif SubIFD entries (type 2 = ASCII)
  p = EXIF_IFD_OFFSET
  buf.writeUInt16LE(exifEntryCount, p); p += 2

  buf.writeUInt16LE(0x9003, p); p += 2 // DateTimeOriginal
  buf.writeUInt16LE(2, p); p += 2
  buf.writeUInt32LE(dateTimeStr.length, p); p += 4
  buf.writeUInt32LE(dateTimeOffset, p); p += 4

  if (offsetTimeOriginal) {
    buf.writeUInt16LE(0x9011, p); p += 2 // OffsetTimeOriginal
    buf.writeUInt16LE(2, p); p += 2
    buf.writeUInt32LE(offsetStr.length, p); p += 4
    buf.writeUInt32LE(offsetOffset, p); p += 4
  }
  buf.writeUInt32LE(0, p); p += 4 // no next IFD

  buf.write(dateTimeStr, dateTimeOffset, 'latin1')
  if (offsetTimeOriginal) buf.write(offsetStr, offsetOffset, 'latin1')

  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), buf])
}

function wrapInJpeg(exifSegment) {
  const lengthBuf = Buffer.alloc(2)
  lengthBuf.writeUInt16BE(exifSegment.length + 2)
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1]), lengthBuf, exifSegment])
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app1, Buffer.from([0xFF, 0xDA, 0x00, 0x02])])
}

describe('extractExifDate', () => {
  it('returns null for buffers without EXIF', () => {
    expect(extractExifDate(Buffer.from('garbage'))).toBeNull()
    expect(extractExifDate(null)).toBeNull()
  })

  it('parses DateTimeOriginal with no offset as server-local wall-clock time', () => {
    const jpeg = wrapInJpeg(buildExifSegment({ dateTimeOriginal: '2026:01:01 12:00:00' }))
    const result = extractExifDate(jpeg)
    expect(result).not.toBeNull()
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(1)
  })

  it('re-anchors DateTimeOriginal to the recorded OffsetTimeOriginal', () => {
    // No offset: parsed as local wall-clock 12:00:00.
    const noOffset = extractExifDate(wrapInJpeg(buildExifSegment({ dateTimeOriginal: '2026:01:01 12:00:00' })))
    // Same wall-clock time, but with a "-05:00" offset recorded — re-anchoring
    // shifts the resulting instant by exactly 5 hours relative to the no-offset parse.
    const withOffset = extractExifDate(
      wrapInJpeg(buildExifSegment({ dateTimeOriginal: '2026:01:01 12:00:00', offsetTimeOriginal: '-05:00' }))
    )
    expect(withOffset).not.toBeNull()
    // "-05:00" means the recorded local time is 5h behind UTC, so the
    // re-anchored instant is 5h *later* than the naive same-wall-clock parse.
    expect(withOffset.getTime() - noOffset.getTime()).toBe(5 * 60 * 60 * 1000)
  })
})

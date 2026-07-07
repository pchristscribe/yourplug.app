import { read as readExif } from 'exif-reader'

export const FRESHNESS_LIMIT_SEC = 900 // 15 minutes

/**
 * Extract the raw EXIF/TIFF segment from a JPEG buffer.
 * exif-reader does NOT accept a whole image file — it expects the APP1
 * payload beginning with the "Exif\0\0" header, so we walk the JPEG
 * markers to find it. Returns null for non-JPEG or EXIF-less images.
 */
export function extractExifSegment(buffer) {
  if (!buffer || buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return null // not a JPEG (SOI marker missing)
  }
  let pos = 2
  while (pos + 4 <= buffer.length) {
    if (buffer[pos] !== 0xFF) return null // corrupt marker stream
    const marker = buffer[pos + 1]
    if (marker === 0xDA) return null // start of scan — no APP1 found
    const size = buffer.readUInt16BE(pos + 2)
    if (marker === 0xE1) {
      const segment = buffer.subarray(pos + 4, pos + 2 + size)
      if (segment.subarray(0, 6).toString('latin1') === 'Exif\0\0') {
        return segment
      }
    }
    pos += 2 + size
  }
  return null
}

/**
 * Extract the capture timestamp from an image buffer, using
 * OffsetTimeOriginal when present so the value is timezone-unambiguous.
 * Returns a Date or null.
 */
export function extractExifDate(buffer) {
  try {
    const segment = extractExifSegment(buffer)
    if (!segment) return null
    const exif = readExif(segment)
    const raw = exif?.Photo?.DateTimeOriginal ?? exif?.Image?.DateTimeOriginal
    if (!raw) return null

    let d = raw instanceof Date ? raw : new Date(String(raw).replace(':', '-').replace(':', '-'))
    if (isNaN(d.getTime())) return null

    // EXIF DateTimeOriginal carries no timezone; exif-reader interprets it
    // in server-local time. If the camera recorded OffsetTimeOriginal
    // (e.g. "-05:00"), correct the parse to that offset.
    const offset = exif?.Photo?.OffsetTimeOriginal
    if (typeof offset === 'string') {
      const m = offset.match(/^([+-])(\d{2}):(\d{2})$/)
      if (m) {
        const offsetMin = (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10))
        // exif-reader parsed as UTC wall-clock; re-anchor to the stated offset
        d = new Date(d.getTime() - offsetMin * 60 * 1000)
      }
    }
    return d
  } catch {
    return null
  }
}

/**
 * Freshness policy used by the seller image-upload route.
 * @returns {{ freshnessOk: boolean|null, freshnessDeltaSec: number|null, tooOld: boolean }}
 */
export function checkFreshness(capturedAt, now = Date.now()) {
  if (!capturedAt) {
    return { freshnessOk: null, freshnessDeltaSec: null, tooOld: false }
  }
  const freshnessDeltaSec = Math.round((now - capturedAt.getTime()) / 1000)
  const tooOld = freshnessDeltaSec > FRESHNESS_LIMIT_SEC
  return { freshnessOk: !tooOld, freshnessDeltaSec, tooOld }
}

import { randomUUID } from 'node:crypto'
import { getSupabase } from './supabase.js'

const BUCKET = 'consignment-images'

// Short-lived signed URL TTL. The bucket is private so getPublicUrl() would
// 400; callers use getSignedUrl() at read time so tokens stay fresh.
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
}

export async function uploadImage(buffer, mimeType, listingId) {
  const ext = MIME_TO_EXT[mimeType] || 'jpg'
  const storagePath = `${listingId}/${randomUUID()}.${ext}`

  const supabase = getSupabase()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  return { storagePath }
}

export async function getSignedUrl(storagePath, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
  const supabase = getSupabase()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, ttlSeconds)
  if (error) throw new Error(`Signed URL creation failed: ${error.message}`)
  return data.signedUrl
}

export async function deleteImage(storagePath) {
  const supabase = getSupabase()
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

import { randomUUID } from 'node:crypto'
import { getSupabase } from './supabase.js'

const BUCKET = 'consignment-images'

// The consignment-images bucket is private (supabase/config.toml), so
// getPublicUrl() would produce URLs that 400. We store a long-lived
// signed URL instead; moderation and the frontends read it directly.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 // 1 year

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

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (signError) throw new Error(`Signed URL creation failed: ${signError.message}`)

  return { storagePath, publicUrl: data.signedUrl }
}

export async function deleteImage(storagePath) {
  const supabase = getSupabase()
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

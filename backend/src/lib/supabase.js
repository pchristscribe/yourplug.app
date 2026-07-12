import { createClient } from '@supabase/supabase-js'

// Shared service-role Supabase client singleton, following the same
// pattern as lib/redis.js and lib/sql.js. Server-side only — the
// service role key bypasses RLS and must never reach a client bundle.
let _supabase = null

export function getSupabase() {
  if (!_supabase) {
    if (!process.env.NUXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      throw new Error('NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
    }
    _supabase = createClient(
      process.env.NUXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false } }
    )
  }
  return _supabase
}

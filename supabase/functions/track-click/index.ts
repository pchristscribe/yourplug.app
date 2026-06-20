// yourplug — Affiliate Click Tracker
//
// Public endpoint the frontend links to instead of the raw affiliate URL.
// Flow:
//   GET /functions/v1/track-click?id=<affiliate_link_id>
//     1. Validate the UUID
//     2. Look up the affiliate_link row (tracked_url or original_url)
//     3. Insert a row into `clicks` (service role, bypasses RLS)
//     4. Return 302 redirect to the destination URL
//
// The trigger on `clicks` (see migration 002_clicks_ledger.sql) auto-
// increments affiliate_links.clicks + updates last_clicked_at, so this
// function stays simple and atomic.
//
// Runtime: Deno (Supabase Edge Functions).
// Env:
//   SUPABASE_URL                — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY   — auto-injected by Supabase
//
// Deploy:
//   npx supabase functions deploy track-click --project-ref oqkfirmzkdfkfcvzqipo
//
// Local test:
//   npx supabase functions serve track-click --env-file supabase/functions/.env.local
//   curl -i "http://localhost:54321/functions/v1/track-click?id=<uuid>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// SHA-256 hex digest of a string, for privacy-preserving UA fingerprinting.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  // --- Method guard -------------------------------------------------------
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    })
  }

  // --- Input validation ---------------------------------------------------
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (!id || !UUID_RE.test(id)) {
    return new Response('Invalid or missing `id` query param', { status: 400 })
  }

  // --- Supabase client (service role — bypasses RLS to write clicks) ------
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('track-click: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env')
    return new Response('Server misconfigured', { status: 500 })
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Look up the affiliate link -----------------------------------------
  const { data: link, error: lookupError } = await supabase
    .from('affiliate_links')
    .select('id, product_id, tracked_url, original_url')
    .eq('id', id)
    .maybeSingle()

  if (lookupError) {
    console.error('track-click: lookup error', lookupError)
    return new Response('Internal Server Error', { status: 500 })
  }
  if (!link) {
    return new Response('Affiliate link not found', { status: 404 })
  }

  const destination = link.tracked_url || link.original_url
  if (!destination) {
    console.error('track-click: affiliate link has no URL', link.id)
    return new Response('Affiliate link has no destination', { status: 500 })
  }

  // --- Record the click (detail row; trigger bumps aggregate counter) -----
  // HEAD requests skip the insert — they're typically from previewers/bots.
  if (req.method === 'GET') {
    const ua = req.headers.get('user-agent') ?? ''
    const userAgentHash = ua ? await sha256Hex(ua) : null
    const referrer = req.headers.get('referer') ?? null
    const ipCountry = req.headers.get('cf-ipcountry') ?? req.headers.get('x-country') ?? null

    const { error: insertError } = await supabase.from('clicks').insert({
      affiliate_link_id: link.id,
      product_id: link.product_id,
      user_agent_hash: userAgentHash,
      referrer,
      ip_country: ipCountry,
    })

    if (insertError) {
      // Log but don't block the redirect — losing a click record is better
      // than blocking a monetizable click-through.
      console.error('track-click: insert error', insertError)
    }
  }

  // --- Redirect -----------------------------------------------------------
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      // Do not cache: each visit must pass through to be counted.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      // CORS: allow direct <a href> navigation from any origin.
      'Access-Control-Allow-Origin': '*',
    },
  })
})

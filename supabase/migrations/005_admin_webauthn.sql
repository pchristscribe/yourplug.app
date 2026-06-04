-- Swordfighters App — Admin WebAuthn
-- Reconciles the Supabase schema with what the Fastify backend needs for
-- passwordless admin auth. This migration is purely additive and is the
-- prerequisite for replacing Prisma with postgres-js against Supabase
-- (see RAILWAY.md / CLAUDE.md backend section).
--
-- Adds:
--   • admins: password_hash, is_active, last_login_at, current_challenge,
--     challenge_expires_at  (the last two back the registration/auth flow)
--   • webauthn_credentials: per-admin registered authenticators

-- ── admins: extra columns ────────────────────────────────────────────────

alter table admins
  -- password_hash backs the email+password fallback path in
  -- backend/src/routes/admin/auth.js. WebAuthn is the primary login;
  -- password is kept as an emergency / non-WebAuthn-capable-device fallback.
  add column if not exists password_hash         text,
  add column if not exists is_active             boolean not null default true,
  add column if not exists last_login_at         timestamptz,
  add column if not exists current_challenge     text,
  add column if not exists challenge_expires_at  timestamptz;

-- Used by the periodic cleanup job to expire stale challenges.
create index if not exists admins_challenge_expires_at_idx
  on admins(challenge_expires_at)
  where current_challenge is not null;

-- ── webauthn_credentials ─────────────────────────────────────────────────

create table if not exists webauthn_credentials (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid not null references admins(id) on delete cascade,
  credential_id  text not null unique,         -- base64url-encoded credential ID
  public_key     text not null,                -- base64url-encoded COSE public key
  counter        bigint not null default 0,    -- signature counter (replay protection)
  device_name    text,                         -- e.g. "YubiKey 5", "MacBook Touch ID"
  transports     text[] not null default '{}', -- usb | nfc | ble | internal | hybrid
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists webauthn_credentials_admin_id_idx
  on webauthn_credentials(admin_id);

-- ── Row Level Security ───────────────────────────────────────────────────
-- Credentials are admin-only; the backend uses the service role. We never
-- expose this table to the anon key.

alter table webauthn_credentials enable row level security;

-- CREATE POLICY has no IF NOT EXISTS clause in PostgreSQL, so we wrap it
-- in a DO block to keep this migration idempotent on re-apply.
do $$ begin
  create policy "webauthn_credentials_service_all" on webauthn_credentials
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

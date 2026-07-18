-- Migration 002: Extend admins table and add WebAuthn credentials
-- Adds fields required for WebAuthn passwordless auth and challenge management
--
-- NOTE: 005_admin_webauthn.sql re-adds this same admins/webauthn_credentials
-- schema. This is intentional, historical redundancy — do not remove either
-- migration or "clean up" the duplication. Both are (or may already be)
-- applied to production/team databases, and Supabase tracks applied
-- migrations by filename; editing history here would desync other
-- developers' local DBs and any already-migrated environment. The `if not
-- exists` guards in both files, plus 005's DO-block wrapper around
-- `create policy` (which has no IF NOT EXISTS), are what make the two
-- coexist safely in numbered order. Leave both as-is.

-- ── Extend admins table ───────────────────────────────────────────────────

alter table admins
  add column if not exists password_hash      text,
  add column if not exists is_active          boolean not null default true,
  add column if not exists last_login_at      timestamptz,
  add column if not exists current_challenge  text,
  add column if not exists challenge_expires_at timestamptz;

-- Index for efficient expired-challenge cleanup (runs on every request)
create index if not exists admins_challenge_expires_at_idx
  on admins(challenge_expires_at)
  where challenge_expires_at is not null;

create index if not exists admins_email_idx on admins(email);

-- ── WebAuthn credentials ──────────────────────────────────────────────────

create table if not exists webauthn_credentials (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references admins(id) on delete cascade,
  credential_id   text not null unique,    -- base64url-encoded credential ID
  public_key      text not null,           -- base64url-encoded COSE public key
  counter         bigint not null default 0,
  device_name     text,                    -- user-friendly label, e.g. "Touch ID"
  transports      text[] not null default '{}',
  last_used_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists webauthn_credentials_admin_id_idx
  on webauthn_credentials(admin_id);

create index if not exists webauthn_credentials_credential_id_idx
  on webauthn_credentials(credential_id);

-- ── Row Level Security ────────────────────────────────────────────────────

alter table webauthn_credentials enable row level security;

-- Only the backend service role can read/write credentials (never exposed to browser)
create policy "webauthn_credentials_service_all" on webauthn_credentials
  for all using (auth.role() = 'service_role');

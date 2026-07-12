-- Local-dev stub for the Supabase `auth` schema.
-- The migrations in supabase/migrations/ target hosted Supabase, which ships
-- auth.users / auth.uid() / auth.role(). Vanilla Postgres (docker-compose)
-- has none of these, so apply this file ONCE before running migrations locally:
--
--   docker exec -i yourplug-postgres psql -U yourplug -d yourplug_db < scripts/local-auth-stub.sql
--
-- Never apply this to the hosted Supabase project.

create extension if not exists "pgcrypto";

create schema if not exists auth;

-- Minimal stand-in for Supabase's auth.users (008_user_profiles references it as an FK target)
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Supabase resolves these from the request JWT; locally they read the same
-- settings PostgREST/Supabase would set, defaulting to null / 'anon'.
-- Note: the backend connects as a superuser locally, which bypasses RLS
-- entirely, so these exist only to let policy DDL execute.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;

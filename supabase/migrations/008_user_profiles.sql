-- Migration 008: User profiles (Supabase Auth integration)
-- Ties auth.users to a public profile record.
-- The trigger fires on every new sign-up (email+password, OAuth, magic link).

-- ── Table ─────────────────────────────────────────────────────────────────

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  -- OAuth providers populate email via the trigger; can also be updated by user.
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Updated-at trigger ────────────────────────────────────────────────────

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ── Auto-create profile on sign-up ────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row Level Security ────────────────────────────────────────────────────

alter table profiles enable row level security;

-- Anyone can read profiles (public display names, avatars).
create policy "profiles_public_read" on profiles
  for select using (true);

-- Users can only update their own profile.
create policy "profiles_owner_update" on profiles
  for update using ((select auth.uid()) = id);

-- Service role has full access.
create policy "profiles_service_all" on profiles
  for all using ((select auth.role()) = 'service_role');

-- ── Index ─────────────────────────────────────────────────────────────────

create index profiles_email_idx on profiles(email);

-- Migration 011: Security fixes for RLS policies and published_at trigger
--
-- 1. profiles: drop overly-permissive public-read policy (exposes email);
--    create a public_profiles view with only non-sensitive columns and an
--    owner-only policy for reading the full row (including email).
--
-- 2. product_variants: restrict public read to variants whose parent product
--    is ACTIVE, mirroring the existing products visibility policy.
--
-- 3. blog_posts: extend the set_published_at trigger to fire on INSERT so
--    posts created directly with status='published' get published_at set.

-- ── 1. Profiles: restrict public read ────────────────────────────────────

drop policy if exists "profiles_public_read" on profiles;

-- Safe public projection — no email, no internal timestamps
create or replace view public_profiles as
  select id, display_name, avatar_url
  from profiles;

-- Authenticated users can read their own full profile row
create policy "profiles_owner_read" on profiles
  for select using ((select auth.uid()) = id);

-- ── 2. Product variants: active-products-only public read ─────────────────

drop policy if exists "product_variants_public_read" on product_variants;

create policy "product_variants_public_read" on product_variants
  for select using (
    exists (
      select 1 from products p
      where p.id = product_id and p.status = 'ACTIVE'
    )
  );

-- ── 3. Blog posts: set published_at on INSERT as well as UPDATE ───────────

create or replace function set_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status <> 'published') then
      new.published_at = coalesce(new.published_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists blog_posts_set_published_at on blog_posts;

create trigger blog_posts_set_published_at
  before insert or update on blog_posts
  for each row execute function set_published_at();

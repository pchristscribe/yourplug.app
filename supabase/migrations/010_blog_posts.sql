-- Migration 010: Blog posts / editorial content
-- Long-form SEO content authored by the yourplug team.
-- Posts can link to products and categories via junction tables.

-- ── Enum ──────────────────────────────────────────────────────────────────

create type post_status as enum ('draft', 'published', 'archived');

-- ── Main table ────────────────────────────────────────────────────────────

create table blog_posts (
  id              uuid        primary key default gen_random_uuid(),
  slug            text        not null unique,
  title           text        not null,
  excerpt         text,                         -- one-sentence summary / OG description
  content         text        not null,         -- markdown (rendered client-side)
  featured_image  text,                         -- hero image URL
  seo_title       text,                         -- <title> override (falls back to title)
  seo_description text,                         -- meta description (falls back to excerpt)
  author_name     text        not null default 'yourplug Team',
  status          post_status not null default 'draft',
  published_at    timestamptz,                  -- null until status = 'published'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Junction: posts ↔ products ────────────────────────────────────────────

create table blog_post_products (
  blog_post_id  uuid     not null references blog_posts(id) on delete cascade,
  product_id    uuid     not null references products(id)   on delete cascade,
  display_order smallint not null default 0,
  primary key (blog_post_id, product_id)
);

-- ── Junction: posts ↔ categories ─────────────────────────────────────────

create table blog_post_categories (
  blog_post_id uuid not null references blog_posts(id)    on delete cascade,
  category_id  uuid not null references categories(id)    on delete cascade,
  primary key (blog_post_id, category_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────

-- Public listing: WHERE status = 'published' ORDER BY published_at DESC
create index blog_posts_published_at_idx
  on blog_posts(published_at desc)
  where status = 'published';

create index blog_posts_status_idx            on blog_posts(status);
create index blog_post_products_product_idx   on blog_post_products(product_id);
create index blog_post_categories_cat_idx     on blog_post_categories(category_id);

-- ── Updated-at trigger ────────────────────────────────────────────────────

create trigger blog_posts_updated_at before update on blog_posts
  for each row execute function set_updated_at();

-- ── Auto-set published_at ─────────────────────────────────────────────────

create or replace function set_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    new.published_at = coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger blog_posts_set_published_at before update on blog_posts
  for each row execute function set_published_at();

-- ── Row Level Security ────────────────────────────────────────────────────

alter table blog_posts          enable row level security;
alter table blog_post_products  enable row level security;
alter table blog_post_categories enable row level security;

-- Public can only read published posts.
create policy "blog_posts_public_read" on blog_posts
  for select using (status = 'published');

create policy "blog_post_products_public_read" on blog_post_products
  for select using (
    exists (
      select 1 from blog_posts bp
      where bp.id = blog_post_id and bp.status = 'published'
    )
  );

create policy "blog_post_categories_public_read" on blog_post_categories
  for select using (
    exists (
      select 1 from blog_posts bp
      where bp.id = blog_post_id and bp.status = 'published'
    )
  );

-- Service role (admin panel) has full access.
create policy "blog_posts_service_all"           on blog_posts
  for all using ((select auth.role()) = 'service_role');

create policy "blog_post_products_service_all"   on blog_post_products
  for all using ((select auth.role()) = 'service_role');

create policy "blog_post_categories_service_all" on blog_post_categories
  for all using ((select auth.role()) = 'service_role');

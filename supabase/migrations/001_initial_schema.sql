-- yourplug App - Initial Schema
-- Supabase Project: oqkfirmzkdfkfcvzqipo

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────

create type platform as enum ('DHGATE', 'ALIEXPRESS', 'AMAZON', 'WISH');
create type product_status as enum ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');

-- ── Tables ────────────────────────────────────────────────────────────────

create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table products (
  id               uuid primary key default gen_random_uuid(),
  external_id      text not null,
  platform         platform not null,
  title            text not null,
  description      text not null default '',
  image_url        text not null default '',
  price            numeric(10, 2) not null,
  currency         text not null default 'USD',
  price_updated_at timestamptz not null default now(),
  category_id      uuid not null references categories(id) on delete restrict,
  status           product_status not null default 'ACTIVE',
  rating           numeric(3, 2),
  review_count     integer not null default 0,
  tags             text[] not null default '{}',
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (external_id, platform)
);

create table affiliate_links (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  original_url    text not null,
  tracked_url     text not null,
  dub_link_id     text,
  clicks          integer not null default 0,
  conversions     integer not null default 0,
  revenue         numeric(10, 2) not null default 0,
  last_clicked_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table admins (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text not null,
  role       text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index products_category_id_idx on products(category_id);
create index products_status_idx on products(status);
create index products_platform_idx on products(platform);
create index products_created_at_idx on products(created_at desc);
create index products_price_idx on products(price);
create index products_rating_idx on products(rating desc);
create index products_tags_idx on products using gin(tags);
create index affiliate_links_product_id_idx on affiliate_links(product_id);

-- ── Updated-at trigger ────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_updated_at before update on categories
  for each row execute function set_updated_at();

create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

create trigger affiliate_links_updated_at before update on affiliate_links
  for each row execute function set_updated_at();

create trigger admins_updated_at before update on admins
  for each row execute function set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────

alter table categories enable row level security;
alter table products enable row level security;
alter table affiliate_links enable row level security;
alter table admins enable row level security;

-- Public read access for categories and active products
create policy "categories_public_read" on categories
  for select using (true);

create policy "products_public_read" on products
  for select using (status = 'ACTIVE');

create policy "affiliate_links_public_read" on affiliate_links
  for select using (true);

-- Service role has full access (used by admin backend)
create policy "categories_service_all" on categories
  for all using (auth.role() = 'service_role');

create policy "products_service_all" on products
  for all using (auth.role() = 'service_role');

create policy "affiliate_links_service_all" on affiliate_links
  for all using (auth.role() = 'service_role');

create policy "admins_service_all" on admins
  for all using (auth.role() = 'service_role');

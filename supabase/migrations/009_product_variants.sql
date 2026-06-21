-- Migration 009: Product variants
-- Replaces ad-hoc size/colour data stuffed into products.metadata with proper
-- relational rows. Each variant is a (product, type, value) triple with an
-- optional price delta and stock status.

-- ── Enum ──────────────────────────────────────────────────────────────────

create type variant_type as enum ('size', 'color', 'material', 'style', 'pack_size');
create type stock_status  as enum ('in_stock', 'low_stock', 'out_of_stock');

-- ── Table ─────────────────────────────────────────────────────────────────

create table product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid        not null references products(id) on delete cascade,
  variant_type   variant_type not null,
  value          text        not null,          -- 'S' | 'Red' | 'Cotton' | '3-pack'
  price_modifier numeric(10,2) not null default 0, -- added to base product price
  sku            text,
  stock_status   stock_status not null default 'in_stock',
  image_url      text,                          -- variant-specific image (optional)
  sort_order     smallint    not null default 0,
  is_default     boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (product_id, variant_type, value)
);

-- Only one default per (product, type) combination.
create unique index product_variants_one_default_per_type_idx
  on product_variants (product_id, variant_type)
  where is_default = true;

-- ── Indexes ───────────────────────────────────────────────────────────────

create index product_variants_product_id_idx    on product_variants(product_id);
create index product_variants_stock_status_idx  on product_variants(stock_status);

-- ── Updated-at trigger ────────────────────────────────────────────────────

create trigger product_variants_updated_at before update on product_variants
  for each row execute function set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────

alter table product_variants enable row level security;

create policy "product_variants_public_read" on product_variants
  for select using (true);

create policy "product_variants_service_all" on product_variants
  for all using ((select auth.role()) = 'service_role');

-- Swordfighters App — Editorial Reviews
-- Curated product reviews authored by the Swordfighters team (not user-
-- submitted). The admin panel manages CRUD via the backend API; the public
-- frontend reads them on product detail pages via the anon key.
--
-- Schema matches the fields the admin panel form captures:
--   productId, rating (1-5), title, content, pros[], cons[],
--   authorName, isFeatured

-- ── Table ─────────────────────────────────────────────────────────────────

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  title        text,
  content      text not null check (char_length(content) between 10 and 5000),
  pros         text[] not null default '{}',
  cons         text[] not null default '{}',
  author_name  text not null default 'Swordfighters Team',
  is_featured  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index reviews_product_id_idx  on reviews(product_id);
create index reviews_is_featured_idx on reviews(is_featured) where is_featured;
create index reviews_created_at_idx  on reviews(created_at desc);

-- ── Updated-at trigger ────────────────────────────────────────────────────

create trigger reviews_updated_at before update on reviews
  for each row execute function set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────

alter table reviews enable row level security;

-- Public can read all reviews (editorial content, no user PII)
create policy "reviews_public_read" on reviews
  for select using (true);

-- Service role (admin backend) has full access.
create policy "reviews_service_all" on reviews
  for all using (auth.role() = 'service_role');

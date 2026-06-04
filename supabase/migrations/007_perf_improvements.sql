-- Swordfighters App — Performance & RLS Improvements
-- Fixes: RLS per-row function evaluation, missing composite/partial indexes.

-- ── RLS Policy Performance Fix ────────────────────────────────────────────
-- auth.role() was called once per row in all service-role policies.
-- Wrapping in (select auth.role()) hoists evaluation to once per query.

-- categories
drop policy if exists "categories_service_all" on categories;
create policy "categories_service_all" on categories
  for all using ((select auth.role()) = 'service_role');

-- products
drop policy if exists "products_service_all" on products;
create policy "products_service_all" on products
  for all using ((select auth.role()) = 'service_role');

-- affiliate_links
drop policy if exists "affiliate_links_service_all" on affiliate_links;
create policy "affiliate_links_service_all" on affiliate_links
  for all using ((select auth.role()) = 'service_role');

-- admins
drop policy if exists "admins_service_all" on admins;
create policy "admins_service_all" on admins
  for all using ((select auth.role()) = 'service_role');

-- clicks
drop policy if exists "clicks_service_all" on clicks;
create policy "clicks_service_all" on clicks
  for all using ((select auth.role()) = 'service_role');

-- reviews
drop policy if exists "reviews_service_all" on reviews;
create policy "reviews_service_all" on reviews
  for all using ((select auth.role()) = 'service_role');

-- ── Indexes ───────────────────────────────────────────────────────────────

-- Default catalog listing: WHERE status = 'ACTIVE' ORDER BY created_at DESC.
-- Partial index covers only active products, eliminating the bitmap merge
-- between products_status_idx and products_created_at_idx.
create index if not exists products_active_created_at_idx
  on products(created_at desc)
  where status = 'ACTIVE';

-- Category browse: WHERE status = 'ACTIVE' AND category_id = ?
-- Composite with equality column first (leftmost-prefix rule).
create index if not exists products_status_category_id_idx
  on products(status, category_id);

-- Product detail reviews: WHERE product_id = ? ORDER BY created_at DESC.
-- Composite eliminates the in-memory sort step.
create index if not exists reviews_product_id_created_at_idx
  on reviews(product_id, created_at desc);

-- Affiliate link lookup by Dub link ID (webhook callbacks).
-- Partial to skip rows where dub_link_id is null.
create index if not exists affiliate_links_dub_link_id_idx
  on affiliate_links(dub_link_id)
  where dub_link_id is not null;

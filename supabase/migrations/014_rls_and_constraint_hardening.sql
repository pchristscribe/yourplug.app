-- Migration 014: RLS performance hardening, column-level privacy, missing
-- indexes, and value constraints — findings from a Supabase Postgres
-- best-practices audit of migrations 001-013.
--
-- 1. RLS: wrap auth.uid()/auth.role() in (select ...) across
--    consignment_* / seller_profiles / webauthn_credentials policies.
--    007_perf_improvements.sql applied this fix to the earlier tables
--    (categories/products/affiliate_links/admins/clicks/reviews); 012 and
--    005 predate that fix and were never revisited.
-- 2. affiliate_links: strip anon/authenticated column access to `revenue`
--    and `dub_link_id` (internal financial/webhook data). clicks/conversions
--    stay public — the product page displays them as social proof.
-- 3. public_profiles: explicit grant so its visibility doesn't depend on
--    Supabase's implicit default-privilege inheritance.
-- 4. Missing indexes on consignment_transactions / consignment_moderation_logs
--    foreign keys and obvious filter/sort columns.
-- 5. CHECK constraints on money/count/percentage columns that had none.

-- ── 1. RLS performance: hoist auth.*() to (select auth.*()) ───────────────

-- seller_profiles
drop policy if exists "seller_profiles_owner_read" on seller_profiles;
create policy "seller_profiles_owner_read" on seller_profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "seller_profiles_owner_write" on seller_profiles;
create policy "seller_profiles_owner_write" on seller_profiles
  for all using ((select auth.uid()) = id);

drop policy if exists "seller_profiles_service_all" on seller_profiles;
create policy "seller_profiles_service_all" on seller_profiles
  for all using ((select auth.role()) = 'service_role');

-- consignment_listings
drop policy if exists "consignment_listings_owner_read" on consignment_listings;
create policy "consignment_listings_owner_read" on consignment_listings
  for select using ((select auth.uid()) = seller_id);

drop policy if exists "consignment_listings_owner_insert" on consignment_listings;
create policy "consignment_listings_owner_insert" on consignment_listings
  for insert with check (
    (select auth.uid()) = seller_id
    and status in ('DRAFT', 'PENDING_MODERATION')
    and moderation_status = 'PENDING'
    and moderation_reason is null
    and moderation_at is null
    and sold_at is null
  );

drop policy if exists "consignment_listings_owner_update" on consignment_listings;
create policy "consignment_listings_owner_update" on consignment_listings
  for update
  using ((select auth.uid()) = seller_id and status in ('DRAFT', 'REJECTED'))
  with check ((select auth.uid()) = seller_id and status in ('DRAFT', 'PENDING_MODERATION'));

drop policy if exists "consignment_listings_owner_delete" on consignment_listings;
create policy "consignment_listings_owner_delete" on consignment_listings
  for delete
  using ((select auth.uid()) = seller_id and status in ('DRAFT', 'REJECTED'));

drop policy if exists "consignment_listings_service_all" on consignment_listings;
create policy "consignment_listings_service_all" on consignment_listings
  for all using ((select auth.role()) = 'service_role');

-- consignment_images
drop policy if exists "consignment_images_owner_read" on consignment_images;
create policy "consignment_images_owner_read" on consignment_images
  for select using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.seller_id = (select auth.uid())
    )
  );

drop policy if exists "consignment_images_owner_insert" on consignment_images;
create policy "consignment_images_owner_insert" on consignment_images
  for insert with check (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id
        and l.seller_id = (select auth.uid())
        and l.status in ('DRAFT', 'REJECTED')
    )
    and moderation_passed is null
    and freshness_ok is null
    and freshness_delta_sec is null
  );

drop policy if exists "consignment_images_owner_update" on consignment_images;
create policy "consignment_images_owner_update" on consignment_images
  for update using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id
        and l.seller_id = (select auth.uid())
        and l.status in ('DRAFT', 'REJECTED')
    )
  );

drop policy if exists "consignment_images_owner_delete" on consignment_images;
create policy "consignment_images_owner_delete" on consignment_images
  for delete using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id
        and l.seller_id = (select auth.uid())
        and l.status in ('DRAFT', 'REJECTED')
    )
  );

drop policy if exists "consignment_images_service_all" on consignment_images;
create policy "consignment_images_service_all" on consignment_images
  for all using ((select auth.role()) = 'service_role');

-- consignment_offers
drop policy if exists "consignment_offers_buyer_read" on consignment_offers;
create policy "consignment_offers_buyer_read" on consignment_offers
  for select using ((select auth.uid()) = buyer_id);

drop policy if exists "consignment_offers_seller_read" on consignment_offers;
create policy "consignment_offers_seller_read" on consignment_offers
  for select using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.seller_id = (select auth.uid())
    )
  );

drop policy if exists "consignment_offers_buyer_insert" on consignment_offers;
create policy "consignment_offers_buyer_insert" on consignment_offers
  for insert with check (
    (select auth.uid()) = buyer_id
    and status = 'PENDING'
    and exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.status = 'APPROVED'
    )
  );

drop policy if exists "consignment_offers_buyer_update" on consignment_offers;
create policy "consignment_offers_buyer_update" on consignment_offers
  for update
  using ((select auth.uid()) = buyer_id and status = 'PENDING')
  with check ((select auth.uid()) = buyer_id and status in ('PENDING', 'WITHDRAWN'));

drop policy if exists "consignment_offers_service_all" on consignment_offers;
create policy "consignment_offers_service_all" on consignment_offers
  for all using ((select auth.role()) = 'service_role');

-- consignment_transactions / consignment_moderation_logs (service-role only)
drop policy if exists "consignment_transactions_service_all" on consignment_transactions;
create policy "consignment_transactions_service_all" on consignment_transactions
  for all using ((select auth.role()) = 'service_role');

drop policy if exists "consignment_moderation_logs_service_all" on consignment_moderation_logs;
create policy "consignment_moderation_logs_service_all" on consignment_moderation_logs
  for all using ((select auth.role()) = 'service_role');

-- webauthn_credentials (missed by 007's cleanup pass)
drop policy if exists "webauthn_credentials_service_all" on webauthn_credentials;
create policy "webauthn_credentials_service_all" on webauthn_credentials
  for all using ((select auth.role()) = 'service_role');

-- ── 2. affiliate_links: hide revenue / dub_link_id from anon + authenticated ─
-- clicks/conversions stay public (rendered on the product detail page as
-- social proof); revenue is real affiliate earnings and dub_link_id is an
-- internal webhook identifier — neither should be readable via the anon key.
-- service_role keeps its existing full-table grant untouched.

revoke select on affiliate_links from anon, authenticated;
grant select (
  id, product_id, original_url, tracked_url,
  clicks, conversions, last_clicked_at, created_at, updated_at
) on affiliate_links to anon, authenticated;

-- ── 3. public_profiles: explicit grant ─────────────────────────────────────
-- Deliberately bypasses profiles' owner-only RLS to expose a curated public
-- projection (id/display_name/avatar_url only) — this is the intended use
-- of the view, so security_invoker is NOT set here. The explicit grant just
-- removes any dependency on implicit default-privilege inheritance.

grant select on public_profiles to anon, authenticated;

-- ── 4. Missing indexes ──────────────────────────────────────────────────────

create index if not exists consignment_transactions_seller_id_idx
  on consignment_transactions(seller_id);

create index if not exists consignment_transactions_buyer_id_idx
  on consignment_transactions(buyer_id);

create index if not exists consignment_transactions_listing_id_idx
  on consignment_transactions(listing_id);

-- Payment-status dashboards / seller-buyer history, newest first.
create index if not exists consignment_transactions_payment_status_created_at_idx
  on consignment_transactions(payment_status, created_at desc);

-- image_id is nullable (ON DELETE SET NULL); partial index skips null rows.
create index if not exists consignment_moderation_logs_image_id_idx
  on consignment_moderation_logs(image_id)
  where image_id is not null;

-- Marketplace browse: WHERE status = 'APPROVED' ORDER BY created_at DESC.
-- Mirrors products_active_created_at_idx from 007_perf_improvements.sql.
create index if not exists consignment_listings_approved_created_at_idx
  on consignment_listings(created_at desc)
  where status = 'APPROVED';

-- Category browse: WHERE status = ? AND category = ?
create index if not exists consignment_listings_status_category_idx
  on consignment_listings(status, category);

-- ── 5. CHECK constraints on money / count / percentage columns ────────────

alter table products
  add constraint products_price_non_negative check (price >= 0),
  add constraint products_rating_range check (rating is null or (rating >= 0 and rating <= 5)),
  add constraint products_review_count_non_negative check (review_count >= 0);

alter table affiliate_links
  add constraint affiliate_links_clicks_non_negative check (clicks >= 0),
  add constraint affiliate_links_conversions_non_negative check (conversions >= 0),
  add constraint affiliate_links_revenue_non_negative check (revenue >= 0);

alter table seller_profiles
  add constraint seller_profiles_total_sales_non_negative check (total_sales >= 0),
  add constraint seller_profiles_total_revenue_non_negative check (total_revenue >= 0);

alter table consignment_listings
  add constraint consignment_listings_platform_fee_pct_range
    check (platform_fee_pct >= 0 and platform_fee_pct <= 1);

alter table consignment_transactions
  add constraint consignment_transactions_sale_price_non_negative check (sale_price >= 0),
  add constraint consignment_transactions_platform_fee_non_negative check (platform_fee >= 0),
  add constraint consignment_transactions_seller_payout_non_negative check (seller_payout >= 0);

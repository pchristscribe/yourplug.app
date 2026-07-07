-- yourplug App - Consignment Marketplace Schema

-- ── Enums ─────────────────────────────────────────────────────────────────

create type consignment_condition as enum ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');
create type consignment_category  as enum ('APPAREL', 'ACCESSORIES', 'UNDERWEAR', 'HARNESS', 'TOY', 'OTHER');
create type listing_status        as enum ('DRAFT', 'PENDING_MODERATION', 'APPROVED', 'REJECTED', 'SOLD', 'ARCHIVED');
create type moderation_decision   as enum ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');
create type offer_status          as enum ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');
create type payment_status        as enum ('PENDING', 'AWAITING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'REFUNDED', 'DISPUTED');

-- ── Tables ────────────────────────────────────────────────────────────────

create table seller_profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id      text unique,
  stripe_onboarding_done boolean not null default false,
  display_name           text not null default '',
  total_sales            int not null default 0,
  total_revenue          numeric(12, 2) not null default 0.00,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table consignment_listings (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  description       text not null default '',
  condition         consignment_condition not null,
  category          consignment_category not null,
  asking_price      numeric(10, 2) not null check (asking_price > 0),
  platform_fee_pct  numeric(4, 3) not null default 0.150,
  status            listing_status not null default 'DRAFT',
  moderation_status moderation_decision not null default 'PENDING',
  moderation_reason text,
  moderation_at     timestamptz,
  sold_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table consignment_images (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid not null references consignment_listings(id) on delete cascade,
  storage_path        text not null,
  public_url          text not null,
  is_primary          boolean not null default false,
  exif_captured_at    timestamptz,
  freshness_delta_sec int,
  freshness_ok        boolean,
  moderation_passed   boolean,
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now()
);

create table consignment_offers (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references consignment_listings(id) on delete cascade,
  buyer_id   uuid not null references auth.users(id) on delete cascade,
  amount     numeric(10, 2) not null check (amount > 0),
  status     offer_status not null default 'PENDING',
  message    text,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consignment_transactions (
  id                    uuid primary key default gen_random_uuid(),
  -- Transactions are financial records: they must survive user/listing
  -- deletion, so SET NULL anonymizes instead of blocking or cascading.
  -- offer_id is UNIQUE: one transaction per accepted offer (idempotency anchor).
  listing_id            uuid references consignment_listings(id) on delete set null,
  offer_id              uuid unique references consignment_offers(id) on delete set null,
  seller_id             uuid references auth.users(id) on delete set null,
  buyer_id              uuid references auth.users(id) on delete set null,
  sale_price            numeric(10, 2) not null,
  platform_fee          numeric(10, 2) not null,
  seller_payout         numeric(10, 2) not null,
  stripe_payment_intent text,
  stripe_transfer_id    text,
  payment_status        payment_status not null default 'PENDING',
  shipped_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table consignment_moderation_logs (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references consignment_listings(id) on delete cascade,
  image_id      uuid references consignment_images(id) on delete set null,
  check_type    text not null,
  model_used    text not null,
  input_tokens  int,
  output_tokens int,
  result        jsonb not null,
  passed        boolean not null,
  reason        text,
  created_at    timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index consignment_listings_seller_id_idx          on consignment_listings(seller_id);
create index consignment_listings_status_idx             on consignment_listings(status);
create index consignment_listings_moderation_status_idx  on consignment_listings(moderation_status);
create index consignment_listings_category_idx           on consignment_listings(category);
create index consignment_listings_asking_price_idx       on consignment_listings(asking_price);
create index consignment_listings_created_at_idx         on consignment_listings(created_at desc);
create index consignment_images_listing_id_idx           on consignment_images(listing_id);
create index consignment_offers_listing_id_idx           on consignment_offers(listing_id);
create index consignment_offers_buyer_id_idx             on consignment_offers(buyer_id);
create index consignment_moderation_logs_listing_id_idx  on consignment_moderation_logs(listing_id);

-- ── Updated-at triggers ───────────────────────────────────────────────────

create trigger seller_profiles_updated_at before update on seller_profiles
  for each row execute function set_updated_at();

create trigger consignment_listings_updated_at before update on consignment_listings
  for each row execute function set_updated_at();

create trigger consignment_offers_updated_at before update on consignment_offers
  for each row execute function set_updated_at();

create trigger consignment_transactions_updated_at before update on consignment_transactions
  for each row execute function set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────

alter table seller_profiles             enable row level security;
alter table consignment_listings        enable row level security;
alter table consignment_images          enable row level security;
alter table consignment_offers          enable row level security;
alter table consignment_transactions    enable row level security;
alter table consignment_moderation_logs enable row level security;

-- seller_profiles: owner read/write; service role full
create policy "seller_profiles_owner_read" on seller_profiles
  for select using (auth.uid() = id);

create policy "seller_profiles_owner_write" on seller_profiles
  for all using (auth.uid() = id);

create policy "seller_profiles_service_all" on seller_profiles
  for all using (auth.role() = 'service_role');

-- consignment_listings: public read for APPROVED; owner read own; owner may only
-- create/edit listings in seller-editable states (DRAFT/REJECTED) and may only move
-- them to DRAFT or PENDING_MODERATION — moderation verdicts and sale state changes
-- are reserved for the service role / backend. Column-level protection for rows in
-- editable states (moderation fields, platform_fee_pct, seller_id) is enforced by
-- the consignment_guard_* triggers below.
create policy "consignment_listings_public_read" on consignment_listings
  for select using (status = 'APPROVED');

create policy "consignment_listings_owner_read" on consignment_listings
  for select using (auth.uid() = seller_id);

create policy "consignment_listings_owner_insert" on consignment_listings
  for insert with check (
    auth.uid() = seller_id
    and status in ('DRAFT', 'PENDING_MODERATION')
    and moderation_status = 'PENDING'
    and moderation_reason is null
    and moderation_at is null
    and sold_at is null
  );

create policy "consignment_listings_owner_update" on consignment_listings
  for update
  using (auth.uid() = seller_id and status in ('DRAFT', 'REJECTED'))
  with check (auth.uid() = seller_id and status in ('DRAFT', 'PENDING_MODERATION'));

create policy "consignment_listings_owner_delete" on consignment_listings
  for delete
  using (auth.uid() = seller_id and status in ('DRAFT', 'REJECTED'));

create policy "consignment_listings_service_all" on consignment_listings
  for all using (auth.role() = 'service_role');

-- consignment_images: public read for APPROVED listings; owner read/write; service role full
create policy "consignment_images_public_read" on consignment_images
  for select using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.status = 'APPROVED'
    )
  );

create policy "consignment_images_owner_read" on consignment_images
  for select using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    )
  );

-- Owners may only add/change/remove images while the listing is seller-editable,
-- and may never self-attest moderation or freshness verdicts (those columns are
-- written by the service role / backend; updates are guarded by trigger below).
create policy "consignment_images_owner_insert" on consignment_images
  for insert with check (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
        and l.status in ('DRAFT', 'REJECTED')
    )
    and moderation_passed is null
    and freshness_ok is null
    and freshness_delta_sec is null
  );

create policy "consignment_images_owner_update" on consignment_images
  for update using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
        and l.status in ('DRAFT', 'REJECTED')
    )
  );

create policy "consignment_images_owner_delete" on consignment_images
  for delete using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
        and l.status in ('DRAFT', 'REJECTED')
    )
  );

create policy "consignment_images_service_all" on consignment_images
  for all using (auth.role() = 'service_role');

-- consignment_offers: buyer and listing-seller can read; buyer can insert/update own; service role full
create policy "consignment_offers_buyer_read" on consignment_offers
  for select using (auth.uid() = buyer_id);

create policy "consignment_offers_seller_read" on consignment_offers
  for select using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    )
  );

-- Buyers may only create PENDING offers on APPROVED listings, and may only revise
-- a PENDING offer or withdraw it. Acceptance/rejection/expiry transitions are
-- reserved for the service role / backend (offer acceptance is the seller flow).
create policy "consignment_offers_buyer_insert" on consignment_offers
  for insert with check (
    auth.uid() = buyer_id
    and status = 'PENDING'
    and exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.status = 'APPROVED'
    )
  );

create policy "consignment_offers_buyer_update" on consignment_offers
  for update
  using (auth.uid() = buyer_id and status = 'PENDING')
  with check (auth.uid() = buyer_id and status in ('PENDING', 'WITHDRAWN'));

create policy "consignment_offers_service_all" on consignment_offers
  for all using (auth.role() = 'service_role');

-- consignment_transactions: service role only
create policy "consignment_transactions_service_all" on consignment_transactions
  for all using (auth.role() = 'service_role');

-- consignment_moderation_logs: service role only
create policy "consignment_moderation_logs_service_all" on consignment_moderation_logs
  for all using (auth.role() = 'service_role');

-- ── Column guards for end-user updates ────────────────────────────────────
-- RLS WITH CHECK cannot compare NEW against OLD, so protected columns are frozen
-- here for end-user JWT roles (anon/authenticated). The service role and the
-- backend's direct Postgres connection are exempt — moderation verdicts, sale
-- state, fees, and offer acceptance flow through them exclusively.

create or replace function consignment_guard_listing_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.seller_id         is distinct from old.seller_id
     or new.platform_fee_pct  is distinct from old.platform_fee_pct
     or new.moderation_status is distinct from old.moderation_status
     or new.moderation_reason is distinct from old.moderation_reason
     or new.moderation_at     is distinct from old.moderation_at
     or new.sold_at           is distinct from old.sold_at
     or new.created_at        is distinct from old.created_at then
    raise exception 'consignment_listings: protected column changed';
  end if;

  if new.status is distinct from old.status
     and not (old.status in ('DRAFT', 'REJECTED')
              and new.status in ('DRAFT', 'PENDING_MODERATION')) then
    raise exception 'consignment_listings: invalid status transition % -> %',
      old.status, new.status;
  end if;

  return new;
end;
$$;

create or replace function consignment_guard_image_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  -- Sellers may reorder (sort_order) and set the primary image; everything
  -- else — file pointers, EXIF data, moderation/freshness verdicts — is frozen.
  if new.listing_id          is distinct from old.listing_id
     or new.storage_path        is distinct from old.storage_path
     or new.public_url          is distinct from old.public_url
     or new.exif_captured_at    is distinct from old.exif_captured_at
     or new.freshness_delta_sec is distinct from old.freshness_delta_sec
     or new.freshness_ok        is distinct from old.freshness_ok
     or new.moderation_passed   is distinct from old.moderation_passed
     or new.created_at          is distinct from old.created_at then
    raise exception 'consignment_images: protected column changed';
  end if;

  return new;
end;
$$;

create or replace function consignment_guard_offer_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.listing_id    is distinct from old.listing_id
     or new.buyer_id   is distinct from old.buyer_id
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'consignment_offers: protected column changed';
  end if;

  if new.status is distinct from old.status and new.status <> 'WITHDRAWN' then
    raise exception 'consignment_offers: invalid status transition % -> %',
      old.status, new.status;
  end if;

  if new.amount is distinct from old.amount and new.status <> 'PENDING' then
    raise exception 'consignment_offers: amount can only change while PENDING';
  end if;

  return new;
end;
$$;

create trigger consignment_listings_guard before update on consignment_listings
  for each row execute function consignment_guard_listing_update();

create trigger consignment_images_guard before update on consignment_images
  for each row execute function consignment_guard_image_update();

create trigger consignment_offers_guard before update on consignment_offers
  for each row execute function consignment_guard_offer_update();

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
  seller_id         uuid not null references auth.users(id),
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
  listing_id uuid not null references consignment_listings(id),
  buyer_id   uuid not null references auth.users(id),
  amount     numeric(10, 2) not null check (amount > 0),
  status     offer_status not null default 'PENDING',
  message    text,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consignment_transactions (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid references consignment_listings(id),
  offer_id              uuid references consignment_offers(id),
  seller_id             uuid references auth.users(id),
  buyer_id              uuid references auth.users(id),
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
  listing_id    uuid not null references consignment_listings(id),
  image_id      uuid references consignment_images(id),
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

-- consignment_listings: public read for APPROVED; owner read/write own; service role full
create policy "consignment_listings_public_read" on consignment_listings
  for select using (status = 'APPROVED');

create policy "consignment_listings_owner_read" on consignment_listings
  for select using (auth.uid() = seller_id);

create policy "consignment_listings_owner_write" on consignment_listings
  for all using (auth.uid() = seller_id);

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

create policy "consignment_images_owner_write" on consignment_images
  for all using (
    exists (
      select 1 from consignment_listings l
      where l.id = listing_id and l.seller_id = auth.uid()
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

create policy "consignment_offers_buyer_write" on consignment_offers
  for all using (auth.uid() = buyer_id);

create policy "consignment_offers_service_all" on consignment_offers
  for all using (auth.role() = 'service_role');

-- consignment_transactions: service role only
create policy "consignment_transactions_service_all" on consignment_transactions
  for all using (auth.role() = 'service_role');

-- consignment_moderation_logs: service role only
create policy "consignment_moderation_logs_service_all" on consignment_moderation_logs
  for all using (auth.role() = 'service_role');

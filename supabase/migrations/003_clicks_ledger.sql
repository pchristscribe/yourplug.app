-- Swordfighters App — Clicks Ledger
-- Per-click detail records for affiliate tracking.
-- The aggregate `clicks` counter on `affiliate_links` is kept in sync by a
-- trigger on this table so the existing admin dashboards keep working.

-- ── Table ─────────────────────────────────────────────────────────────────

create table clicks (
  id                 uuid primary key default gen_random_uuid(),
  affiliate_link_id  uuid not null references affiliate_links(id) on delete cascade,
  product_id         uuid not null references products(id) on delete cascade,
  clicked_at         timestamptz not null default now(),
  user_agent_hash    text,           -- sha256 of UA for rough unique-visitor metrics
  referrer           text,
  ip_country         text             -- from cf-ipcountry / x-country header
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index clicks_affiliate_link_id_idx on clicks(affiliate_link_id);
create index clicks_product_id_idx on clicks(product_id);
create index clicks_clicked_at_idx on clicks(clicked_at desc);

-- ── Trigger: keep affiliate_links counters in sync ────────────────────────

create or replace function bump_affiliate_link_click_counters()
returns trigger language plpgsql as $$
begin
  update affiliate_links
  set
    clicks          = clicks + 1,
    last_clicked_at = new.clicked_at,
    updated_at      = now()
  where id = new.affiliate_link_id;
  return new;
end;
$$;

create trigger clicks_after_insert
  after insert on clicks
  for each row execute function bump_affiliate_link_click_counters();

-- ── Row Level Security ────────────────────────────────────────────────────
-- Clicks are write-only from the public API surface; reads are admin-only.
-- The Edge Function uses the service role to insert, which bypasses RLS,
-- so we intentionally do NOT grant anon insert here.

alter table clicks enable row level security;

-- Service role has full access (Edge Functions, admin panel analytics).
create policy "clicks_service_all" on clicks
  for all using (auth.role() = 'service_role');

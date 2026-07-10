-- Provision the consignment-images storage bucket.
-- supabase/config.toml covers the local dev stack; this migration ensures
-- the bucket exists on the remote project when applied via scripts/migrate.sh.
insert into storage.buckets (id, name, public)
values ('consignment-images', 'consignment-images', false)
on conflict (id) do nothing;

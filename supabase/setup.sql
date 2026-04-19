-- Run this in the Supabase SQL Editor

-- 1. Orders table (order history)
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  symbol         text not null,
  side           text not null check (side in ('BUY', 'SELL')),
  order_type     text not null,
  quantity       integer not null,
  limit_price    numeric,
  estimated_total numeric,
  pac_order_id   text,
  status         text not null default 'placed',
  created_at     timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Users see own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users insert own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- 2. Add kyc_doc_url column to profiles (if it doesn't exist)
alter table public.profiles
  add column if not exists kyc_doc_url text;

-- 3. Storage bucket for KYC documents
-- Run this separately in the Storage section of the Supabase dashboard,
-- or uncomment if using the Supabase CLI:
-- insert into storage.buckets (id, name, public) values ('kyc-docs', 'kyc-docs', false);

-- Storage policy: users can upload only to their own folder
-- create policy "Users upload own KYC docs"
--   on storage.objects for insert
--   with check (bucket_id = 'kyc-docs' and auth.uid()::text = (storage.foldername(name))[1]);

-- create policy "Users read own KYC docs"
--   on storage.objects for select
--   using (bucket_id = 'kyc-docs' and auth.uid()::text = (storage.foldername(name))[1]);

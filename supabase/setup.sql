create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  symbol          text not null,
  side            text not null check (side in ('BUY', 'SELL')),
  order_type      text not null,
  quantity        integer not null,
  limit_price     numeric,
  estimated_total numeric,
  pac_order_id    text,
  status          text not null default 'placed',
  created_at      timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Users see own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users insert own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

alter table public.profiles
  add column if not exists kyc_doc_url text;

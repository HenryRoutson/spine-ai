-- AI : creator markup on viewer-funded shared links + separate earnings wallet.

alter table public.shared_links
  add column if not exists markup_bps int not null default 0,
  add column if not exists markup_fixed_cents numeric(12, 4) not null default 0;

create table if not exists public.creator_earnings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_cents numeric(12, 4) not null default 0,
  total_earned_cents numeric(12, 4) not null default 0,
  total_withdrawn_cents numeric(12, 4) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.creator_earnings enable row level security;

drop policy if exists creator_earnings_owner_read on public.creator_earnings;
create policy creator_earnings_owner_read on public.creator_earnings
  for select using (auth.uid() = user_id);

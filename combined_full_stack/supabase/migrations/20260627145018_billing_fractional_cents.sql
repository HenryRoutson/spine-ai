-- AI : run traces bill sub-cent LLM costs; balance + usage need fractional cents to reconcile with spend charts.
create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_cents numeric(12, 4) not null default 1000,
  total_billed_cents numeric(12, 4) not null default 0,
  total_usage_cents numeric(12, 4) not null default 0,
  subscribed boolean not null default false,
  credited_sessions text[] not null default '{}'
);

alter table public.billing_accounts enable row level security;

do $$
begin
  create policy "own rows" on public.billing_accounts for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

alter table public.billing_accounts
  alter column balance_cents type numeric(12, 4) using balance_cents::numeric,
  alter column total_billed_cents type numeric(12, 4) using total_billed_cents::numeric;

alter table public.billing_accounts
  add column if not exists total_usage_cents numeric(12, 4) not null default 0;

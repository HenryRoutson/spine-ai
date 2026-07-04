-- AI : idempotent Stripe credits — primary key prevents double-confirm / duplicate webhook races.
create table if not exists public.billing_credit_ledger (
  credit_key text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents numeric(12, 4) not null check (amount_cents > 0),
  source text not null check (source in ('checkout', 'invoice')),
  created_at timestamptz not null default now()
);

alter table public.billing_credit_ledger enable row level security;

create index if not exists billing_credit_ledger_user_id_idx on public.billing_credit_ledger (user_id);

drop policy if exists billing_credit_ledger_select on public.billing_credit_ledger;
create policy billing_credit_ledger_select on public.billing_credit_ledger
  for select to authenticated
  using (auth.uid() = user_id);

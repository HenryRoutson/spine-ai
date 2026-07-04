-- AI : billing tables are server-writable only — users may read their own rows, never mutate balances.
alter table if exists public.billing_accounts enable row level security;
alter table if exists public.billing_credit_ledger enable row level security;

drop policy if exists "own rows" on public.billing_accounts;
drop policy if exists billing_accounts_insert on public.billing_accounts;
drop policy if exists billing_accounts_update on public.billing_accounts;
drop policy if exists billing_accounts_delete on public.billing_accounts;

drop policy if exists billing_accounts_select on public.billing_accounts;
create policy billing_accounts_select on public.billing_accounts
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists billing_credit_ledger_insert on public.billing_credit_ledger;
drop policy if exists billing_credit_ledger_update on public.billing_credit_ledger;
drop policy if exists billing_credit_ledger_delete on public.billing_credit_ledger;

drop policy if exists billing_credit_ledger_select on public.billing_credit_ledger;
create policy billing_credit_ledger_select on public.billing_credit_ledger
  for select to authenticated
  using (auth.uid() = user_id);

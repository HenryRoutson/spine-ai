-- AI : run once in Supabase SQL editor if top-up fails with "billing_accounts" / "schema cache".
create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_cents int not null default 0,
  total_billed_cents int not null default 0,
  subscribed boolean not null default false,
  credited_sessions text[] not null default '{}'
);

alter table public.billing_accounts enable row level security;

do $$ begin
  create policy "own rows" on public.billing_accounts for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
exception when duplicate_object then null;
end $$;

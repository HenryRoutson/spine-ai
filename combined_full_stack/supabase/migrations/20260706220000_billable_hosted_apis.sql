-- AI : caller-paid hosted APIs with creator markup + user billing keys for programmatic payers.

alter table public.hosted_apis
  add column if not exists funding_mode text not null default 'owner_pays',
  add column if not exists markup_bps int not null default 0,
  add column if not exists markup_fixed_cents numeric(12, 4) not null default 0;

create table if not exists public.user_billing_keys (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'default',
  key_hash text not null,
  key_prefix text not null,
  revoked boolean not null default false,
  created_at bigint not null,
  primary key (user_id, id)
);

create index if not exists user_billing_keys_hash_idx
  on public.user_billing_keys (key_hash)
  where not revoked;

alter table public.user_billing_keys enable row level security;

drop policy if exists user_billing_keys_owner_all on public.user_billing_keys;
create policy user_billing_keys_owner_all on public.user_billing_keys
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

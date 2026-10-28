-- AI : per-user webhook/integration secrets (Higgsfield API key, …). Values never leave owner RLS.
create table if not exists public.user_secrets (
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  value text not null,
  hint text not null default '',
  updated_at bigint not null,
  primary key (user_id, name),
  constraint user_secrets_name_format check (name ~ '^[A-Z][A-Z0-9_]{0,127}$')
);

alter table public.user_secrets enable row level security;

drop policy if exists user_secrets_owner_all on public.user_secrets;
create policy user_secrets_owner_all on public.user_secrets
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

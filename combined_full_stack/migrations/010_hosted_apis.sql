-- AI : programmatic pipeline APIs — bearer key auth, billed to owner.
create table if not exists public.hosted_apis (
  id text not null,
  owner_id uuid not null,
  project_id text not null,
  snapshot jsonb not null,
  default_docs jsonb not null default '[]'::jsonb,
  default_model text,
  api_key_hash text not null,
  api_key_prefix text not null,
  spend_limit_cents numeric,
  total_spend_cents numeric not null default 0,
  request_count int not null default 0,
  revoked boolean not null default false,
  created_at bigint not null,
  primary key (owner_id, id)
);

create index if not exists hosted_apis_public_idx
  on public.hosted_apis (id)
  where not revoked;

alter table public.hosted_apis enable row level security;

drop policy if exists hosted_apis_owner_all on public.hosted_apis;
create policy hosted_apis_owner_all on public.hosted_apis
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

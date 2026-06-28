-- AI : TODO refactor — consolidate with legacy `migrations/*.sql`; avoid duplicate shared_links DDL.
-- AI : published pipeline snapshots — public run links billed to the owner.
create table if not exists public.shared_links (
  id text not null,
  owner_id uuid not null,
  project_id text not null,
  snapshot jsonb not null,
  default_docs jsonb not null default '[]'::jsonb,
  default_model text,
  funding_mode text not null default 'sharer_pays',
  viewer_name_required boolean not null default false,
  revoked boolean not null default false,
  run_count int not null default 0,
  created_at bigint not null,
  primary key (owner_id, id)
);

create index if not exists shared_links_public_idx
  on public.shared_links (id)
  where not revoked;

alter table public.shared_links enable row level security;

drop policy if exists shared_links_owner_all on public.shared_links;
create policy shared_links_owner_all on public.shared_links
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists shared_links_public_read on public.shared_links;
create policy shared_links_public_read on public.shared_links
  for select using (not revoked);

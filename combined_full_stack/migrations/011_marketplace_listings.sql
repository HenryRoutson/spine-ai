-- AI : pipeline marketplace — publish a project snapshot for others to clone (free or paid).
create table if not exists public.marketplace_listings (
  id text not null,
  owner_id uuid not null,
  project_id text not null,
  title text not null,
  description text not null default '',
  price_cents int not null default 0,
  snapshot jsonb not null,
  clone_count int not null default 0,
  created_at bigint not null,
  revoked boolean not null default false,
  primary key (owner_id, id)
);

create index if not exists marketplace_listings_public_idx
  on public.marketplace_listings (id)
  where not revoked;

create index if not exists marketplace_listings_search_idx
  on public.marketplace_listings (created_at desc)
  where not revoked;

alter table public.marketplace_listings enable row level security;

drop policy if exists marketplace_listings_owner_select on public.marketplace_listings;
create policy marketplace_listings_owner_select on public.marketplace_listings
  for select to authenticated
  using (auth.uid() = owner_id);

drop policy if exists marketplace_listings_public_read on public.marketplace_listings;
create policy marketplace_listings_public_read on public.marketplace_listings
  for select using (not revoked);

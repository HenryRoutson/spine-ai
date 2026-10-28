-- AI : marketplace listings are pipeline | website. Page-only sites have no host project.
alter table public.marketplace_listings
  add column if not exists kind text not null default 'pipeline';

alter table public.marketplace_listings
  add column if not exists site_options jsonb;

alter table public.marketplace_listings
  alter column project_id drop not null;

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_kind_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_kind_check
  check (kind in ('pipeline', 'website'));

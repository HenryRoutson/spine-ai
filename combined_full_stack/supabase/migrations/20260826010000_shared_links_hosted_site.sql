-- AI : hosted company HTML wrapper on shared_links (site_ ids) — chrome/CSS/HTML, no extra database.
alter table public.shared_links
  add column if not exists site_options jsonb not null default '{}'::jsonb;

comment on column public.shared_links.site_options is
  'Hosted page brand + custom HTML/CSS for /site/{id}; empty object when not a site_ deployment.';

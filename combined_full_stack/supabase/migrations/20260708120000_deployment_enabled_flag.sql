-- AI : temp disable for shared links and hosted APIs — distinct from revoked (permanent delete).

alter table public.shared_links
  add column if not exists enabled boolean not null default true;

alter table public.hosted_apis
  add column if not exists enabled boolean not null default true;

-- AI : billing multiple on LLM cost + optional flat fee per call (replaces markup_bps).

alter table public.shared_links
  add column if not exists billing_multiple numeric(8, 4) not null default 1;

alter table public.hosted_apis
  add column if not exists billing_multiple numeric(8, 4) not null default 1;

update public.shared_links
set billing_multiple = 1 + (markup_bps::numeric / 10000)
where markup_bps > 0 and billing_multiple = 1;

update public.hosted_apis
set billing_multiple = 1 + (markup_bps::numeric / 10000)
where markup_bps > 0 and billing_multiple = 1;

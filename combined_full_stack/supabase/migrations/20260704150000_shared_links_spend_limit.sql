-- AI : optional per-link spend cap — tracks cumulative billed usage across all shared runs.
alter table public.shared_links
  add column if not exists spend_limit_cents numeric(12, 4),
  add column if not exists total_spend_cents numeric(12, 4) not null default 0;

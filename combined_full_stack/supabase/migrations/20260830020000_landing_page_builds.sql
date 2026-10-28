-- AI : landing Generate must survive Vercel — /tmp landing_builds is per-instance and
-- AI : /api/demo/state on another lambda would fall back to the seed legal demo.

create table if not exists public.landing_page_builds (
  id text primary key,
  project jsonb not null,
  docs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists landing_page_builds_created_at_idx
  on public.landing_page_builds (created_at desc);

alter table public.landing_page_builds enable row level security;

-- AI : no public policies — service role only via admin client.

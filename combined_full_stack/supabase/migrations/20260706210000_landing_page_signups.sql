-- AI : landing page email signups — collected before demo agent use.

create table if not exists public.landing_page_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint landing_page_signups_email_unique unique (email)
);

create index if not exists landing_page_signups_created_at_idx
  on public.landing_page_signups (created_at desc);

alter table public.landing_page_signups enable row level security;

-- AI : no public policies — service role only via admin client.

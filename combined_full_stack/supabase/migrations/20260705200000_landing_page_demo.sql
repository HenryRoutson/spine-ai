-- AI : landing page demo budget + call log — billed separately from user accounts.

create table if not exists public.landing_page_budget (
  id text primary key default 'landing' check (id = 'landing'),
  budget_cents numeric(12, 4) not null default 5000,
  spent_cents numeric(12, 4) not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.landing_page_budget (id)
values ('landing')
on conflict (id) do nothing;

create table if not exists public.landing_page_calls (
  id uuid primary key default gen_random_uuid(),
  prompt_preview text not null,
  output_preview text,
  model text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_cents numeric(12, 4) not null default 0,
  latency_ms int,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists landing_page_calls_created_at_idx
  on public.landing_page_calls (created_at desc);

alter table public.landing_page_budget enable row level security;
alter table public.landing_page_calls enable row level security;

-- AI : no public policies — service role only via admin client.

-- AI : early-user ops timeline — UI actions, errors, LLM usage metadata, and money flow for the admin dashboard.

create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  category text not null check (
    category in (
      'ui_click',
      'ui_input',
      'ui_navigate',
      'error',
      'llm_call',
      'step_create',
      'step_delete',
      'step_modify',
      'log_view',
      'run_start',
      'run_complete'
    )
  ),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  project_id text,
  cost_cents numeric(12, 4),
  created_at timestamptz not null default now()
);

create index if not exists user_activity_events_user_created_idx
  on public.user_activity_events (user_id, created_at desc);

create index if not exists user_activity_events_category_created_idx
  on public.user_activity_events (category, created_at desc);

alter table public.user_activity_events enable row level security;

drop policy if exists user_activity_events_insert on public.user_activity_events;
create policy user_activity_events_insert on public.user_activity_events
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_activity_events_select on public.user_activity_events;
create policy user_activity_events_select on public.user_activity_events
  for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.billing_flow_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  flow_type text not null check (
    flow_type in (
      'signup_credit',
      'checkout_credit',
      'invoice_credit',
      'usage_run',
      'usage_assistant',
      'usage_hosted_api',
      'usage_shared_link',
      'usage_other'
    )
  ),
  amount_cents numeric(12, 4) not null,
  balance_after_cents numeric(12, 4),
  ref_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_flow_ledger_user_created_idx
  on public.billing_flow_ledger (user_id, created_at desc);

create index if not exists billing_flow_ledger_created_idx
  on public.billing_flow_ledger (created_at desc);

alter table public.billing_flow_ledger enable row level security;

drop policy if exists billing_flow_ledger_select on public.billing_flow_ledger;
create policy billing_flow_ledger_select on public.billing_flow_ledger
  for select to authenticated
  using (auth.uid() = user_id);

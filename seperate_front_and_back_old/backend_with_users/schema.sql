-- AI : run this once in the Supabase SQL editor (or `supabase db push`).
-- AI : design — one row per (user, entity). `data jsonb` mirrors the backend TS types
-- AI : verbatim so SupabaseStore stays a thin shell, and RLS is the entire
-- AI : multi-tenancy story: clients carry a user JWT, postgres scopes every query.

create table public.projects (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null, -- Project (models, modules, strategies)
  primary key (user_id, id)
);

create table public.docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null, -- content hash "sha_…" → identical uploads dedupe per user
  name text not null,
  type text not null, -- InputType
  label text not null, -- DocLabel
  size_kb int not null,
  uploaded_at bigint not null, -- epoch ms, matches DocRef.uploadedAt
  preview text not null,
  content text not null, -- full extracted text; move to Supabase Storage if docs get huge
  primary key (user_id, id)
);

create table public.runs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  project_id text not null,
  started_at bigint not null,
  data jsonb not null, -- PipelineRun (steps, billing)
  primary key (user_id, id)
);

-- AI : ephemeral pipeline progress — keyed by unguessable job_* id, shared across Vercel instances.
create table public.run_jobs (
  id text primary key,
  data jsonb not null,
  updated_at bigint not null
);

alter table public.projects enable row level security;
alter table public.docs enable row level security;
alter table public.runs enable row level security;
alter table public.run_jobs enable row level security;

-- AI : one policy per table — a user can do everything, but only on their own rows.
create policy "own rows" on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.docs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.runs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "run_jobs by id" on public.run_jobs for all to authenticated, anon
  using (true) with check (true);

-- AI : Stripe credit billing (stripe/stripe.js) — one row per user, RLS-scoped like projects/docs/runs.
create table public.billing_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_cents int not null default 0,
  total_billed_cents int not null default 0,
  subscribed boolean not null default false,
  credited_sessions text[] not null default '{}'
);

alter table public.billing_accounts enable row level security;

create policy "own rows" on public.billing_accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

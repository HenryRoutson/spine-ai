-- AI : base schema bootstrap for projects/docs/runs/run_jobs.
-- AI : the hosted project was created with these tables out-of-band, so the later
-- AI : incremental migrations (fingerprint column, caches, billing, …) assume they
-- AI : already exist. Without this file `supabase start` / `supabase db reset` fails
-- AI : locally on the very first migration. Everything is `if not exists` + idempotent
-- AI : RLS, so applying it against an environment that already has the tables is a no-op.

-- projects: one row per project, jsonb config blob keyed by (user_id, id).
create table if not exists public.projects (
  user_id uuid not null default auth.uid(),
  id text not null,
  data jsonb not null,
  primary key (user_id, id)
);

alter table public.projects enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (auth.uid() = user_id);
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert with check (auth.uid() = user_id);
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update using (auth.uid() = user_id);
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete using (auth.uid() = user_id);

-- docs: uploaded document metadata + built-in parser text (vision OCR lives elsewhere).
create table if not exists public.docs (
  user_id uuid not null default auth.uid(),
  id text not null,
  name text not null,
  type text not null,
  label text,
  size_kb integer not null default 0,
  uploaded_at bigint not null,
  preview text not null default '',
  content text not null default '',
  primary key (user_id, id)
);

alter table public.docs enable row level security;

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select using (auth.uid() = user_id);
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert with check (auth.uid() = user_id);
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update using (auth.uid() = user_id);
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete using (auth.uid() = user_id);

-- runs: one row per pipeline run (fingerprint column added by a later migration).
create table if not exists public.runs (
  user_id uuid not null default auth.uid(),
  id text not null,
  project_id text not null,
  started_at bigint not null,
  data jsonb not null,
  primary key (user_id, id)
);

create index if not exists runs_user_started_idx on public.runs (user_id, started_at desc);

alter table public.runs enable row level security;

drop policy if exists runs_select on public.runs;
create policy runs_select on public.runs for select using (auth.uid() = user_id);
drop policy if exists runs_insert on public.runs;
create policy runs_insert on public.runs for insert with check (auth.uid() = user_id);
drop policy if exists runs_update on public.runs;
create policy runs_update on public.runs for update using (auth.uid() = user_id);
drop policy if exists runs_delete on public.runs;
create policy runs_delete on public.runs for delete using (auth.uid() = user_id);

-- run_jobs: async inference job state (shared backend when Supabase is configured).
create table if not exists public.run_jobs (
  user_id uuid not null default auth.uid(),
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  primary key (user_id, id)
);

alter table public.run_jobs enable row level security;

drop policy if exists run_jobs_select on public.run_jobs;
create policy run_jobs_select on public.run_jobs for select using (auth.uid() = user_id);
drop policy if exists run_jobs_insert on public.run_jobs;
create policy run_jobs_insert on public.run_jobs for insert with check (auth.uid() = user_id);
drop policy if exists run_jobs_update on public.run_jobs;
create policy run_jobs_update on public.run_jobs for update using (auth.uid() = user_id);
drop policy if exists run_jobs_delete on public.run_jobs;
create policy run_jobs_delete on public.run_jobs for delete using (auth.uid() = user_id);

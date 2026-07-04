-- AI : run job progress rows must be scoped per user — prevents cross-tenant job reads/writes.

create table if not exists public.run_jobs (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  data jsonb not null default '{}',
  updated_at bigint not null default 0
);

alter table public.run_jobs add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.run_jobs enable row level security;

drop policy if exists run_jobs_select on public.run_jobs;
create policy run_jobs_select on public.run_jobs
  for select using (auth.uid() = user_id);

drop policy if exists run_jobs_insert on public.run_jobs;
create policy run_jobs_insert on public.run_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists run_jobs_update on public.run_jobs;
create policy run_jobs_update on public.run_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists run_jobs_delete on public.run_jobs;
create policy run_jobs_delete on public.run_jobs
  for delete using (auth.uid() = user_id);

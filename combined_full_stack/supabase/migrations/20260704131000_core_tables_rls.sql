-- AI : core user data tables predate repo migrations — version full owner-scoped RLS policies.

alter table if exists public.projects enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table if exists public.docs enable row level security;

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs
  for select using (auth.uid() = user_id);

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs
  for insert with check (auth.uid() = user_id);

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs
  for delete using (auth.uid() = user_id);

alter table if exists public.runs enable row level security;

drop policy if exists runs_select on public.runs;
create policy runs_select on public.runs
  for select using (auth.uid() = user_id);

drop policy if exists runs_insert on public.runs;
create policy runs_insert on public.runs
  for insert with check (auth.uid() = user_id);

drop policy if exists runs_update on public.runs;
create policy runs_update on public.runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists runs_delete on public.runs;
create policy runs_delete on public.runs
  for delete using (auth.uid() = user_id);

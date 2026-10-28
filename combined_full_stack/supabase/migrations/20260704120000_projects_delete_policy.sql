-- AI : projects table predates repo migrations — ensure signed-in owners can DELETE rows.
-- AI : without this policy Supabase returns 204 with 0 rows deleted and the app silently "succeeds".
alter table if exists public.projects enable row level security;

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete using (auth.uid() = user_id);

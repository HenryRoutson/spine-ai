-- AI : team shared-pointer model — projects/docs/runs stay on the owner's rows; team_id is the share pointer.
-- AI : Realtime publishes those tables so clients resync when another member mutates a shared project.

-- AI : team members can read runs that point at a team-shared project (any member's run on that project_id).
drop policy if exists runs_select on public.runs;
create policy runs_select on public.runs
  for select using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = runs.project_id
        and p.team_id is not null
        and public.is_team_member(p.team_id)
    )
  );

-- AI : members may update notes/test on their own runs only — keep write owner-scoped.
drop policy if exists runs_update on public.runs;
create policy runs_update on public.runs
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- AI : enable postgres_changes for authenticated clients (RLS still filters payloads).
do $$
begin
  alter publication supabase_realtime add table public.projects;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.docs;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.runs;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.team_members;
exception
  when duplicate_object then null;
end $$;

-- AI : FULL replica identity so UPDATE/DELETE realtime payloads include old row keys under RLS.
alter table public.projects replica identity full;
alter table public.docs replica identity full;
alter table public.runs replica identity full;
alter table public.team_members replica identity full;

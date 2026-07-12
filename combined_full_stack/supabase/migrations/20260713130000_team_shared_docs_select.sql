-- AI : team members can read docs from users who share projects with their team.
-- AI : TODO — tighten to docs referenced by shared projects only (currently all owner docs).

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs
  for select using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects p
      inner join public.team_members tm on tm.team_id = p.team_id and tm.user_id = auth.uid()
      where p.user_id = docs.user_id
        and p.team_id is not null
    )
  );

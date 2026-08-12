-- AI : team members can read assistant chats on shared projects; writes stay owner-scoped.
drop policy if exists assistant_chats_select on public.assistant_chats;
create policy assistant_chats_select on public.assistant_chats
  for select using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = assistant_chats.project_id
        and p.team_id is not null
        and public.is_team_member(p.team_id)
    )
  );

-- AI : team-scoped secrets — members resolve at runtime; values never returned to non-admins via API.
create table if not exists public.team_secrets (
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  value text not null,
  hint text not null default '',
  updated_at bigint not null,
  updated_by uuid references auth.users (id) on delete set null,
  primary key (team_id, name),
  constraint team_secrets_name_format check (name ~ '^[A-Z][A-Z0-9_]{0,127}$')
);

alter table public.team_secrets enable row level security;

-- AI : members may see name/hint only via API stripping; RLS still scopes rows to membership.
drop policy if exists team_secrets_member_select on public.team_secrets;
create policy team_secrets_member_select on public.team_secrets
  for select using (
    exists (
      select 1 from public.team_members m
      where m.team_id = team_secrets.team_id and m.user_id = auth.uid()
    )
  );

drop policy if exists team_secrets_admin_write on public.team_secrets;
create policy team_secrets_admin_write on public.team_secrets
  for all using (
    exists (
      select 1 from public.team_members m
      where m.team_id = team_secrets.team_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.team_members m
      where m.team_id = team_secrets.team_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- AI : enterprise teams — shared workspaces, member roles, email invites, team-scoped projects.

create table if not exists public.teams (
  id text primary key,
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  created_by uuid not null references auth.users (id) on delete restrict,
  billing_owner_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id text not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_id_idx on public.team_members (user_id);

create table if not exists public.team_invites (
  token text primary key,
  team_id text not null references public.teams (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);

create index if not exists team_invites_team_id_idx on public.team_invites (team_id);
create index if not exists team_invites_email_idx on public.team_invites (lower(email));

alter table if exists public.projects add column if not exists team_id text references public.teams (id) on delete set null;
create index if not exists projects_team_id_idx on public.projects (team_id) where team_id is not null;

-- AI : membership helper — used by RLS policies below.
create or replace function public.is_team_member(p_team_id text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = p_user_id
  );
$$;

create or replace function public.team_role(p_team_id text, p_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tm.role
  from public.team_members tm
  where tm.team_id = p_team_id
    and tm.user_id = p_user_id
  limit 1;
$$;

revoke all on function public.is_team_member(text, uuid) from public;
grant execute on function public.is_team_member(text, uuid) to authenticated;

revoke all on function public.team_role(text, uuid) from public;
grant execute on function public.team_role(text, uuid) to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated
  using (public.is_team_member(id));

drop policy if exists teams_insert on public.teams;
create policy teams_insert on public.teams
  for insert to authenticated
  with check (auth.uid() = created_by and auth.uid() = billing_owner_id);

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams
  for update to authenticated
  using (public.team_role(id) in ('owner', 'admin'))
  with check (public.team_role(id) in ('owner', 'admin'));

drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams
  for delete to authenticated
  using (public.team_role(id) = 'owner');

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
  for insert to authenticated
  with check (
    public.team_role(team_id) in ('owner', 'admin')
    or (user_id = auth.uid() and role = 'owner')
  );

drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members
  for update to authenticated
  using (public.team_role(team_id) in ('owner', 'admin'))
  with check (public.team_role(team_id) in ('owner', 'admin'));

drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members
  for delete to authenticated
  using (
    public.team_role(team_id) in ('owner', 'admin')
    or user_id = auth.uid()
  );

drop policy if exists team_invites_select on public.team_invites;
create policy team_invites_select on public.team_invites
  for select to authenticated
  using (public.team_role(team_id) in ('owner', 'admin'));

drop policy if exists team_invites_insert on public.team_invites;
create policy team_invites_insert on public.team_invites
  for insert to authenticated
  with check (public.team_role(team_id) in ('owner', 'admin'));

drop policy if exists team_invites_delete on public.team_invites;
create policy team_invites_delete on public.team_invites
  for delete to authenticated
  using (public.team_role(team_id) in ('owner', 'admin'));

-- AI : team members can read shared projects; only owner/admin or project owner may write.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (
    auth.uid() = user_id
    or (
      team_id is not null
      and public.team_role(team_id) in ('owner', 'admin')
    )
  )
  with check (
    auth.uid() = user_id
    or (
      team_id is not null
      and public.team_role(team_id) in ('owner', 'admin')
    )
  );

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete using (
    auth.uid() = user_id
    or (
      team_id is not null
      and public.team_role(team_id) in ('owner', 'admin')
    )
  );

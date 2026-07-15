-- AI : core user data tables predate repo migrations — baseline for local Supabase bootstrap.

create table if not exists public.projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create index if not exists projects_user_id_idx on public.projects (user_id);

create table if not exists public.docs (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  type text not null,
  label text not null default '',
  size_kb int not null default 1,
  uploaded_at bigint not null,
  preview text not null default '',
  content text not null default '',
  primary key (user_id, id)
);

create index if not exists docs_user_id_uploaded_at_idx
  on public.docs (user_id, uploaded_at desc);

create table if not exists public.runs (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  project_id text not null,
  started_at bigint not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create index if not exists runs_user_id_started_at_idx
  on public.runs (user_id, started_at desc);

create index if not exists runs_user_project_idx
  on public.runs (user_id, project_id);

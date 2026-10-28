-- AI : rrweb session replay — DOM recordings for ops debugging (disclosed in Privacy Policy).

create table if not exists public.session_replay_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  project_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  event_count int not null default 0,
  chunk_count int not null default 0,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists session_replay_sessions_user_started_idx
  on public.session_replay_sessions (user_id, started_at desc);

create table if not exists public.session_replay_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.session_replay_sessions (id) on delete cascade,
  chunk_index int not null,
  events jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, chunk_index)
);

create index if not exists session_replay_chunks_session_idx
  on public.session_replay_chunks (session_id, chunk_index);

alter table public.session_replay_sessions enable row level security;
alter table public.session_replay_chunks enable row level security;

drop policy if exists session_replay_sessions_insert on public.session_replay_sessions;
create policy session_replay_sessions_insert on public.session_replay_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists session_replay_sessions_update on public.session_replay_sessions;
create policy session_replay_sessions_update on public.session_replay_sessions
  for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists session_replay_sessions_select on public.session_replay_sessions;
create policy session_replay_sessions_select on public.session_replay_sessions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists session_replay_chunks_insert on public.session_replay_chunks;
create policy session_replay_chunks_insert on public.session_replay_chunks
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.session_replay_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists session_replay_chunks_select on public.session_replay_chunks;
create policy session_replay_chunks_select on public.session_replay_chunks
  for select to authenticated
  using (
    exists (
      select 1
      from public.session_replay_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

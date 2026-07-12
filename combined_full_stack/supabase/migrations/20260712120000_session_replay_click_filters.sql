-- AI : denormalised click/page/component indexes for ops replay sort+filter.

alter table public.session_replay_sessions
  add column if not exists click_count int not null default 0;

alter table public.session_replay_sessions
  add column if not exists pages text[] not null default '{}'::text[];

alter table public.session_replay_sessions
  add column if not exists clicked_components text[] not null default '{}'::text[];

create index if not exists session_replay_sessions_click_count_idx
  on public.session_replay_sessions (click_count desc, started_at desc);

create index if not exists session_replay_sessions_pages_gin
  on public.session_replay_sessions using gin (pages);

create index if not exists session_replay_sessions_clicked_components_gin
  on public.session_replay_sessions using gin (clicked_components);

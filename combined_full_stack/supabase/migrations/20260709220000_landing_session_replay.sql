-- AI : landing-page rrweb sessions — anonymous visitors (nullable user_id) + source tag.

alter table public.session_replay_sessions
  alter column user_id drop not null;

alter table public.session_replay_sessions
  add column if not exists source text not null default 'app';

alter table public.session_replay_sessions
  add column if not exists demo_email text;

alter table public.session_replay_sessions
  add column if not exists ip_hash text;

alter table public.session_replay_sessions
  drop constraint if exists session_replay_sessions_source_check;

alter table public.session_replay_sessions
  add constraint session_replay_sessions_source_check
  check (source in ('app', 'landing'));

create index if not exists session_replay_sessions_source_started_idx
  on public.session_replay_sessions (source, started_at desc);

create index if not exists session_replay_sessions_demo_email_idx
  on public.session_replay_sessions (demo_email)
  where demo_email is not null;

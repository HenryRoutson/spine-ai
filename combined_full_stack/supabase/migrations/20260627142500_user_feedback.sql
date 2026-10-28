-- AI : in-app user feedback — one row per submission with timestamp and auth user.
create table if not exists public.user_feedback (
  id text not null,
  user_id uuid not null default auth.uid(),
  user_email text,
  message text not null,
  created_at bigint not null,
  primary key (user_id, id)
);

create index if not exists user_feedback_created_at_idx
  on public.user_feedback (created_at desc);

alter table public.user_feedback enable row level security;

drop policy if exists user_feedback_select on public.user_feedback;
create policy user_feedback_select on public.user_feedback
  for select using (auth.uid() = user_id);

drop policy if exists user_feedback_insert on public.user_feedback;
create policy user_feedback_insert on public.user_feedback
  for insert with check (auth.uid() = user_id);

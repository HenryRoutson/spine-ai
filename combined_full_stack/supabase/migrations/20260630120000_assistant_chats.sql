-- AI : persisted project-assistant chat sessions — one row per conversation per user/project.
create table if not exists public.assistant_chats (
  id text not null,
  user_id uuid not null default auth.uid(),
  project_id text not null,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  primary key (user_id, id)
);

create index if not exists assistant_chats_project_updated_idx
  on public.assistant_chats (user_id, project_id, updated_at desc);

alter table public.assistant_chats enable row level security;

drop policy if exists assistant_chats_select on public.assistant_chats;
create policy assistant_chats_select on public.assistant_chats
  for select using (auth.uid() = user_id);

drop policy if exists assistant_chats_insert on public.assistant_chats;
create policy assistant_chats_insert on public.assistant_chats
  for insert with check (auth.uid() = user_id);

drop policy if exists assistant_chats_update on public.assistant_chats;
create policy assistant_chats_update on public.assistant_chats
  for update using (auth.uid() = user_id);

drop policy if exists assistant_chats_delete on public.assistant_chats;
create policy assistant_chats_delete on public.assistant_chats
  for delete using (auth.uid() = user_id);

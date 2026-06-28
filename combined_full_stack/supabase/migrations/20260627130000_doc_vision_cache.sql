-- AI : vision OCR results — separate from docs.content (built-in PDF/text parser at upload).
create table if not exists public.doc_vision_cache (
  cache_key text not null,
  doc_id text not null,
  model text not null,
  prompt text not null default '',
  purpose text not null default '',
  content text not null,
  created_at bigint not null,
  user_id uuid not null default auth.uid(),
  primary key (user_id, cache_key)
);

create index if not exists doc_vision_cache_user_doc_idx
  on public.doc_vision_cache (user_id, doc_id);

alter table public.doc_vision_cache enable row level security;

drop policy if exists doc_vision_cache_select on public.doc_vision_cache;
create policy doc_vision_cache_select on public.doc_vision_cache
  for select using (auth.uid() = user_id);

drop policy if exists doc_vision_cache_insert on public.doc_vision_cache;
create policy doc_vision_cache_insert on public.doc_vision_cache
  for insert with check (auth.uid() = user_id);

drop policy if exists doc_vision_cache_update on public.doc_vision_cache;
create policy doc_vision_cache_update on public.doc_vision_cache
  for update using (auth.uid() = user_id);

drop policy if exists doc_vision_cache_delete on public.doc_vision_cache;
create policy doc_vision_cache_delete on public.doc_vision_cache
  for delete using (auth.uid() = user_id);

-- AI : built-in parser results (PDF.js / plain decode) — keyed by file bytes hash, not vision OCR.
create table if not exists public.doc_parser_cache (
  cache_key text not null,
  file_hash text not null,
  doc_id text not null,
  parser text not null,
  content text not null,
  created_at bigint not null,
  user_id uuid not null default auth.uid(),
  primary key (user_id, cache_key)
);

create index if not exists doc_parser_cache_user_doc_idx
  on public.doc_parser_cache (user_id, doc_id);

create index if not exists doc_parser_cache_user_file_idx
  on public.doc_parser_cache (user_id, file_hash);

alter table public.doc_parser_cache enable row level security;

drop policy if exists doc_parser_cache_select on public.doc_parser_cache;
create policy doc_parser_cache_select on public.doc_parser_cache
  for select using (auth.uid() = user_id);

drop policy if exists doc_parser_cache_insert on public.doc_parser_cache;
create policy doc_parser_cache_insert on public.doc_parser_cache
  for insert with check (auth.uid() = user_id);

drop policy if exists doc_parser_cache_update on public.doc_parser_cache;
create policy doc_parser_cache_update on public.doc_parser_cache
  for update using (auth.uid() = user_id);

drop policy if exists doc_parser_cache_delete on public.doc_parser_cache;
create policy doc_parser_cache_delete on public.doc_parser_cache
  for delete using (auth.uid() = user_id);

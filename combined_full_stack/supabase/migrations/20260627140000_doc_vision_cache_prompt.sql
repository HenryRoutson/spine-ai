-- AI : backfill for existing doc_vision_cache installs created before prompt/purpose columns.
alter table public.doc_vision_cache add column if not exists prompt text not null default '';
alter table public.doc_vision_cache add column if not exists purpose text not null default '';

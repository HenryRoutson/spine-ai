-- AI : landing calls — store full user task + tag/build metadata (preview alone was too truncated).

alter table public.landing_page_calls
  add column if not exists prompt_text text,
  add column if not exists tag text not null default 'build-pipeline',
  add column if not exists build_id text,
  add column if not exists project_name text;

-- AI : backfill from preview where we never stored the full prompt.
update public.landing_page_calls
set prompt_text = prompt_preview
where prompt_text is null;

alter table public.landing_page_calls
  alter column prompt_text set not null;

create index if not exists landing_page_calls_tag_created_at_idx
  on public.landing_page_calls (tag, created_at desc);

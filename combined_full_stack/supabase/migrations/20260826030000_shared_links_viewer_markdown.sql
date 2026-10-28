-- AI : optional public usage markdown on shared links — empty by default so project Docs stay private.
alter table public.shared_links
  add column if not exists viewer_markdown text not null default '';

comment on column public.shared_links.viewer_markdown is
  'Optional markdown shown on /run and /site pages (how to upload / what the pipeline does). Empty when the publisher did not opt in.';

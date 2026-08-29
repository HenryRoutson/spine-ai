-- AI : schedules pin a named function so cron runs that pipeline, not whichever is active in the editor.

alter table public.pipeline_schedules
  add column if not exists function_id text not null default 'main';

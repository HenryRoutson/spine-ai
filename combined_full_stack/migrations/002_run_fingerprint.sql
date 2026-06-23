-- AI : indexed run fingerprint for dedup — hash of pipeline config + input doc content ids.
alter table public.runs add column if not exists fingerprint text;

create index if not exists runs_user_project_fingerprint_idx
  on public.runs (user_id, project_id, fingerprint)
  where fingerprint is not null;

-- AI : page-only sites store null — "" was the app-layer sentinel.
alter table public.shared_links
  alter column project_id drop not null;

update public.shared_links
  set project_id = null
  where project_id = '';

-- AI : per-website / per-project JSON rows behind hosted-app SQL steps.
create table if not exists public.app_sql_rows (
  scope text not null,
  table_name text not null,
  row_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (scope, table_name, row_id)
);

comment on table public.app_sql_rows is
  'Hosted-app SQL store. scope is site:{shared_link_id} or project:{project_id}. Writes go through pipeline SQL steps.';

alter table public.app_sql_rows enable row level security;

-- AI : public site visitors may read site:* rows (the shared number is public). Writes stay service-role.
drop policy if exists app_sql_rows_select_site on public.app_sql_rows;
create policy app_sql_rows_select_site
  on public.app_sql_rows
  for select
  using (scope like 'site:%');

grant select on public.app_sql_rows to anon, authenticated;
grant all on public.app_sql_rows to service_role;

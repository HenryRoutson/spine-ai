-- AI : n8n-style pipeline cron — pg_cron + pg_net tick the Next.js app so confidential/self-hosted
-- AI : Supabase can fire runs without Vercel cron or an external scheduler.

create table if not exists public.pipeline_schedules (
  id text not null,
  owner_id uuid not null,
  project_id text not null,
  name text not null,
  cron text not null,
  timezone text not null default 'UTC',
  enabled boolean not null default true,
  revoked boolean not null default false,
  default_model text,
  default_docs jsonb not null default '[]'::jsonb,
  next_run_at bigint not null,
  last_run_at bigint,
  last_claimed_at bigint,
  last_error text,
  run_count int not null default 0,
  created_at bigint not null,
  primary key (owner_id, id)
);

create index if not exists pipeline_schedules_due_idx
  on public.pipeline_schedules (next_run_at)
  where enabled and not revoked;

create index if not exists pipeline_schedules_project_idx
  on public.pipeline_schedules (owner_id, project_id)
  where not revoked;

alter table public.pipeline_schedules enable row level security;

drop policy if exists pipeline_schedules_owner_select on public.pipeline_schedules;
create policy pipeline_schedules_owner_select on public.pipeline_schedules
  for select using (auth.uid() = owner_id);

revoke all on public.pipeline_schedules from public;
revoke all on public.pipeline_schedules from anon, authenticated;
grant select on public.pipeline_schedules to authenticated;
grant all on public.pipeline_schedules to service_role;

-- AI : singleton tick target — service_role only. pg_cron reads tick_url + secret and POSTs.
create table if not exists public.pipeline_schedule_runtime (
  id int primary key default 1 check (id = 1),
  tick_url text,
  tick_secret text,
  last_tick_at bigint,
  cron_job_ready boolean not null default false
);

alter table public.pipeline_schedule_runtime enable row level security;
revoke all on public.pipeline_schedule_runtime from public;
revoke all on public.pipeline_schedule_runtime from anon, authenticated;
grant all on public.pipeline_schedule_runtime to service_role;

insert into public.pipeline_schedule_runtime (id)
values (1)
on conflict (id) do nothing;

do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron not available: %', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    execute $fn$
      create or replace function public.invoke_pipeline_schedule_tick()
      returns bigint
      language plpgsql
      security definer
      set search_path = public, extensions, net
      as $body$
      declare
        cfg public.pipeline_schedule_runtime%rowtype;
        request_id bigint;
      begin
        select * into cfg from public.pipeline_schedule_runtime where id = 1;
        if cfg.tick_url is null or cfg.tick_url = '' or cfg.tick_secret is null or cfg.tick_secret = '' then
          return null;
        end if;
        select net.http_post(
          url := cfg.tick_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || cfg.tick_secret
          ),
          body := jsonb_build_object('source', 'pg_cron')
        ) into request_id;
        return request_id;
      end;
      $body$;
    $fn$;
    revoke all on function public.invoke_pipeline_schedule_tick() from public;
    grant execute on function public.invoke_pipeline_schedule_tick() to postgres, service_role;
  end if;
end $$;

create or replace function public.ensure_pipeline_schedule_tick_job()
returns boolean
language plpgsql
security definer
set search_path = public, extensions, cron
as $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return false;
  end if;
  if not exists (select 1 from pg_proc where proname = 'invoke_pipeline_schedule_tick') then
    return false;
  end if;
  if not exists (select 1 from cron.job where jobname = 'spine-pipeline-schedules-tick') then
    perform cron.schedule(
      'spine-pipeline-schedules-tick',
      '* * * * *',
      $cron$select public.invoke_pipeline_schedule_tick()$cron$
    );
  end if;
  update public.pipeline_schedule_runtime set cron_job_ready = true where id = 1;
  return true;
end;
$$;

revoke all on function public.ensure_pipeline_schedule_tick_job() from public;
grant execute on function public.ensure_pipeline_schedule_tick_job() to service_role;

do $$
begin
  perform public.ensure_pipeline_schedule_tick_job();
exception when others then
  raise notice 'could not schedule pg_cron job: %', sqlerrm;
end $$;

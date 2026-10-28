-- AI : SQL seed hook for `supabase db reset` — bundled docs load via `npm run sync-seeds` into public.seed_docs.

-- AI : local Postgres does not auto-grant DML on CLI-migration-created tables, so every query is
-- AI : `permission denied` on a fresh local DB. The hosted project has these grants out-of-band.
-- AI : RLS still scopes rows — these are table-level privileges the Supabase roles need to reach RLS.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- AI : cover any tables/sequences/functions created after this seed runs.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

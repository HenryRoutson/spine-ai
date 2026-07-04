-- AI : LOCAL-ONLY seed (run by `supabase db reset` / fresh `supabase start`; NOT applied by `db push`).
-- AI : This local Postgres does not auto-grant DML on CLI-migration-created tables to the
-- AI : anon/authenticated roles, so every PostgREST query hits "permission denied" before RLS
-- AI : even runs. The hosted project was provisioned via the dashboard (which auto-grants), so
-- AI : these grants are only needed to make the local stack behave like production. RLS policies
-- AI : defined in the migrations still enforce per-user row access on top of these table grants.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- AI : keep future tables working in local dev without re-seeding.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

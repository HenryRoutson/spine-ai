-- AI : deploy/billing tables are server-writable only — owners may read their rows, never mutate spend or keys via anon client.

alter table if exists public.shared_links enable row level security;
alter table if exists public.hosted_apis enable row level security;
alter table if exists public.user_billing_keys enable row level security;

drop policy if exists shared_links_owner_all on public.shared_links;
drop policy if exists shared_links_owner_select on public.shared_links;
create policy shared_links_owner_select on public.shared_links
  for select to authenticated
  using (auth.uid() = owner_id);

drop policy if exists hosted_apis_owner_all on public.hosted_apis;
drop policy if exists hosted_apis_owner_select on public.hosted_apis;
create policy hosted_apis_owner_select on public.hosted_apis
  for select to authenticated
  using (auth.uid() = owner_id);

drop policy if exists user_billing_keys_owner_all on public.user_billing_keys;
drop policy if exists user_billing_keys_owner_select on public.user_billing_keys;
create policy user_billing_keys_owner_select on public.user_billing_keys
  for select to authenticated
  using (auth.uid() = user_id);

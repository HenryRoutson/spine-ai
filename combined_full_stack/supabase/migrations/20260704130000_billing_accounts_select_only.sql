-- AI : billing balance must never be writable from the browser Supabase client (anon key is public).
drop policy if exists "own rows" on public.billing_accounts;

drop policy if exists billing_accounts_select on public.billing_accounts;
create policy billing_accounts_select on public.billing_accounts
  for select to authenticated
  using (auth.uid() = user_id);

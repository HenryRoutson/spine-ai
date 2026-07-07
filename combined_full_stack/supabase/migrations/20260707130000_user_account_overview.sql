-- AI : admin view — join auth email with testing flag for Supabase Studio browsing.

create or replace view public.user_account_overview as
select
  u.id as user_id,
  u.email,
  coalesce(p.is_testing_account, false) as is_testing_account,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at,
  u.created_at as user_created_at
from auth.users u
left join public.user_profiles p on p.user_id = u.id;

comment on view public.user_account_overview is
  'Email + is_testing_account for admin review in Supabase Studio. Not exposed to anon/authenticated API clients.';

revoke all on public.user_account_overview from public;
revoke all on public.user_account_overview from anon, authenticated;
grant select on public.user_account_overview to service_role;

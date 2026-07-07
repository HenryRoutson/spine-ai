-- AI : per-user profile flags — testing accounts are admin-tagged, not self-declared.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_testing_account boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (auth.uid() = user_id);

-- AI : backfill existing auth users so every account has a profile row.
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

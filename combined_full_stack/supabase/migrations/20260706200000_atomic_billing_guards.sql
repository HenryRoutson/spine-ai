-- AI : atomic budget reservation — closes TOCTOU on landing demo + hosted API spend limits.

create or replace function public.try_reserve_landing_budget(p_reserve_cents numeric)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update landing_page_budget
    set spent_cents = spent_cents + p_reserve_cents,
        updated_at = now()
    where id = 'landing'
      and spent_cents + p_reserve_cents <= budget_cents
    returning id
  )
  select exists(select 1 from updated);
$$;

create or replace function public.adjust_landing_budget_spent(p_delta_cents numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update landing_page_budget
  set spent_cents = greatest(0, spent_cents + p_delta_cents),
      updated_at = now()
  where id = 'landing';
$$;

create or replace function public.try_reserve_hosted_api_spend(p_api_id text, p_cents numeric)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update hosted_apis
    set total_spend_cents = total_spend_cents + p_cents
    where id = p_api_id
      and not revoked
      and (spend_limit_cents is null or total_spend_cents + p_cents <= spend_limit_cents)
    returning id
  )
  select exists(select 1 from updated);
$$;

create or replace function public.adjust_hosted_api_spend(p_api_id text, p_delta_cents numeric)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update hosted_apis
    set total_spend_cents = greatest(0, total_spend_cents + p_delta_cents)
    where id = p_api_id
      and not revoked
      and (
        spend_limit_cents is null
        or greatest(0, total_spend_cents + p_delta_cents) <= spend_limit_cents
      )
    returning id
  )
  select exists(select 1 from updated);
$$;

create or replace function public.try_reserve_shared_link_spend(p_link_id text, p_cents numeric)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update shared_links
    set total_spend_cents = total_spend_cents + p_cents
    where id = p_link_id
      and not revoked
      and (spend_limit_cents is null or total_spend_cents + p_cents <= spend_limit_cents)
    returning id
  )
  select exists(select 1 from updated);
$$;

create or replace function public.adjust_shared_link_spend(p_link_id text, p_delta_cents numeric)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update shared_links
    set total_spend_cents = greatest(0, total_spend_cents + p_delta_cents)
    where id = p_link_id
      and not revoked
      and (
        spend_limit_cents is null
        or greatest(0, total_spend_cents + p_delta_cents) <= spend_limit_cents
      )
    returning id
  )
  select exists(select 1 from updated);
$$;

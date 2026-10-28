-- AI : dated platform markup schedule + denormalised profit/exposure views for ops dashboard.

create table if not exists public.platform_markup_schedule (
  id uuid primary key default gen_random_uuid(),
  markup_multiple numeric(8, 4) not null check (markup_multiple >= 1),
  effective_from timestamptz not null,
  effective_until timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint platform_markup_schedule_range_chk check (
    effective_until is null or effective_until > effective_from
  )
);

create index if not exists platform_markup_schedule_effective_idx
  on public.platform_markup_schedule (effective_from desc);

alter table public.platform_markup_schedule enable row level security;

-- AI : ops/admin only — no authenticated client access.
revoke all on public.platform_markup_schedule from public;
revoke all on public.platform_markup_schedule from anon, authenticated;
grant select on public.platform_markup_schedule to service_role;

insert into public.platform_markup_schedule (markup_multiple, effective_from, note)
select 1.0, '2026-01-01 00:00:00+00'::timestamptz, 'Launch — pass-through LLM cost (no platform markup)'
where not exists (select 1 from public.platform_markup_schedule);

create or replace function public.markup_multiple_at(p_at timestamptz default now())
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select s.markup_multiple
      from public.platform_markup_schedule s
      where s.effective_from <= p_at
        and (s.effective_until is null or p_at < s.effective_until)
      order by s.effective_from desc
      limit 1
    ),
    1.0
  );
$$;

revoke all on function public.markup_multiple_at(timestamptz) from public;
grant execute on function public.markup_multiple_at(timestamptz) to service_role;

create or replace view public.user_billing_profit_overview as
with credit_totals as (
  select
    bfl.user_id,
    coalesce(
      sum(case when bfl.flow_type = 'signup_credit' then bfl.amount_cents else 0 end),
      0
    ) as free_credits_granted_cents,
    coalesce(
      sum(
        case
          when bfl.flow_type in ('checkout_credit', 'invoice_credit') then bfl.amount_cents
          else 0
        end
      ),
      0
    ) as paid_credits_cents
  from public.billing_flow_ledger bfl
  where bfl.amount_cents > 0
  group by bfl.user_id
),
usage_totals as (
  select
    bfl.user_id,
    coalesce(sum(abs(bfl.amount_cents)), 0) as total_charged_cents,
    coalesce(
      sum(abs(bfl.amount_cents) / public.markup_multiple_at(bfl.created_at)),
      0
    ) as total_llm_provider_cost_cents
  from public.billing_flow_ledger bfl
  where bfl.amount_cents < 0
    and bfl.flow_type like 'usage_%'
  group by bfl.user_id
),
current_markup as (
  select public.markup_multiple_at(now()) as markup_multiple
)
select
  ba.user_id,
  u.email,
  ba.balance_cents,
  ba.total_billed_cents,
  ba.total_usage_cents,
  coalesce(ct.free_credits_granted_cents, 1000::numeric) as free_credits_granted_cents,
  coalesce(ct.paid_credits_cents, 0::numeric) as paid_credits_cents,
  coalesce(ut.total_charged_cents, ba.total_usage_cents, 0::numeric) as total_charged_cents,
  coalesce(
    ut.total_llm_provider_cost_cents,
    ba.total_usage_cents / cm.markup_multiple,
    0::numeric
  ) as total_llm_provider_cost_cents,
  coalesce(ut.total_charged_cents, ba.total_usage_cents, 0::numeric)
    - coalesce(
      ut.total_llm_provider_cost_cents,
      ba.total_usage_cents / cm.markup_multiple,
      0::numeric
    ) as total_platform_margin_cents,
  greatest(ba.balance_cents, 0::numeric) as unused_balance_cents,
  greatest(ba.balance_cents, 0::numeric) / cm.markup_multiple as free_credit_llm_exposure_cents,
  coalesce(ct.paid_credits_cents, 0::numeric)
    - coalesce(
      ut.total_llm_provider_cost_cents,
      ba.total_usage_cents / cm.markup_multiple,
      0::numeric
    ) as current_net_paid_vs_llm_cents,
  coalesce(ct.paid_credits_cents, 0::numeric)
    - coalesce(
      ut.total_llm_provider_cost_cents,
      ba.total_usage_cents / cm.markup_multiple,
      0::numeric
    )
    - (greatest(ba.balance_cents, 0::numeric) / cm.markup_multiple) as worst_case_net_cents,
  cm.markup_multiple as current_markup_multiple,
  round((cm.markup_multiple - 1) * 100, 2) as current_markup_pct,
  (
    coalesce(ct.paid_credits_cents, 0::numeric)
      - coalesce(
        ut.total_llm_provider_cost_cents,
        ba.total_usage_cents / cm.markup_multiple,
        0::numeric
      )
      - (greatest(ba.balance_cents, 0::numeric) / cm.markup_multiple)
  ) < 0 as worst_case_in_the_red
from public.billing_accounts ba
left join public.user_account_overview u on u.user_id = ba.user_id
left join credit_totals ct on ct.user_id = ba.user_id
left join usage_totals ut on ut.user_id = ba.user_id
cross join current_markup cm;

comment on view public.user_billing_profit_overview is
  'Per-user denormalised billing P&L: charged vs straight LLM provider cost, markup margin, and free-credit worst-case exposure.';

revoke all on public.user_billing_profit_overview from public;
revoke all on public.user_billing_profit_overview from anon, authenticated;
grant select on public.user_billing_profit_overview to service_role;

create or replace view public.platform_billing_exposure as
select
  count(*)::int as user_count,
  max(current_markup_multiple) as current_markup_multiple,
  max(current_markup_pct) as current_markup_pct,
  coalesce(sum(paid_credits_cents), 0::numeric) as total_paid_credits_cents,
  coalesce(sum(free_credits_granted_cents), 0::numeric) as total_free_credits_granted_cents,
  coalesce(sum(total_charged_cents), 0::numeric) as total_charged_cents,
  coalesce(sum(total_llm_provider_cost_cents), 0::numeric) as total_llm_provider_cost_cents,
  coalesce(sum(total_platform_margin_cents), 0::numeric) as total_platform_margin_cents,
  coalesce(sum(unused_balance_cents), 0::numeric) as total_unused_balance_cents,
  coalesce(sum(free_credit_llm_exposure_cents), 0::numeric) as total_free_credit_exposure_cents,
  coalesce(sum(current_net_paid_vs_llm_cents), 0::numeric) as current_net_paid_vs_llm_cents,
  coalesce(sum(worst_case_net_cents), 0::numeric) as worst_case_net_cents,
  bool_or(worst_case_in_the_red) as any_user_worst_case_red,
  coalesce(sum(worst_case_net_cents), 0::numeric) < 0 as platform_worst_case_in_the_red
from public.user_billing_profit_overview;

comment on view public.platform_billing_exposure is
  'Platform-wide billing buffer: aggregate paid revenue, straight LLM cost, unused balances, and worst-case exposure if all free credit is spent at provider rates.';

revoke all on public.platform_billing_exposure from public;
revoke all on public.platform_billing_exposure from anon, authenticated;
grant select on public.platform_billing_exposure to service_role;

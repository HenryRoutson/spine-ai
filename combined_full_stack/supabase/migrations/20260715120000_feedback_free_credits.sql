-- AI : dated free-credit pricing (signup + feedback rewards) and feedback credit grants.

create table if not exists public.free_credit_schedule (
  id uuid primary key default gen_random_uuid(),
  credit_kind text not null check (credit_kind in ('signup', 'feedback')),
  amount_cents numeric(12, 4) not null check (amount_cents > 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint free_credit_schedule_range_chk check (
    effective_until is null or effective_until > effective_from
  )
);

create index if not exists free_credit_schedule_kind_effective_idx
  on public.free_credit_schedule (credit_kind, effective_from desc);

alter table public.free_credit_schedule enable row level security;

revoke all on public.free_credit_schedule from public;
revoke all on public.free_credit_schedule from anon, authenticated;
grant select on public.free_credit_schedule to service_role;

insert into public.free_credit_schedule (credit_kind, amount_cents, effective_from, note)
select 'signup', 1000, '2026-01-01 00:00:00+00'::timestamptz, 'Launch — $10 welcome credit'
where not exists (
  select 1 from public.free_credit_schedule where credit_kind = 'signup'
);

insert into public.free_credit_schedule (credit_kind, amount_cents, effective_from, note)
select 'feedback', 100, '2026-01-01 00:00:00+00'::timestamptz, 'Launch — $1 per qualifying feedback (100+ chars)'
where not exists (
  select 1 from public.free_credit_schedule where credit_kind = 'feedback'
);

create or replace function public.free_credit_cents_at(
  p_kind text,
  p_at timestamptz default now()
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select s.amount_cents
      from public.free_credit_schedule s
      where s.credit_kind = p_kind
        and s.effective_from <= p_at
        and (s.effective_until is null or p_at < s.effective_until)
      order by s.effective_from desc
      limit 1
    ),
    case p_kind
      when 'signup' then 1000::numeric
      when 'feedback' then 100::numeric
      else 0::numeric
    end
  );
$$;

revoke all on function public.free_credit_cents_at(text, timestamptz) from public;
grant execute on function public.free_credit_cents_at(text, timestamptz) to service_role;

-- AI : extend billing_credit_ledger for feedback promotional credits.
alter table public.billing_credit_ledger
  drop constraint if exists billing_credit_ledger_source_check;

alter table public.billing_credit_ledger
  add constraint billing_credit_ledger_source_check
  check (source in ('checkout', 'invoice', 'feedback'));

-- AI : extend billing_flow_ledger for feedback credit audit trail.
alter table public.billing_flow_ledger
  drop constraint if exists billing_flow_ledger_flow_type_check;

alter table public.billing_flow_ledger
  add constraint billing_flow_ledger_flow_type_check
  check (
    flow_type in (
      'signup_credit',
      'checkout_credit',
      'invoice_credit',
      'feedback_credit',
      'usage_run',
      'usage_assistant',
      'usage_hosted_api',
      'usage_shared_link',
      'usage_other'
    )
  );

alter table public.user_feedback
  add column if not exists credit_key text,
  add column if not exists credit_granted_cents numeric(12, 4);

create index if not exists user_feedback_credit_key_idx
  on public.user_feedback (credit_key)
  where credit_key is not null;

-- AI : include feedback_credit in free-credit liability views.
create or replace view public.user_billing_profit_overview as
with credit_totals as (
  select
    bfl.user_id,
    coalesce(
      sum(
        case
          when bfl.flow_type in ('signup_credit', 'feedback_credit') then bfl.amount_cents
          else 0
        end
      ),
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

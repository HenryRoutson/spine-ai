-- AI : atomic earnings withdrawal — closes TOCTOU on concurrent withdraw requests.

create or replace function public.withdraw_creator_earnings_to_credit(
  p_user_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earnings public.creator_earnings%rowtype;
  v_credit_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'insufficient_earnings';
  end if;

  update public.creator_earnings
  set balance_cents = balance_cents - p_amount,
      total_withdrawn_cents = total_withdrawn_cents + p_amount,
      updated_at = now()
  where user_id = p_user_id
    and balance_cents >= p_amount
  returning * into v_earnings;

  if not found then
    raise exception 'insufficient_earnings';
  end if;

  insert into public.billing_accounts (
    user_id,
    balance_cents,
    total_billed_cents,
    total_usage_cents,
    subscribed,
    credited_sessions
  )
  values (p_user_id, p_amount, 0, 0, false, '{}')
  on conflict (user_id) do update
  set balance_cents = public.billing_accounts.balance_cents + excluded.balance_cents
  returning balance_cents into v_credit_balance;

  return jsonb_build_object(
    'balanceCents', v_earnings.balance_cents,
    'totalEarnedCents', v_earnings.total_earned_cents,
    'totalWithdrawnCents', v_earnings.total_withdrawn_cents,
    'creditBalanceCents', v_credit_balance
  );
end;
$$;

revoke all on function public.withdraw_creator_earnings_to_credit(uuid, numeric) from public;

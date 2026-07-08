-- AI : SECURITY — SECURITY DEFINER functions default to EXECUTE granted to PUBLIC, so anon /
-- AI : authenticated clients could call them over PostgREST (.rpc()) and mutate global landing budget,
-- AI : hosted-API spend, and shared-link spend counters, bypassing RLS. These are server-only helpers
-- AI : (invoked via the service-role admin client), so revoke from everyone and grant to service_role.
-- AI : TODO security — after db push, verify EXECUTE grants in prod (see audit SQL in combined_full_stack_spec).

revoke execute on function public.try_reserve_landing_budget(numeric) from public, anon, authenticated;
revoke execute on function public.adjust_landing_budget_spent(numeric) from public, anon, authenticated;
revoke execute on function public.try_reserve_hosted_api_spend(text, numeric) from public, anon, authenticated;
revoke execute on function public.adjust_hosted_api_spend(text, numeric) from public, anon, authenticated;
revoke execute on function public.try_reserve_shared_link_spend(text, numeric) from public, anon, authenticated;
revoke execute on function public.adjust_shared_link_spend(text, numeric) from public, anon, authenticated;

grant execute on function public.try_reserve_landing_budget(numeric) to service_role;
grant execute on function public.adjust_landing_budget_spent(numeric) to service_role;
grant execute on function public.try_reserve_hosted_api_spend(text, numeric) to service_role;
grant execute on function public.adjust_hosted_api_spend(text, numeric) to service_role;
grant execute on function public.try_reserve_shared_link_spend(text, numeric) to service_role;
grant execute on function public.adjust_shared_link_spend(text, numeric) to service_role;

-- AI : SECURITY — earnings withdrawal trusted p_user_id with no caller check. Add a defensive guard so
-- AI : even if a client could execute it, it can only ever withdraw for itself; the server (service_role)
-- AI : runs with auth.uid() = null and stays allowed. Also revoke from anon/authenticated explicitly.
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
  -- AI : allow only the server (no JWT) or the owning user; block cross-user withdrawal.
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'forbidden';
  end if;

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

revoke execute on function public.withdraw_creator_earnings_to_credit(uuid, numeric) from public, anon, authenticated;
grant execute on function public.withdraw_creator_earnings_to_credit(uuid, numeric) to service_role;

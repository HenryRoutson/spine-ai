import { createAdminClient } from "./supabase_admin";

export type platform_markup_row = {
  id: string;
  markupMultiple: number;
  markupPct: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  note: string | null;
};

export type user_profit_overview_row = {
  userId: string;
  email: string | null;
  balanceCents: number;
  freeCreditsGrantedCents: number;
  paidCreditsCents: number;
  totalChargedCents: number;
  totalLlmProviderCostCents: number;
  totalPlatformMarginCents: number;
  unusedBalanceCents: number;
  freeCreditLlmExposureCents: number;
  currentNetPaidVsLlmCents: number;
  worstCaseNetCents: number;
  currentMarkupMultiple: number;
  currentMarkupPct: number;
  worstCaseInTheRed: boolean;
};

export type platform_exposure_row = {
  userCount: number;
  currentMarkupMultiple: number;
  currentMarkupPct: number;
  totalPaidCreditsCents: number;
  totalFreeCreditsGrantedCents: number;
  totalChargedCents: number;
  totalLlmProviderCostCents: number;
  totalPlatformMarginCents: number;
  totalUnusedBalanceCents: number;
  totalFreeCreditExposureCents: number;
  currentNetPaidVsLlmCents: number;
  worstCaseNetCents: number;
  anyUserWorstCaseRed: boolean;
  platformWorstCaseInTheRed: boolean;
};

function num(v: unknown): number {
  return Number(v ?? 0);
}

export async function fetchPlatformMarkupSchedule(): Promise<platform_markup_row[]> {
  const admin = await createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("platform_markup_schedule")
    .select("id,markup_multiple,effective_from,effective_until,note")
    .order("effective_from", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => {
    const multiple = num(r.markup_multiple);
    return {
      id: r.id as string,
      markupMultiple: multiple,
      markupPct: +((multiple - 1) * 100).toFixed(2),
      effectiveFrom: r.effective_from as string,
      effectiveUntil: (r.effective_until as string | null) ?? null,
      note: (r.note as string | null) ?? null,
    };
  });
}

export async function fetchUserProfitOverview(): Promise<user_profit_overview_row[]> {
  const admin = await createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("user_billing_profit_overview").select("*");
  if (error || !data) return [];
  return data.map((r) => ({
    userId: r.user_id as string,
    email: (r.email as string | null) ?? null,
    balanceCents: num(r.balance_cents),
    freeCreditsGrantedCents: num(r.free_credits_granted_cents),
    paidCreditsCents: num(r.paid_credits_cents),
    totalChargedCents: num(r.total_charged_cents),
    totalLlmProviderCostCents: num(r.total_llm_provider_cost_cents),
    totalPlatformMarginCents: num(r.total_platform_margin_cents),
    unusedBalanceCents: num(r.unused_balance_cents),
    freeCreditLlmExposureCents: num(r.free_credit_llm_exposure_cents),
    currentNetPaidVsLlmCents: num(r.current_net_paid_vs_llm_cents),
    worstCaseNetCents: num(r.worst_case_net_cents),
    currentMarkupMultiple: num(r.current_markup_multiple),
    currentMarkupPct: num(r.current_markup_pct),
    worstCaseInTheRed: Boolean(r.worst_case_in_the_red),
  }));
}

export async function fetchPlatformExposure(): Promise<platform_exposure_row | null> {
  const admin = await createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("platform_billing_exposure").select("*").maybeSingle();
  if (error || !data) return null;
  return {
    userCount: Number(data.user_count ?? 0),
    currentMarkupMultiple: num(data.current_markup_multiple),
    currentMarkupPct: num(data.current_markup_pct),
    totalPaidCreditsCents: num(data.total_paid_credits_cents),
    totalFreeCreditsGrantedCents: num(data.total_free_credits_granted_cents),
    totalChargedCents: num(data.total_charged_cents),
    totalLlmProviderCostCents: num(data.total_llm_provider_cost_cents),
    totalPlatformMarginCents: num(data.total_platform_margin_cents),
    totalUnusedBalanceCents: num(data.total_unused_balance_cents),
    totalFreeCreditExposureCents: num(data.total_free_credit_exposure_cents),
    currentNetPaidVsLlmCents: num(data.current_net_paid_vs_llm_cents),
    worstCaseNetCents: num(data.worst_case_net_cents),
    anyUserWorstCaseRed: Boolean(data.any_user_worst_case_red),
    platformWorstCaseInTheRed: Boolean(data.platform_worst_case_in_the_red),
  };
}

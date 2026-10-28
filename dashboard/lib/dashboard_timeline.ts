import { createAdminClient } from "./supabase_admin";
import {
  fetchPlatformExposure,
  fetchPlatformMarkupSchedule,
  fetchUserProfitOverview,
  type platform_exposure_row,
  type platform_markup_row,
} from "./dashboard_exposure";

// AI : keep in sync with combined_full_stack/lib/billing_config.ts NEW_ACCOUNT_BALANCE_CENTS
const NEW_ACCOUNT_BALANCE_CENTS = 1000;

export type dashboard_timeline_event = {
  id: string;
  userId: string;
  userEmail: string | null;
  kind: "activity" | "billing";
  category: string;
  action: string;
  detail: Record<string, unknown>;
  projectId: string | null;
  amountCents: number | null;
  createdAt: string;
};

export type dashboard_user_summary = {
  userId: string;
  userEmail: string | null;
  balanceCents: number;
  totalBilledCents: number;
  totalUsageCents: number;
  paidCreditsCents: number;
  freeCreditsCents: number;
  netProfitCents: number;
  isAbusingFreeCredit: boolean;
  eventCount: number;
  lastActiveAt: string | null;
  totalLlmProviderCostCents: number;
  totalPlatformMarginCents: number;
  unusedBalanceCents: number;
  freeCreditLlmExposureCents: number;
  worstCaseNetCents: number;
  worstCaseInTheRed: boolean;
  currentMarkupPct: number;
};

export type dashboard_money_point = {
  day: string;
  moneyInCents: number;
  moneyOutCents: number;
  cumulativeInCents: number;
  cumulativeOutCents: number;
  netCents: number;
};

export type dashboard_timeline_stats = {
  users: dashboard_user_summary[];
  events: dashboard_timeline_event[];
  moneyFlow: dashboard_money_point[];
  exposure: platform_exposure_row | null;
  markupSchedule: platform_markup_row[];
  totals: {
    moneyInCents: number;
    moneyOutCents: number;
    freeCreditsCents: number;
    paidCreditsCents: number;
    netProfitCents: number;
    inTheGreen: boolean;
    errorCount: number;
    abuserCount: number;
    worstCaseNetCents: number;
    worstCaseInTheRed: boolean;
    freeCreditExposureCents: number;
    currentMarkupPct: number;
  };
};

const DAY_MS = 86_400_000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(dayKey(new Date(now.getTime() - i * DAY_MS)));
  }
  return out;
}

function emptyTimeline(): dashboard_timeline_stats {
  const days = lastNDays(14);
  return {
    users: [],
    events: [],
    moneyFlow: days.map((day) => ({
      day,
      moneyInCents: 0,
      moneyOutCents: 0,
      cumulativeInCents: 0,
      cumulativeOutCents: 0,
      netCents: 0,
    })),
    exposure: null,
    markupSchedule: [],
    totals: {
      moneyInCents: 0,
      moneyOutCents: 0,
      freeCreditsCents: 0,
      paidCreditsCents: 0,
      netProfitCents: 0,
      inTheGreen: true,
      errorCount: 0,
      abuserCount: 0,
      worstCaseNetCents: 0,
      worstCaseInTheRed: false,
      freeCreditExposureCents: 0,
      currentMarkupPct: 0,
    },
  };
}

function buildMoneyFlow(
  rows: { at: Date; amountCents: number }[],
  days = 14,
): dashboard_money_point[] {
  const keys = lastNDays(days);
  const daily = new Map(keys.map((k) => [k, { in: 0, out: 0 }]));
  for (const row of rows) {
    const k = dayKey(row.at);
    const slot = daily.get(k);
    if (!slot) continue;
    if (row.amountCents >= 0) slot.in += row.amountCents;
    else slot.out += Math.abs(row.amountCents);
  }
  let cumulativeIn = 0;
  let cumulativeOut = 0;
  return keys.map((day) => {
    const slot = daily.get(day)!;
    cumulativeIn += slot.in;
    cumulativeOut += slot.out;
    return {
      day,
      moneyInCents: +slot.in.toFixed(4),
      moneyOutCents: +slot.out.toFixed(4),
      cumulativeInCents: +cumulativeIn.toFixed(4),
      cumulativeOutCents: +cumulativeOut.toFixed(4),
      netCents: +(cumulativeIn - cumulativeOut).toFixed(4),
    };
  });
}

export async function fetchTimelineStats(
  userId?: string,
  days = 14,
): Promise<dashboard_timeline_stats> {
  const admin = await createAdminClient();
  if (!admin) return emptyTimeline();

  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  let activityQuery = admin
    .from("user_activity_events")
    .select("id,user_id,user_email,category,action,detail,project_id,cost_cents,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(userId ? 500 : 300);
  if (userId) activityQuery = activityQuery.eq("user_id", userId);

  let billingFlowQuery = admin
    .from("billing_flow_ledger")
    .select("id,user_id,user_email,flow_type,amount_cents,balance_after_cents,ref_id,detail,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (userId) billingFlowQuery = billingFlowQuery.eq("user_id", userId);

  const [activityRes, billingFlowRes, accountsRes, creditRes, overviewRes, profitRows, exposure, markupSchedule] =
    await Promise.all([
    activityQuery,
    billingFlowQuery,
    admin.from("billing_accounts").select("user_id,balance_cents,total_billed_cents,total_usage_cents"),
    admin
      .from("billing_credit_ledger")
      .select("user_id,amount_cents,source,created_at")
      .gte("created_at", since),
    admin.from("user_account_overview").select("user_id,email"),
    fetchUserProfitOverview(),
    fetchPlatformExposure(),
    fetchPlatformMarkupSchedule(),
  ]);

  const activityRows = activityRes.data ?? [];
  const billingRows = billingFlowRes.data ?? [];
  const accounts = accountsRes.data ?? [];
  const credits = creditRes.data ?? [];
  const emails = new Map(
    (overviewRes.data ?? []).map((r) => [r.user_id as string, r.email as string | null]),
  );

  const paidByUser = new Map<string, number>();
  const freeByUser = new Map<string, number>();
  for (const row of billingRows) {
    const uid = row.user_id as string;
    const amt = Number(row.amount_cents);
    if (row.flow_type === "signup_credit") {
      freeByUser.set(uid, (freeByUser.get(uid) ?? 0) + amt);
    } else if (row.flow_type === "checkout_credit" || row.flow_type === "invoice_credit") {
      paidByUser.set(uid, (paidByUser.get(uid) ?? 0) + amt);
    }
  }
  for (const row of credits) {
    const uid = row.user_id as string;
    paidByUser.set(uid, (paidByUser.get(uid) ?? 0) + Number(row.amount_cents));
  }

  const lastActive = new Map<string, string>();
  const eventCount = new Map<string, number>();
  for (const row of activityRows) {
    const uid = row.user_id as string;
    eventCount.set(uid, (eventCount.get(uid) ?? 0) + 1);
    const at = row.created_at as string;
    if (!lastActive.has(uid) || at > lastActive.get(uid)!) lastActive.set(uid, at);
  }

  const profitByUser = new Map(profitRows.map((r) => [r.userId, r]));

  const users: dashboard_user_summary[] = accounts.map((acc) => {
    const uid = acc.user_id as string;
    const profit = profitByUser.get(uid);
    const paidCreditsCents = profit?.paidCreditsCents ?? paidByUser.get(uid) ?? 0;
    const freeCreditsCents = profit?.freeCreditsGrantedCents ?? freeByUser.get(uid) ?? NEW_ACCOUNT_BALANCE_CENTS;
    const totalUsageCents = Number(acc.total_usage_cents ?? 0);
    const totalBilledCents = Number(acc.total_billed_cents ?? 0);
    const moneyIn = paidCreditsCents + freeCreditsCents;
    const netProfitCents = totalBilledCents - totalUsageCents;
    const isAbusingFreeCredit = totalUsageCents > moneyIn && paidCreditsCents <= 0;
    return {
      userId: uid,
      userEmail: profit?.email ?? emails.get(uid) ?? null,
      balanceCents: Number(acc.balance_cents),
      totalBilledCents,
      totalUsageCents,
      paidCreditsCents,
      freeCreditsCents,
      netProfitCents,
      isAbusingFreeCredit,
      eventCount: eventCount.get(uid) ?? 0,
      lastActiveAt: lastActive.get(uid) ?? null,
      totalLlmProviderCostCents: profit?.totalLlmProviderCostCents ?? totalUsageCents,
      totalPlatformMarginCents: profit?.totalPlatformMarginCents ?? 0,
      unusedBalanceCents: profit?.unusedBalanceCents ?? Math.max(0, Number(acc.balance_cents)),
      freeCreditLlmExposureCents: profit?.freeCreditLlmExposureCents ?? 0,
      worstCaseNetCents: profit?.worstCaseNetCents ?? 0,
      worstCaseInTheRed: profit?.worstCaseInTheRed ?? false,
      currentMarkupPct: profit?.currentMarkupPct ?? exposure?.currentMarkupPct ?? 0,
    };
  });

  const activityEvents: dashboard_timeline_event[] = activityRows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    userEmail: (r.user_email as string | null) ?? emails.get(r.user_id as string) ?? null,
    kind: "activity",
    category: r.category as string,
    action: r.action as string,
    detail: (r.detail as Record<string, unknown>) ?? {},
    projectId: (r.project_id as string | null) ?? null,
    amountCents: r.cost_cents != null ? Number(r.cost_cents) : null,
    createdAt: r.created_at as string,
  }));

  const billingEvents: dashboard_timeline_event[] = billingRows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    userEmail: (r.user_email as string | null) ?? emails.get(r.user_id as string) ?? null,
    kind: "billing",
    category: r.flow_type as string,
    action:
      Number(r.amount_cents) >= 0
        ? `Credit +${Number(r.amount_cents).toFixed(2)}¢`
        : `Usage −${Math.abs(Number(r.amount_cents)).toFixed(2)}¢`,
    detail: {
      ...(r.detail as Record<string, unknown>),
      balanceAfterCents: r.balance_after_cents,
      refId: r.ref_id,
    },
    projectId: null,
    amountCents: Number(r.amount_cents),
    createdAt: r.created_at as string,
  }));

  const events = [...activityEvents, ...billingEvents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, userId ? 500 : 200);

  const moneyFlowRows = billingRows.map((r) => ({
    at: new Date(r.created_at as string),
    amountCents: Number(r.amount_cents),
  }));
  const moneyFlow = buildMoneyFlow(moneyFlowRows, days);

  const moneyInCents = billingRows
    .filter((r) => Number(r.amount_cents) > 0)
    .reduce((a, r) => a + Number(r.amount_cents), 0);
  const moneyOutCents = billingRows
    .filter((r) => Number(r.amount_cents) < 0)
    .reduce((a, r) => a + Math.abs(Number(r.amount_cents)), 0);
  const freeCreditsCents = billingRows
    .filter((r) => r.flow_type === "signup_credit")
    .reduce((a, r) => a + Number(r.amount_cents), 0);
  const paidCreditsCents = billingRows
    .filter((r) => r.flow_type === "checkout_credit" || r.flow_type === "invoice_credit")
    .reduce((a, r) => a + Number(r.amount_cents), 0);

  return {
    users: users.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "")),
    events,
    moneyFlow,
    exposure,
    markupSchedule,
    totals: {
      moneyInCents: +moneyInCents.toFixed(4),
      moneyOutCents: +moneyOutCents.toFixed(4),
      freeCreditsCents: +freeCreditsCents.toFixed(4),
      paidCreditsCents: +paidCreditsCents.toFixed(4),
      netProfitCents: +(moneyInCents - moneyOutCents).toFixed(4),
      inTheGreen: moneyInCents >= moneyOutCents,
      errorCount: activityEvents.filter((e) => e.category === "error").length,
      abuserCount: users.filter((u) => u.isAbusingFreeCredit).length,
      worstCaseNetCents: exposure?.worstCaseNetCents ?? 0,
      worstCaseInTheRed: exposure?.platformWorstCaseInTheRed ?? false,
      freeCreditExposureCents: exposure?.totalFreeCreditExposureCents ?? 0,
      currentMarkupPct: exposure?.currentMarkupPct ?? 0,
    },
  };
}

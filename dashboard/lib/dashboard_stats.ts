import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_DATA_DIR } from "./load_env";
import { createAdminClient } from "./supabase_admin";

import type { dashboard_timeline_stats } from "./dashboard_timeline";

export type dashboard_day_bucket = {
  day: string;
  count: number;
  costCents: number;
};

export type dashboard_table_count = {
  table: string;
  count: number;
  error?: string;
};

export type dashboard_feedback_row = {
  id: string;
  userEmail: string | null;
  message: string;
  createdAt: string;
};

export type dashboard_failed_job = {
  id: string;
  userId: string | null;
  error: string;
  updatedAt: string;
};

export type dashboard_stats = {
  fetchedAt: string;
  configured: boolean;
  configError?: string;
  users: number;
  billing: {
    totalBalanceCents: number;
    totalUsageCents: number;
    totalBilledCents: number;
    subscribedUsers: number;
    creditsAddedCents: number;
    dailyCredits: dashboard_day_bucket[];
  };
  landing: {
    budgetCents: number;
    spentCents: number;
    calls: number;
    signups: number;
    dailyCalls: dashboard_day_bucket[];
  };
  sharedLinks: { count: number; totalRuns: number };
  hostedApis: { count: number; totalRequests: number; totalSpendCents: number };
  creatorEarnings: { totalEarnedCents: number; totalWithdrawnCents: number };
  tableCounts: dashboard_table_count[];
  recentFeedback: dashboard_feedback_row[];
  failedJobs: dashboard_failed_job[];
  timeline?: dashboard_timeline_stats;
};

const MONITORED_TABLES = [
  "billing_accounts",
  "billing_credit_ledger",
  "projects",
  "run_jobs",
  "shared_links",
  "hosted_apis",
  "user_feedback",
  "landing_page_calls",
  "landing_page_signups",
  "creator_earnings",
  "user_profiles",
  "user_activity_events",
  "billing_flow_ledger",
  "session_replay_sessions",
  "session_replay_chunks",
  "platform_markup_schedule",
] as const;

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

function bucketDaily(
  rows: { at: Date; costCents?: number }[],
  days = 14,
): dashboard_day_bucket[] {
  const keys = lastNDays(days);
  const map = new Map(keys.map((k) => [k, { count: 0, costCents: 0 }]));
  for (const row of rows) {
    const k = dayKey(row.at);
    const slot = map.get(k);
    if (!slot) continue;
    slot.count += 1;
    slot.costCents += row.costCents ?? 0;
  }
  return keys.map((day) => {
    const slot = map.get(day)!;
    return { day, count: slot.count, costCents: +slot.costCents.toFixed(4) };
  });
}

function sumNumeric(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((acc, row) => {
    const v = Number(row[key]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function isoTimestamp(raw: string | number | null | undefined): string {
  if (raw == null) return new Date(0).toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function loadLocalFeedback(): dashboard_feedback_row[] {
  const path = join(APP_DATA_DIR, "user_feedback.json");
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      id: string;
      userEmail?: string;
      message: string;
      createdAt: number;
    }[];
    return raw
      .map((e) => ({
        id: e.id,
        userEmail: e.userEmail ?? null,
        message: e.message,
        createdAt: new Date(e.createdAt).toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
  } catch {
    return [];
  }
}

async function tableCount(
  db: NonNullable<Awaited<ReturnType<typeof createAdminClient>>>,
  table: string,
): Promise<dashboard_table_count> {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, count: 0, error: error.message };
  return { table, count: count ?? 0 };
}

export async function fetchDashboardStats(): Promise<dashboard_stats> {
  const admin = await createAdminClient();
  if (!admin) {
    return {
      fetchedAt: new Date().toISOString(),
      configured: false,
      configError:
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the repo root .env",
      users: 0,
      billing: {
        totalBalanceCents: 0,
        totalUsageCents: 0,
        totalBilledCents: 0,
        subscribedUsers: 0,
        creditsAddedCents: 0,
        dailyCredits: bucketDaily([]),
      },
      landing: { budgetCents: 0, spentCents: 0, calls: 0, signups: 0, dailyCalls: bucketDaily([]) },
      sharedLinks: { count: 0, totalRuns: 0 },
      hostedApis: { count: 0, totalRequests: 0, totalSpendCents: 0 },
      creatorEarnings: { totalEarnedCents: 0, totalWithdrawnCents: 0 },
      tableCounts: [],
      recentFeedback: loadLocalFeedback(),
      failedJobs: [],
    };
  }

  const since = new Date(Date.now() - 14 * DAY_MS).toISOString();

  const [
    billingRows,
    creditRows,
    budgetRow,
    landingCalls,
    feedbackRows,
    jobRows,
    sharedRows,
    hostedRows,
    earningsRows,
    tableCounts,
    signupsCount,
  ] = await Promise.all([
    admin.from("billing_accounts").select("balance_cents,total_usage_cents,total_billed_cents,subscribed"),
    admin.from("billing_credit_ledger").select("amount_cents,created_at").gte("created_at", since),
    admin.from("landing_page_budget").select("budget_cents,spent_cents").eq("id", "landing").maybeSingle(),
    admin
      .from("landing_page_calls")
      .select("created_at,cost_cents")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("user_feedback")
      .select("id,user_email,message,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("run_jobs")
      .select("id,user_id,data,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200),
    admin.from("shared_links").select("run_count"),
    admin.from("hosted_apis").select("request_count,total_spend_cents"),
    admin.from("creator_earnings").select("total_earned_cents,total_withdrawn_cents"),
    Promise.all(MONITORED_TABLES.map((t) => tableCount(admin, t))),
    admin.from("landing_page_signups").select("*", { count: "exact", head: true }),
  ]);

  const billing = billingRows.data ?? [];
  const credits = creditRows.data ?? [];
  const calls = landingCalls.data ?? [];
  const jobs = jobRows.data ?? [];
  const shared = sharedRows.data ?? [];
  const hosted = hostedRows.data ?? [];
  const earnings = earningsRows.data ?? [];

  const localFeedback = loadLocalFeedback();
  const supabaseFeedback: dashboard_feedback_row[] = (feedbackRows.data ?? []).map((r) => ({
    id: r.id,
    userEmail: r.user_email,
    message: r.message,
    createdAt: isoTimestamp(r.created_at),
  }));
  const seenFeedback = new Set<string>();
  const recentFeedback = [...supabaseFeedback, ...localFeedback]
    .filter((r) => {
      if (seenFeedback.has(r.id)) return false;
      seenFeedback.add(r.id);
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  const failedJobs: dashboard_failed_job[] = jobs
    .map((row) => {
      const data = row.data as { error?: string } | null;
      const err = data?.error?.trim();
      if (!err) return null;
      return {
        id: row.id,
        userId: row.user_id,
        error: err,
        updatedAt: isoTimestamp(row.updated_at),
      };
    })
    .filter((r): r is dashboard_failed_job => r !== null)
    .slice(0, 20);

  const creditDaily = bucketDaily(
    credits.map((r) => ({
      at: new Date(r.created_at as string),
      costCents: Number(r.amount_cents),
    })),
  );

  return {
    fetchedAt: new Date().toISOString(),
    configured: true,
    users: billing.length,
    billing: {
      totalBalanceCents: sumNumeric(billing, "balance_cents"),
      totalUsageCents: sumNumeric(billing, "total_usage_cents"),
      totalBilledCents: sumNumeric(billing, "total_billed_cents"),
      subscribedUsers: billing.filter((r) => r.subscribed).length,
      creditsAddedCents: sumNumeric(credits, "amount_cents"),
      dailyCredits: creditDaily,
    },
    landing: {
      budgetCents: Number(budgetRow.data?.budget_cents ?? 0),
      spentCents: Number(budgetRow.data?.spent_cents ?? 0),
      calls: tableCounts.find((t) => t.table === "landing_page_calls")?.count ?? calls.length,
      signups: signupsCount.count ?? 0,
      dailyCalls: bucketDaily(
        calls.map((r) => ({
          at: new Date(r.created_at as string),
          costCents: Number(r.cost_cents),
        })),
      ),
    },
    sharedLinks: {
      count: shared.length,
      totalRuns: sumNumeric(shared, "run_count"),
    },
    hostedApis: {
      count: hosted.length,
      totalRequests: sumNumeric(hosted, "request_count"),
      totalSpendCents: sumNumeric(hosted, "total_spend_cents"),
    },
    creatorEarnings: {
      totalEarnedCents: sumNumeric(earnings, "total_earned_cents"),
      totalWithdrawnCents: sumNumeric(earnings, "total_withdrawn_cents"),
    },
    tableCounts,
    recentFeedback,
    failedJobs,
  };
}

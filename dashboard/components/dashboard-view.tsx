"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, Bug, Database, RefreshCw, Wallet } from "lucide-react";
import { formatCents } from "@/lib/format";
import type { dashboard_stats } from "@/lib/dashboard_stats";

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">{title}</p>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function ChartCard({
  title,
  description,
  data,
  dataKey,
  color,
}: {
  title: string;
  description?: string;
  data: { day: string; count?: number; costCents?: number }[];
  dataKey: "count" | "costCents";
  color: string;
}) {
  return (
    <div className="panel p-4">
      <h2 className="font-medium">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="day"
              tickFormatter={(v: string) => v.slice(5)}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted)"
              fontSize={11}
            />
            <YAxis tickLine={false} axisLine={false} width={36} stroke="var(--muted)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "0.5rem",
              }}
            />
            <Bar dataKey={dataKey} fill={color} radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardView() {
  const [stats, setStats] = useState<dashboard_stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      const body = (await res.json()) as dashboard_stats | { error?: string };
      if (!res.ok) {
        throw new Error(
          "error" in body && body.error ? body.error : `HTTP ${res.status}`,
        );
      }
      setStats(body as dashboard_stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // AI : defer initial fetch so refresh()'s setState isn't synchronous in the effect body.
    const boot = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), 30_000);
    return () => {
      clearTimeout(boot);
      clearInterval(id);
    };
  }, [refresh]);

  const landingPct =
    stats && stats.landing.budgetCents > 0
      ? Math.round((stats.landing.spentCents / stats.landing.budgetCents) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Supabase ops</h1>
            <p className="text-sm text-muted">
              Standalone localhost console — auto-refreshes every 30s
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stats ? <span className="badge">{formatWhen(stats.fetchedAt)}</span> : null}
            <button type="button" className="btn" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="panel border-destructive/40 p-4 text-sm text-destructive">{error}</div>
        ) : null}

        {!stats?.configured ? (
          <div className="panel p-4">
            <h2 className="font-medium">Supabase not configured</h2>
            <p className="mt-2 text-sm text-muted">{stats?.configError}</p>
          </div>
        ) : null}

        {stats?.configured ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Billing users"
                value={String(stats.users)}
                hint={`${stats.billing.subscribedUsers} subscribed`}
                icon={Wallet}
              />
              <KpiCard
                title="Total usage"
                value={formatCents(stats.billing.totalUsageCents)}
                hint={`Billed ${formatCents(stats.billing.totalBilledCents)}`}
                icon={Activity}
              />
              <KpiCard
                title="Landing demo"
                value={`${landingPct}% spent`}
                hint={`${formatCents(stats.landing.spentCents)} / ${formatCents(stats.landing.budgetCents)} · ${stats.landing.calls} calls`}
                icon={Activity}
              />
              <KpiCard
                title="Issues"
                value={String(stats.failedJobs.length + stats.recentFeedback.length)}
                hint={`${stats.failedJobs.length} failed jobs · ${stats.recentFeedback.length} feedback`}
                icon={stats.failedJobs.length > 0 ? AlertTriangle : Bug}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Landing calls (14d)"
                description="Daily demo invocations"
                data={stats.landing.dailyCalls}
                dataKey="count"
                color="var(--chart-1)"
              />
              <ChartCard
                title="Credits added (14d)"
                description={`${formatCents(stats.billing.creditsAddedCents)} total in window`}
                data={stats.billing.dailyCredits}
                dataKey="costCents"
                color="var(--chart-3)"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="panel p-4 text-sm">
                <h2 className="font-medium">Shared links</h2>
                <p className="mt-2">{stats.sharedLinks.count} links</p>
                <p className="text-muted">{stats.sharedLinks.totalRuns} total runs</p>
              </div>
              <div className="panel p-4 text-sm">
                <h2 className="font-medium">Hosted APIs</h2>
                <p className="mt-2">{stats.hostedApis.count} APIs</p>
                <p className="text-muted">
                  {stats.hostedApis.totalRequests} requests ·{" "}
                  {formatCents(stats.hostedApis.totalSpendCents)}
                </p>
              </div>
              <div className="panel p-4 text-sm">
                <h2 className="font-medium">Creator earnings</h2>
                <p className="mt-2">{formatCents(stats.creatorEarnings.totalEarnedCents)} earned</p>
                <p className="text-muted">
                  {formatCents(stats.creatorEarnings.totalWithdrawnCents)} withdrawn ·{" "}
                  {stats.landing.signups} signups
                </p>
              </div>
            </div>

            <div className="panel p-4">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-4 w-4" />
                <h2 className="font-medium">Table counts</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th className="pb-2 font-medium">Table</th>
                      <th className="pb-2 text-right font-medium">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.tableCounts.map((row) => (
                      <tr key={row.table} className="border-b border-line/60">
                        <td className="py-2 font-mono text-xs">{row.table}</td>
                        <td className="py-2 text-right tabular-nums">
                          {row.error ? (
                            <span className="text-destructive">{row.error}</span>
                          ) : (
                            row.count.toLocaleString()
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="panel p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  <h2 className="font-medium">User feedback</h2>
                </div>
                {stats.recentFeedback.length === 0 ? (
                  <p className="text-sm text-muted">No feedback yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.recentFeedback.map((row) => (
                      <div key={row.id} className="rounded-lg border border-line p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                          <span>{row.userEmail ?? "anonymous"}</span>
                          <span>{formatWhen(row.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{row.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel p-4">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h2 className="font-medium">Failed run jobs</h2>
                </div>
                {stats.failedJobs.length === 0 ? (
                  <p className="text-sm text-muted">No failed jobs in recent window</p>
                ) : (
                  <div className="space-y-3">
                    {stats.failedJobs.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-lg border border-destructive/30 p-3 text-sm"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                          <span className="font-mono">{row.id}</span>
                          <span>{formatWhen(row.updatedAt)}</span>
                        </div>
                        <p className="text-destructive">{row.error}</p>
                        {row.userId ? (
                          <p className="mt-1 font-mono text-xs text-muted">{row.userId}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

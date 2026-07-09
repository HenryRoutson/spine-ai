"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Bug,
  Clock,
  Database,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  ShieldAlert,
  MonitorPlay,
} from "lucide-react";
import { formatCents } from "@/lib/format";
import type { dashboard_stats } from "@/lib/dashboard_stats";
import type { dashboard_timeline_event } from "@/lib/dashboard_timeline";
import type { dashboard_session_replay_row } from "@/lib/dashboard_session_replay";
import { SessionReplayPlayer } from "@/components/session-replay-player";

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

function categoryColor(category: string): string {
  if (category === "error") return "var(--destructive)";
  if (category.startsWith("usage_") || category === "llm_call") return "var(--chart-1)";
  if (category.includes("credit") || category === "signup_credit") return "var(--chart-3)";
  if (category.startsWith("step_")) return "var(--chart-2)";
  return "var(--muted)";
}

function TimelineRow({ row }: { row: dashboard_timeline_event }) {
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge" style={{ color: categoryColor(row.category) }}>
            {row.category}
          </span>
          <span>{row.userEmail ?? row.userId.slice(0, 8)}</span>
          {row.projectId ? <span className="font-mono">{row.projectId}</span> : null}
        </div>
        <span>{formatWhen(row.createdAt)}</span>
      </div>
      <p>{row.action}</p>
      {row.amountCents != null && row.amountCents !== 0 ? (
        <p className="mt-1 tabular-nums text-xs" style={{ color: row.amountCents < 0 ? "var(--destructive)" : "var(--accent)" }}>
          {row.amountCents < 0 ? "−" : "+"}
          {formatCents(Math.abs(row.amountCents))}
        </p>
      ) : null}
      {row.category === "error" && row.detail.message ? (
        <p className="mt-1 text-destructive">{String(row.detail.message)}</p>
      ) : null}
      {row.category === "ui_input" && row.detail.value ? (
        <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted">
          {String(row.detail.value).slice(0, 300)}
        </p>
      ) : null}
    </div>
  );
}

export function DashboardView() {
  const [stats, setStats] = useState<dashboard_stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [replaySessions, setReplaySessions] = useState<dashboard_session_replay_row[]>([]);
  const [selectedReplayId, setSelectedReplayId] = useState<string>("");
  const [replayEvents, setReplayEvents] = useState<Record<string, unknown>[]>([]);
  const [replayBusy, setReplayBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = selectedUserId ? `?userId=${encodeURIComponent(selectedUserId)}` : "";
      const res = await fetch(`/api/dashboard${qs}`);
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
  }, [selectedUserId]);

  useEffect(() => {
    // AI : defer initial fetch so refresh()'s setState isn't synchronous in the effect body.
    const boot = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), 30_000);
    return () => {
      clearTimeout(boot);
      clearInterval(id);
    };
  }, [refresh]);

  const loadReplaySessions = useCallback(async () => {
    try {
      const qs = selectedUserId ? `?userId=${encodeURIComponent(selectedUserId)}` : "";
      const res = await fetch(`/api/session-replay${qs}`);
      const body = (await res.json()) as { sessions?: dashboard_session_replay_row[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setReplaySessions(body.sessions ?? []);
    } catch {
      setReplaySessions([]);
    }
  }, [selectedUserId]);

  useEffect(() => {
    void loadReplaySessions();
    const id = setInterval(() => void loadReplaySessions(), 30_000);
    return () => clearInterval(id);
  }, [loadReplaySessions]);

  const loadReplayEvents = useCallback(async (sessionId: string) => {
    setReplayBusy(true);
    setSelectedReplayId(sessionId);
    try {
      const res = await fetch(`/api/session-replay/${encodeURIComponent(sessionId)}`);
      const body = (await res.json()) as { events?: Record<string, unknown>[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setReplayEvents(body.events ?? []);
    } catch {
      setReplayEvents([]);
    } finally {
      setReplayBusy(false);
    }
  }, []);

  const timeline = stats?.timeline;
  const errorEvents = useMemo(
    () => timeline?.events.filter((e) => e.category === "error") ?? [],
    [timeline?.events],
  );

  const landingPct =
    stats && stats.landing.budgetCents > 0
      ? Math.round((stats.landing.spentCents / stats.landing.budgetCents) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ops dashboard</h1>
            <p className="text-sm text-muted">
              User timelines, billing flow, and errors — auto-refreshes every 30s
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
                title="Net position (14d)"
                value={timeline ? formatCents(timeline.totals.netProfitCents) : "—"}
                hint={
                  timeline
                    ? timeline.totals.inTheGreen
                      ? "In the green (credits vs charged usage)"
                      : "In the red — usage exceeds credits"
                    : undefined
                }
                icon={timeline?.totals.inTheGreen ? TrendingUp : TrendingDown}
              />
              <KpiCard
                title="Worst-case buffer"
                value={timeline ? formatCents(timeline.totals.worstCaseNetCents) : "—"}
                hint={
                  timeline
                    ? `If all ${formatCents(timeline.totals.freeCreditExposureCents)} unused balance hits LLM at provider rate`
                    : undefined
                }
                icon={timeline?.totals.worstCaseInTheRed ? ShieldAlert : TrendingUp}
              />
              <KpiCard
                title="Platform markup"
                value={timeline ? `${timeline.totals.currentMarkupPct}%` : "—"}
                hint={
                  timeline?.exposure
                    ? `${timeline.exposure.currentMarkupMultiple}× on LLM cost · margin ${formatCents(timeline.exposure.totalPlatformMarginCents)}`
                    : "Dated schedule — no per-call rows"
                }
                icon={Activity}
              />
              <KpiCard
                title="LLM provider cost"
                value={
                  timeline?.exposure
                    ? formatCents(timeline.exposure.totalLlmProviderCostCents)
                    : "—"
                }
                hint={
                  timeline?.exposure
                    ? `Charged ${formatCents(timeline.exposure.totalChargedCents)} to users`
                    : undefined
                }
                icon={Wallet}
              />
              <KpiCard
                title="Errors & abusers"
                value={
                  timeline
                    ? `${timeline.totals.errorCount} / ${timeline.totals.abuserCount}`
                    : String(stats.failedJobs.length)
                }
                hint="Errors in window · free-credit abusers"
                icon={timeline && timeline.totals.errorCount > 0 ? AlertTriangle : Bug}
              />
            </div>

            {timeline ? (
              <>
                {timeline.exposure ? (
                  <div
                    className={`panel p-4 ${timeline.totals.worstCaseInTheRed ? "border-destructive/40" : "border-accent/30"}`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      <h2 className="font-medium">Free-credit liability buffer</h2>
                      {timeline.totals.worstCaseInTheRed ? (
                        <span className="badge text-destructive">Worst-case red</span>
                      ) : (
                        <span className="badge text-accent">Worst-case green</span>
                      )}
                    </div>
                    <p className="text-sm text-muted">
                      Models straight LLM provider cost using the dated markup schedule — not what users were charged.
                      Worst case assumes every unused balance is spent instantly at provider rates.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                      <div>
                        <p className="text-muted">Paid credits collected</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatCents(timeline.exposure.totalPaidCreditsCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">LLM provider cost (actual)</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatCents(timeline.exposure.totalLlmProviderCostCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Unused balance buffer</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatCents(timeline.exposure.totalUnusedBalanceCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Provider exposure if all spent</p>
                        <p className="text-lg font-semibold tabular-nums text-destructive">
                          {formatCents(timeline.exposure.totalFreeCreditExposureCents)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm">
                      Current P&amp;L (paid − LLM cost):{" "}
                      <span
                        className={
                          timeline.exposure.currentNetPaidVsLlmCents >= 0 ? "text-accent" : "text-destructive"
                        }
                      >
                        {formatCents(timeline.exposure.currentNetPaidVsLlmCents)}
                      </span>
                      {" · "}
                      Worst-case (minus exposure):{" "}
                      <span
                        className={
                          timeline.exposure.worstCaseNetCents >= 0 ? "text-accent" : "text-destructive"
                        }
                      >
                        {formatCents(timeline.exposure.worstCaseNetCents)}
                      </span>
                    </p>
                  </div>
                ) : null}

                {timeline.markupSchedule.length > 0 ? (
                  <div className="panel p-4">
                    <h2 className="font-medium">Markup schedule</h2>
                    <p className="mt-1 text-sm text-muted">
                      Change markup here in Supabase — each row applies from its effective date (no per-LLM-call rows).
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-line text-left text-muted">
                            <th className="pb-2 font-medium">Markup</th>
                            <th className="pb-2 font-medium">From</th>
                            <th className="pb-2 font-medium">Until</th>
                            <th className="pb-2 font-medium">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeline.markupSchedule.map((row) => (
                            <tr key={row.id} className="border-b border-line/60">
                              <td className="py-2 tabular-nums">
                                {row.markupPct}% ({row.markupMultiple}×)
                              </td>
                              <td className="py-2">{formatWhen(row.effectiveFrom)}</td>
                              <td className="py-2">
                                {row.effectiveUntil ? formatWhen(row.effectiveUntil) : "current"}
                              </td>
                              <td className="py-2 text-muted">{row.note ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                <div className="panel p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <h2 className="font-medium">Users</h2>
                    </div>
                    <select
                      className="rounded-md border border-line bg-background px-3 py-1.5 text-sm"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">All users</option>
                      {timeline.users.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.userEmail ?? u.userId.slice(0, 8)} · {u.eventCount} events
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-muted">
                          <th className="pb-2 font-medium">User</th>
                          <th className="pb-2 text-right font-medium">Balance</th>
                          <th className="pb-2 text-right font-medium">LLM cost</th>
                          <th className="pb-2 text-right font-medium">Exposure</th>
                          <th className="pb-2 text-right font-medium">Worst-case</th>
                          <th className="pb-2 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.users.map((u) => (
                          <tr
                            key={u.userId}
                            className="cursor-pointer border-b border-line/60 hover:bg-background/40"
                            onClick={() => setSelectedUserId(u.userId)}
                          >
                            <td className="py-2">
                              <p>{u.userEmail ?? "—"}</p>
                              <p className="font-mono text-xs text-muted">{u.userId.slice(0, 12)}…</p>
                            </td>
                            <td className="py-2 text-right tabular-nums">{formatCents(u.balanceCents)}</td>
                            <td className="py-2 text-right tabular-nums">
                              {formatCents(u.totalLlmProviderCostCents)}
                            </td>
                            <td className="py-2 text-right tabular-nums text-destructive">
                              {formatCents(u.freeCreditLlmExposureCents)}
                            </td>
                            <td
                              className={`py-2 text-right tabular-nums ${u.worstCaseInTheRed ? "text-destructive" : "text-accent"}`}
                            >
                              {formatCents(u.worstCaseNetCents)}
                            </td>
                            <td className="py-2 text-right">
                              {u.worstCaseInTheRed ? (
                                <span className="text-destructive">Buffer breach</span>
                              ) : u.isAbusingFreeCredit ? (
                                <span className="text-destructive">Abusing free credit</span>
                              ) : u.netProfitCents >= 0 ? (
                                <span className="text-accent">Green</span>
                              ) : (
                                <span className="text-muted">Subsidized</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel p-4">
                  <h2 className="font-medium">Money flow (14d)</h2>
                  <p className="mt-1 text-sm text-muted">
                    Cumulative credits in vs usage out — starting balance, top-ups, and LLM spend
                  </p>
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeline.moneyFlow}>
                        <CartesianGrid vertical={false} stroke="var(--line)" />
                        <XAxis
                          dataKey="day"
                          tickFormatter={(v: string) => v.slice(5)}
                          tickLine={false}
                          axisLine={false}
                          stroke="var(--muted)"
                          fontSize={11}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          stroke="var(--muted)"
                          fontSize={11}
                          tickFormatter={(v: number) => formatCents(v)}
                        />
                        <Tooltip
                          formatter={(v) => formatCents(Number(v ?? 0))}
                          contentStyle={{
                            background: "var(--panel)",
                            border: "1px solid var(--line)",
                            borderRadius: "0.5rem",
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="cumulativeInCents"
                          name="Credits in"
                          stroke="var(--chart-3)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativeOutCents"
                          name="Usage out"
                          stroke="var(--destructive)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="netCents"
                          name="Net"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="panel p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <MonitorPlay className="h-4 w-4" />
                    <h2 className="font-medium">Session replay (rrweb)</h2>
                    {selectedUserId ? <span className="badge">Filtered</span> : null}
                  </div>
                  <p className="mb-4 text-sm text-muted">
                    DOM recordings from signed-in app sessions and the public landing demo — click a session to replay clicks, typing, and navigation.
                  </p>
                  {replaySessions.length === 0 ? (
                    <p className="text-sm text-muted">
                      No replay sessions yet — recordings start in the app when signed in, or on the landing demo after privacy consent.
                    </p>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {replaySessions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`w-full rounded-lg border p-2 text-left text-sm transition-colors ${
                              selectedReplayId === s.id
                                ? "border-accent bg-background/60"
                                : "border-line hover:bg-background/40"
                            }`}
                            onClick={() => void loadReplayEvents(s.id)}
                          >
                            <p className="font-medium">
                              {s.userEmail ?? (s.userId ? s.userId.slice(0, 8) : "landing")}
                              {s.source === "landing" ? (
                                <span className="ml-2 text-xs text-muted">landing</span>
                              ) : null}
                            </p>
                            <p className="text-xs text-muted">{formatWhen(s.startedAt)}</p>
                            <p className="text-xs text-muted">
                              {s.eventCount} events · {s.projectId ? `project ${s.projectId}` : "no project"}
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="min-w-0">
                        {replayBusy ? (
                          <p className="text-sm text-muted">Loading replay…</p>
                        ) : selectedReplayId ? (
                          <SessionReplayPlayer events={replayEvents} className="overflow-hidden rounded-lg border border-line" />
                        ) : (
                          <p className="text-sm text-muted">Select a session to play back.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="panel p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <h2 className="font-medium">Activity timeline</h2>
                    {selectedUserId ? (
                      <span className="badge">Filtered</span>
                    ) : null}
                  </div>
                  {timeline.events.length === 0 ? (
                    <p className="text-sm text-muted">No events yet — activity is recorded once users interact with the app.</p>
                  ) : (
                    <div className="max-h-[32rem] space-y-3 overflow-y-auto">
                      {timeline.events.map((row) => (
                        <TimelineRow key={`${row.kind}-${row.id}`} row={row} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <h2 className="font-medium">User errors</h2>
                  </div>
                  {errorEvents.length === 0 ? (
                    <p className="text-sm text-muted">No user-facing errors in the recent window</p>
                  ) : (
                    <div className="space-y-3">
                      {errorEvents.map((row) => (
                        <TimelineRow key={row.id} row={row} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                title="Failed jobs"
                value={String(stats.failedJobs.length)}
                hint={`${stats.recentFeedback.length} feedback items`}
                icon={stats.failedJobs.length > 0 ? AlertTriangle : Bug}
              />
              <KpiCard
                title="Shared links"
                value={String(stats.sharedLinks.count)}
                hint={`${stats.sharedLinks.totalRuns} runs`}
                icon={Database}
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

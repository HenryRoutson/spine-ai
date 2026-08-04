"use client"

// AI : TODO (spec) — visualize duplicate runs caught by fingerprint dedup (count + billing saved).
import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { formatCents } from "@/lib/format"
import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import type { BillingAccountView } from "@/lib/store"
import { billingSeries, totalSaved, totalUsageFromRuns } from "@/lib/billing"
import { redirectToCheckout } from "@/lib/stripe-client"
import { STRIPE_ENABLED } from "@/lib/stripe-enabled"
import {
  BillingBalanceSkeleton,
  BillingKeysListSkeleton,
  BillingStatsSkeleton,
} from "@/components/account-panel-skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { type ChartConfig } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CreditCard, KeyRound, Loader2, Play, TrendingDown, TrendingUp } from "lucide-react"
import { isSharedRun } from "@/lib/shared-link-types"
import type { PipelineRun } from "@/lib/types"
import {
  readBillingKeysSnapshot,
  writeBillingKeysSnapshot,
  type BillingKeySnapshot,
} from "@/lib/billing-keys-snapshot-cache"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"

const BillingSpendChart = dynamic(
  () => import("@/components/billing-spend-chart").then((m) => ({ default: m.BillingSpendChart })),
  {
    loading: () => <Skeleton className="aspect-[3/1] w-full" />,
    ssr: false,
  },
)

// AI : de-mocked — series keys come from the real billing aggregation (one line per model
// AI : + the doc-parse service), so new models show up without touching this file.
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--chart-5)"]

type BillingScope = "all" | "project" | "shared"

function runsForBillingScope(
  scope: BillingScope,
  billingRuns: PipelineRun[],
  projectRuns: PipelineRun[],
): PipelineRun[] {
  if (scope === "project") return projectRuns
  if (scope === "shared") return billingRuns.filter((run) => isSharedRun(run))
  return billingRuns
}

function creditHistoryLabel(source: BillingAccountView["creditHistory"][number]["source"]): string {
  if (source === "invoice") return "Subscription renewal"
  if (source === "feedback") return "Feedback reward"
  return "Checkout payment"
}

function formatCreditWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function Billing() {
  useMarkPrimarySectionReady("billing")
  const { runs, billingRuns, project, billingAccount, refreshBilling } = useWorkspaceBilling()
  const [scope, setScope] = useState<BillingScope>(project ? "all" : "all")
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [billingKeys, setBillingKeys] = useState<BillingKeySnapshot[]>(
    () => readBillingKeysSnapshot() ?? [],
  )
  const [billingKeysBusy, setBillingKeysBusy] = useState(false)
  const [newBillingKey, setNewBillingKey] = useState<string | null>(null)
  const billingKeysFetchRef = useRef<Promise<void> | null>(null)

  const scopedRuns = useMemo(
    () => runsForBillingScope(scope, billingRuns, runs),
    [scope, billingRuns, runs],
  )
  const billing = useMemo(() => billingSeries(scopedRuns), [scopedRuns])
  const scopeLabel =
    scope === "shared"
      ? "Run shared pipelines"
      : scope === "project" && project
        ? project.name
        : "All projects"

  async function startCheckout(mode: "payment" | "subscription", amountCents?: number) {
    const key = mode === "subscription" ? "subscription" : `topup:${amountCents}`
    setCheckoutKey(key)
    setBanner(null)
    try {
      const res = await fetch(API_ROUTES.billingCheckout, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ mode, amountCents }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Checkout failed")
      if (!body.url) throw new Error("Checkout session missing redirect URL")
      redirectToCheckout(body.url)
    } catch (e) {
      setBanner((e as Error).message)
      setCheckoutKey(null)
    }
  }

  const loadBillingKeys = useCallback(async () => {
    if (billingKeysFetchRef.current) return billingKeysFetchRef.current
    const cached = readBillingKeysSnapshot()
    if (cached) setBillingKeys(cached)
    const run = (async () => {
      setBillingKeysBusy(!cached?.length)
      try {
        const data = await apiJson<{ keys: BillingKeySnapshot[] }>(API_ROUTES.billingKeys)
        setBillingKeys(data.keys)
        writeBillingKeysSnapshot(data.keys)
      } catch {
        if (!cached) setBillingKeys([])
      } finally {
        setBillingKeysBusy(false)
      }
    })()
    billingKeysFetchRef.current = run
    try {
      await run
    } finally {
      billingKeysFetchRef.current = null
    }
  }, [])

  useEffect(() => {
    void loadBillingKeys()
  }, [loadBillingKeys])

  async function createBillingKey() {
    setBillingKeysBusy(true)
    setNewBillingKey(null)
    try {
      const data = await apiJson<{ key: { key: string } }>(API_ROUTES.billingKeys, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ label: "default" }),
      })
      setNewBillingKey(data.key.key)
      await loadBillingKeys()
    } catch (e) {
      setBanner((e as Error).message)
    } finally {
      setBillingKeysBusy(false)
    }
  }

  const chartData = billing

  const series = useMemo(() => {
    const keys = [...new Set(billing.flatMap((p) => Object.keys(p).filter((k) => k !== "day")))]
    return keys.map((key, i) => ({ key, color: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [billing])

  const chartConfig: ChartConfig = useMemo(
    () =>
      series.reduce((acc, s) => {
        acc[s.key] = { label: s.key, color: s.color }
        return acc
      }, {} as ChartConfig),
    [series],
  )

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const s of series) t[s.key] = 0
    for (const point of billing) {
      for (const s of series) t[s.key] += Number(point[s.key] ?? 0)
    }
    return t
  }, [billing, series])

  const grand = Object.values(totals).reduce((a, b) => a + b, 0)
  const usageFromRunsCents = useMemo(() => totalUsageFromRuns(scopedRuns), [scopedRuns])
  // AI : step-level billing aggregate is canonical; run.billedCents can lag on legacy rows.
  const usageCents = grand > 0 ? grand : usageFromRunsCents
  const hasSpend = usageCents > 0
  const hasRuns = scopedRuns.length > 0
  const spendDenominator = usageCents
  const savedCents = totalSaved(scopedRuns)

  const capReached = billingAccount
    ? billingAccount.totalBilledCents >= billingAccount.billingCapCents
    : false
  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const canRun = billingAccount ? billingAccount.balanceCents >= minRunBalanceCents : false

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="11 / Billing"
        title="LLM credit & spend"
        description={`Credit for pipeline runs — subscribe or top up here. Share/API earnings live in the separate Earnings tab. You need at least ${formatCents(minRunBalanceCents)} credit to start a run.`}
      />

      {billingAccount ? (
        <div className="relative z-10 shrink-0 border-b border-border bg-card px-5 py-4">
          {banner && (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {banner}
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Credit balance</p>
              <p className="font-mono text-3xl font-semibold">{formatCents(billingAccount.balanceCents)}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {formatCents(minRunBalanceCents)} minimum to run · usage{" "}
                {formatCents(billingAccount.totalUsageCents ?? usageCents)} · paid{" "}
                {formatCents(billingAccount.totalBilledCents)} of{" "}
                {formatCents(billingAccount.billingCapCents)} cap
                {capReached ? " — cap reached" : ""}
              </p>
            </div>
            <div className="relative z-10 flex flex-wrap gap-2">
              {STRIPE_ENABLED && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!!checkoutKey || billingAccount.subscribed || capReached}
                    onClick={() => startCheckout("subscription")}
                  >
                    {checkoutKey === "subscription" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5" />
                    )}
                    {billingAccount.subscribed
                      ? `Subscribed — ${formatCents(billingAccount.subCentsPerMonth)}/mo`
                      : `Subscribe ${formatCents(billingAccount.subCentsPerMonth)}/mo`}
                  </Button>
                  {billingAccount.topupOptionsCents.map((amountCents) => {
                    const topupKey = `topup:${amountCents}`
                    const topupCapReached =
                      billingAccount.totalBilledCents + amountCents > billingAccount.billingCapCents
                    return (
                      <Button
                        key={amountCents}
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!!checkoutKey || capReached || topupCapReached}
                        onClick={() => startCheckout("payment", amountCents)}
                        title={
                          capReached
                            ? "Billing cap reached"
                            : topupCapReached
                              ? `Would exceed ${formatCents(billingAccount.billingCapCents)} cap`
                              : undefined
                        }
                      >
                        {checkoutKey === topupKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Top up {formatCents(amountCents)}
                      </Button>
                    )
                  })}
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refreshBilling({ force: true }).catch(console.error)}
              >
                Refresh
              </Button>
            </div>
          </div>
          {capReached && (
            <p className="mt-3 font-mono text-[10px] text-amber-600 dark:text-amber-400">
              App billing cap reached — top-ups are disabled.
            </p>
          )}
          {!canRun && (
            <p className="mt-3 font-mono text-[10px] text-amber-600 dark:text-amber-400">
              Not enough credit to run a pipeline — subscribe or top up.
            </p>
          )}
        </div>
      ) : (
        <BillingBalanceSkeleton />
      )}

      {billingAccount ? (
        <div className="shrink-0 grid grid-cols-2 gap-px border-b border-border bg-border">
          <Stat label="Total spend" value={formatCents(usageCents)} />
          <Stat label="Cache savings" value={formatCents(savedCents)} sub="vs no caching" good />
        </div>
      ) : (
        <BillingStatsSkeleton />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Daily spend by model</h3>
              <p className="font-mono text-[10px] text-muted-foreground">
                {scopeLabel} · USD · stacked · from pipeline runs
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-border p-0.5">
                <Button
                  type="button"
                  variant={scope === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 font-mono text-[10px]"
                  onClick={() => setScope("all")}
                >
                  All projects
                </Button>
                {project ? (
                  <Button
                    type="button"
                    variant={scope === "project" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 max-w-[10rem] truncate px-2.5 font-mono text-[10px]"
                    title={project.name}
                    onClick={() => setScope("project")}
                  >
                    This project
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={scope === "shared" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 gap-1 px-2.5 font-mono text-[10px]"
                  onClick={() => setScope("shared")}
                >
                  <Play className="h-3 w-3 shrink-0" />
                  Run shared pipelines
                </Button>
              </div>
              {hasRuns && (
                <Badge variant="outline" className="gap-1 font-mono text-[10px] text-primary">
                  <TrendingDown className="h-3 w-3" /> {scopedRuns.length} run{scopedRuns.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </div>
          <BillingSpendChart
            chartData={chartData}
            series={series}
            chartConfig={chartConfig}
            hasRuns={hasRuns}
            scope={scope}
          />
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-medium">Cost attribution</h3>
          </div>
          {hasSpend ? (
            <ul className="divide-y divide-border">
              {series.map((s) => {
                const value = totals[s.key]
                const pct = spendDenominator > 0 ? (value / spendDenominator) * 100 : 0
                return (
                  <li key={s.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                    <span className="w-40 shrink-0 font-mono text-xs">{s.key}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                    <span className="w-16 text-right font-mono text-xs">{formatCents(value)}</span>
                    <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
              {hasRuns ? "All recent runs were cache hits — no billed spend yet." : "No cost data yet."}
            </p>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div>
              <h3 className="text-sm font-medium">Billing API keys</h3>
              <p className="font-mono text-[10px] text-muted-foreground">
                For caller-paid hosted APIs — pass as X-Spine-Billing-Key
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={billingKeysBusy}
              onClick={() => void createBillingKey()}
            >
              {billingKeysBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Create key
            </Button>
          </div>
          {newBillingKey && (
            <div className="border-b border-border bg-amber-500/10 px-4 py-3">
              <p className="mb-1 text-xs text-amber-900 dark:text-amber-100">Copy now — shown once</p>
              <code className="block truncate font-mono text-[10px]">{newBillingKey}</code>
            </div>
          )}
          {billingKeysBusy && !billingKeys.length ? (
            <BillingKeysListSkeleton />
          ) : billingKeys.length ? (
            <ul className="divide-y divide-border">
              {billingKeys.map((k) => (
                <li key={k.id} className="flex items-center gap-3 px-4 py-2.5 font-mono text-xs">
                  <span className="min-w-0 flex-1 truncate">{k.label}</span>
                  <span className="text-[10px] text-muted-foreground">{k.keyPrefix}…</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
              No billing keys — create one to call billable APIs programmatically.
            </p>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-medium">Credit history</h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              Paid top-ups and subscription credits · welcome {formatCents(billingAccount?.freeCreditCents ?? 0)} not listed
            </p>
          </div>
          {billingAccount?.creditHistory.length ? (
            <ul className="divide-y divide-border">
              {billingAccount.creditHistory.map((entry) => (
                <li key={entry.creditKey} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-36 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatCreditWhen(entry.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-xs">{creditHistoryLabel(entry.source)}</span>
                  <span className="font-mono text-xs text-primary">+{formatCents(entry.amountCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
              No paid credits yet — top up or subscribe to see entries here.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  good,
}: {
  label: string
  value: string
  sub?: string
  good?: boolean
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg">{value}</p>
      {sub && (
        <p className={cn("mt-0.5 flex items-center gap-1 font-mono text-[10px]", good ? "text-primary" : "text-muted-foreground")}>
          {good ? <TrendingUp className="h-3 w-3" /> : null}
          {sub}
        </p>
      )}
    </div>
  )
}

"use client"

import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { formatUsdFromCents } from "@/lib/format"
import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useStore } from "@/lib/store"
import { billingPointsUsd, billingSeries, totalSaved } from "@/lib/billing"
import { redirectToCheckout } from "@/lib/stripe-client"
import { MODEL_OPTIONS } from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CreditCard, Loader2, TrendingDown, TrendingUp } from "lucide-react"

// AI : de-mocked — series keys come from the real billing aggregation (one line per model
// AI : + the doc-parse service), so new models show up without touching this file.
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--chart-5)"]

function isCheapKey(key: string) {
  return key === "doc-parse svc" || MODEL_OPTIONS.some((m) => m.label === key && m.cheap)
}

type BillingScope = "all" | "project"

export function Billing() {
  const { runs, billingRuns, project, billingAccount, refreshBilling } = useStore()
  const [scope, setScope] = useState<BillingScope>("all")
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const scopedRuns = scope === "all" ? billingRuns : runs
  const billing = useMemo(() => billingSeries(scopedRuns), [scopedRuns])
  const scopeLabel = scope === "all" ? "All projects" : project.name

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

  const chartData = useMemo(() => billingPointsUsd(billing), [billing])

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
  const hasSpend = grand > 0
  const hasRuns = scopedRuns.length > 0
  const cheapSpend = series.filter((s) => isCheapKey(s.key)).reduce((a, s) => a + totals[s.key], 0)
  const frontierSpend = series.filter((s) => !isCheapKey(s.key)).reduce((a, s) => a + totals[s.key], 0)
  const savedCents = totalSaved(scopedRuns)

  const capReached = billingAccount
    ? billingAccount.totalBilledCents >= billingAccount.billingCapCents
    : false
  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const canRun = billingAccount ? billingAccount.balanceCents >= minRunBalanceCents : false

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="07 / Billing"
        title="Spend & Inference Cost"
        description={`Credit-based billing — subscribe for monthly credit, top up when you run out. Actual run cost depends on models and pipeline length; you need at least ${formatUsdFromCents(minRunBalanceCents)} credit to start a run.`}
      />

      {billingAccount && (
        <div className="relative z-10 shrink-0 border-b border-border bg-card px-5 py-4">
          {banner && (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {banner}
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Credit balance</p>
              <p className="font-mono text-3xl font-semibold">{formatUsdFromCents(billingAccount.balanceCents)}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {formatUsdFromCents(minRunBalanceCents)} minimum to run · billed {formatUsdFromCents(billingAccount.totalBilledCents)} of{" "}
                {formatUsdFromCents(billingAccount.billingCapCents)} cap
                {capReached ? " — cap reached" : ""}
              </p>
            </div>
            <div className="relative z-10 flex flex-wrap gap-2">
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
                  ? `Subscribed — ${formatUsdFromCents(billingAccount.subCentsPerMonth)}/mo`
                  : `Subscribe ${formatUsdFromCents(billingAccount.subCentsPerMonth)}/mo`}
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
                          ? `Would exceed ${formatUsdFromCents(billingAccount.billingCapCents)} cap`
                          : undefined
                    }
                  >
                    {checkoutKey === topupKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Top up {formatUsdFromCents(amountCents)}
                  </Button>
                )
              })}
              <Button type="button" variant="ghost" size="sm" onClick={() => refreshBilling().catch(console.error)}>
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
      )}

      <div className="shrink-0 grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        <Stat label="Total spend" value={formatUsdFromCents(grand)} />
        <Stat
          label="Open / cheap models"
          value={formatUsdFromCents(cheapSpend)}
          sub={hasSpend ? `${Math.round((cheapSpend / grand) * 100)}% of spend` : hasRuns ? "cached runs only" : "no runs yet"}
          good
        />
        <Stat
          label="Frontier models"
          value={formatUsdFromCents(frontierSpend)}
          sub={hasSpend ? `${Math.round((frontierSpend / grand) * 100)}% of spend` : hasRuns ? "cached runs only" : "no runs yet"}
        />
        <Stat label="Cache savings" value={formatUsdFromCents(savedCents)} sub="vs no caching" good />
      </div>

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
              </div>
              {hasRuns && (
                <Badge variant="outline" className="gap-1 font-mono text-[10px] text-primary">
                  <TrendingDown className="h-3 w-3" /> {scopedRuns.length} run{scopedRuns.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </div>
          {hasRuns ? (
            <ChartContainer config={chartConfig} className="aspect-[3/1] w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  {series.map((s) => (
                    <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} className="text-[10px]" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={40}
                  className="text-[10px]"
                  tickFormatter={(v) => formatUsdFromCents(v * 100)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatUsdFromCents(Number(value) * 100)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {series.map((s) => (
                  <Area
                    key={s.key}
                    dataKey={s.key}
                    type="monotone"
                    stackId="1"
                    stroke={s.color}
                    fill={`url(#fill-${s.key})`}
                    strokeWidth={1.5}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center font-mono text-xs text-muted-foreground">
              {scope === "project"
                ? "No runs for this project yet — run a pipeline to see daily cost breakdown."
                : "No runs yet — run a pipeline to see daily cost breakdown."}
            </p>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-medium">Cost attribution</h3>
          </div>
          {hasSpend ? (
            <ul className="divide-y divide-border">
              {series.map((s) => {
                const value = totals[s.key]
                const pct = (value / grand) * 100
                return (
                  <li key={s.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                    <span className="w-40 shrink-0 font-mono text-xs">{s.key}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                    <span className="w-16 text-right font-mono text-xs">{formatUsdFromCents(value)}</span>
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

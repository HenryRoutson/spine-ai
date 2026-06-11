"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useStore } from "@/lib/store"
import { totalSaved } from "@/lib/billing"
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

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

// AI : de-mocked — series keys come from the real billing aggregation (one line per model
// AI : + the doc-parse service), so new models show up without touching this file.
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--chart-5)"]

function isCheapKey(key: string) {
  return key === "doc-parse svc" || MODEL_OPTIONS.some((m) => m.label === key && m.cheap)
}

export function Billing() {
  const { billing, runs, billingAccount, refreshBilling } = useStore()
  const [checkoutMode, setCheckoutMode] = useState<"payment" | "subscription" | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  async function startCheckout(mode: "payment" | "subscription") {
    setCheckoutMode(mode)
    setBanner(null)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Checkout failed")
      if (!body.url) throw new Error("Checkout session missing redirect URL")
      await redirectToCheckout(body.url)
    } catch (e) {
      setBanner((e as Error).message)
      setCheckoutMode(null)
    }
  }

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
  const cheapSpend = series.filter((s) => isCheapKey(s.key)).reduce((a, s) => a + totals[s.key], 0)
  const frontierSpend = series.filter((s) => !isCheapKey(s.key)).reduce((a, s) => a + totals[s.key], 0)
  // AI : real cache savings from run history (replaces the hardcoded "$3.41").
  const savedUsd = totalSaved(runs) / 100

  const capReached = billingAccount
    ? billingAccount.totalBilledCents >= billingAccount.billingCapCents
    : false
  const canRun = billingAccount ? billingAccount.balanceCents >= billingAccount.useCostCents : false

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="07 / Billing"
        title="Spend & Inference Cost"
        description="Credit-based billing — subscribe for monthly credit, top up when you run out. Each pipeline run costs 50¢."
      />

      {billingAccount && (
        <div className="border-b border-border bg-card px-5 py-4">
          {banner && (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {banner}
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Credit balance</p>
              <p className="font-mono text-3xl font-semibold">{dollars(billingAccount.balanceCents)}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {dollars(billingAccount.useCostCents)} per run · billed {dollars(billingAccount.totalBilledCents)} of{" "}
                {dollars(billingAccount.billingCapCents)} cap
                {capReached ? " — cap reached" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!!checkoutMode || billingAccount.subscribed || capReached}
                onClick={() => startCheckout("subscription")}
              >
                {checkoutMode === "subscription" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5" />
                )}
                {billingAccount.subscribed
                  ? `Subscribed — ${dollars(billingAccount.subCentsPerMonth)}/mo`
                  : `Subscribe ${dollars(billingAccount.subCentsPerMonth)}/mo`}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!!checkoutMode || capReached}
                onClick={() => startCheckout("payment")}
              >
                {checkoutMode === "payment" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Top up {dollars(billingAccount.topupCents)}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => refreshBilling().catch(console.error)}>
                Refresh
              </Button>
            </div>
          </div>
          {!canRun && (
            <p className="mt-3 font-mono text-[10px] text-amber-600 dark:text-amber-400">
              Not enough credit to run a pipeline — subscribe or top up.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        <Stat label="Total spend" value={`$${grand.toFixed(2)}`} />
        <Stat
          label="Open / cheap models"
          value={`$${cheapSpend.toFixed(2)}`}
          sub={hasSpend ? `${Math.round((cheapSpend / grand) * 100)}% of spend` : "no runs yet"}
          good
        />
        <Stat
          label="Frontier models"
          value={`$${frontierSpend.toFixed(2)}`}
          sub={hasSpend ? `${Math.round((frontierSpend / grand) * 100)}% of spend` : "no runs yet"}
        />
        <Stat label="Cache savings" value={`$${savedUsd.toFixed(2)}`} sub="vs no caching" good />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Daily spend by model</h3>
              <p className="font-mono text-[10px] text-muted-foreground">USD · stacked · from pipeline runs</p>
            </div>
            {hasSpend && (
              <Badge variant="outline" className="gap-1 font-mono text-[10px] text-primary">
                <TrendingDown className="h-3 w-3" /> {runs.length} run{runs.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          {hasSpend ? (
            <ChartContainer config={chartConfig} className="aspect-[3/1] w-full">
              <AreaChart data={billing} margin={{ left: 4, right: 8, top: 8 }}>
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
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} className="text-[10px]" tickFormatter={(v) => `$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
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
              No spend yet — run a pipeline to see daily cost breakdown.
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
                    <span className="w-16 text-right font-mono text-xs">${value.toFixed(2)}</span>
                    <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">No cost data yet.</p>
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

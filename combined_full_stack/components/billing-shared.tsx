"use client"

import dynamic from "next/dynamic"
import { useMemo } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { billingSeries, totalSaved, totalUsageFromRuns } from "@/lib/billing"
import { formatCents } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import type { PipelineRun } from "@/lib/types"

const BillingSpendChart = dynamic(
  () => import("@/components/billing-spend-chart").then((m) => ({ default: m.BillingSpendChart })),
  {
    loading: () => <Skeleton className="aspect-[3/1] w-full" />,
    ssr: false,
  },
)

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--chart-5)"]

export function BillingStat({
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
      {sub ? (
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 font-mono text-[10px]",
            good ? "text-primary" : "text-muted-foreground",
          )}
        >
          {good ? <TrendingUp className="h-3 w-3" /> : null}
          {sub}
        </p>
      ) : null}
    </div>
  )
}

export function useBillingChart(runs: PipelineRun[]) {
  const billing = useMemo(() => billingSeries(runs), [runs])
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
  const usageFromRunsCents = useMemo(() => totalUsageFromRuns(runs), [runs])
  const usageCents = grand > 0 ? grand : usageFromRunsCents
  const hasSpend = usageCents > 0
  const hasRuns = runs.length > 0
  const savedCents = totalSaved(runs)
  return { billing, series, chartConfig, totals, usageCents, hasSpend, hasRuns, savedCents }
}

export function BillingSpendSection({
  runs,
  scopeLabel,
  chartScope = "all",
  embedded = false,
}: {
  runs: PipelineRun[]
  scopeLabel: string
  chartScope?: "all" | "project" | "shared"
  embedded?: boolean
}) {
  const { billing, series, chartConfig, totals, usageCents, hasSpend, hasRuns, savedCents } =
    useBillingChart(runs)

  const body = (
    <>
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
        <BillingStat label="Total spend" value={formatCents(usageCents)} />
        <BillingStat label="Cache savings" value={formatCents(savedCents)} sub="vs no caching" good />
      </div>

      <div className={embedded ? "p-5" : "min-h-0 flex-1 overflow-y-auto p-5"}>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Daily spend by model</h3>
              <p className="font-mono text-[10px] text-muted-foreground">
                {scopeLabel} · USD · stacked · from pipeline runs
              </p>
            </div>
            {hasRuns ? (
              <Badge variant="outline" className="gap-1 font-mono text-[10px] text-primary">
                <TrendingDown className="h-3 w-3" /> {runs.length} run{runs.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          <BillingSpendChart
            chartData={billing}
            series={series}
            chartConfig={chartConfig}
            hasRuns={hasRuns}
            scope={chartScope}
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
                const pct = usageCents > 0 ? (value / usageCents) * 100 : 0
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
      </div>
    </>
  )
  return body
}

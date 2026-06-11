"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useStore } from "@/lib/store"
import { WindowHeader } from "@/components/window-header"
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
import { TrendingDown, TrendingUp } from "lucide-react"

const SERIES = [
  { key: "Qwen 2.5 72B", color: "var(--chart-1)" },
  { key: "DeepSeek V3", color: "var(--chart-2)" },
  { key: "Claude Opus 4.6", color: "var(--chart-4)" },
  { key: "doc-parse svc", color: "var(--chart-3)" },
]

const chartConfig: ChartConfig = SERIES.reduce((acc, s) => {
  acc[s.key] = { label: s.key, color: s.color }
  return acc
}, {} as ChartConfig)

export function Billing() {
  const { billing } = useStore()

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const s of SERIES) t[s.key] = 0
    for (const point of billing) {
      for (const s of SERIES) t[s.key] += Number(point[s.key] ?? 0)
    }
    return t
  }, [billing])

  const grand = Object.values(totals).reduce((a, b) => a + b, 0)
  // attribute spend to "open / cheap" vs "frontier" to make the cost-shifting point
  const cheapSpend = totals["Qwen 2.5 72B"] + totals["DeepSeek V3"] + totals["doc-parse svc"]
  const frontierSpend = totals["Claude Opus 4.6"]

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="07 / Billing"
        title="Spend & Inference Cost"
        description="Cost is attributed per model and per processing service so you can see exactly where spend goes."
      />

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        <Stat label="7-day spend" value={`$${grand.toFixed(2)}`} />
        <Stat
          label="Open / cheap models"
          value={`$${cheapSpend.toFixed(2)}`}
          sub={`${Math.round((cheapSpend / grand) * 100)}% of spend`}
          good
        />
        <Stat
          label="Frontier models"
          value={`$${frontierSpend.toFixed(2)}`}
          sub={`${Math.round((frontierSpend / grand) * 100)}% of spend`}
        />
        <Stat label="Cache savings" value="$3.41" sub="vs no caching" good />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Daily spend by model</h3>
              <p className="font-mono text-[10px] text-muted-foreground">USD · stacked · last 7 days</p>
            </div>
            <Badge variant="outline" className="gap-1 font-mono text-[10px] text-primary">
              <TrendingDown className="h-3 w-3" /> blended $/run trending down
            </Badge>
          </div>
          <ChartContainer config={chartConfig} className="aspect-[3/1] w-full">
            <AreaChart data={billing} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                {SERIES.map((s) => (
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
              {SERIES.map((s) => (
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
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-medium">Cost attribution</h3>
          </div>
          <ul className="divide-y divide-border">
            {SERIES.map((s) => {
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

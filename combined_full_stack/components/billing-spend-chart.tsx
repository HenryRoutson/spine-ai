"use client"

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { formatCents } from "@/lib/format"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

export type BillingChartSeries = { key: string; color: string }

export type BillingChartPoint = Record<string, string | number>

// AI : pad peak daily spend (cents) so stacked areas aren't clipped.
function chartYMaxCents(peakCents: number): number {
  if (peakCents <= 0) return 100
  return +(peakCents * 1.2).toFixed(4)
}

type BillingSpendChartProps = {
  chartData: BillingChartPoint[]
  series: BillingChartSeries[]
  chartConfig: ChartConfig
  hasRuns: boolean
  scope: "all" | "project" | "shared"
}

export function BillingSpendChart({
  chartData,
  series,
  chartConfig,
  hasRuns,
  scope,
}: BillingSpendChartProps) {
  const yMaxCents = (() => {
    let peak = 0
    for (const point of chartData) {
      let dayTotal = 0
      for (const s of series) dayTotal += Number(point[s.key] ?? 0)
      peak = Math.max(peak, dayTotal)
    }
    return chartYMaxCents(peak)
  })()

  if (!hasRuns) {
    return (
      <p className="py-12 text-center font-mono text-xs text-muted-foreground">
        {scope === "project"
          ? "No runs for this project yet — run a pipeline to see daily cost breakdown."
          : scope === "shared"
            ? "No shared pipeline runs yet — run a shared link to see attribution here."
            : "No runs yet — run a pipeline to see daily cost breakdown."}
      </p>
    )
  }

  return (
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
          domain={[0, yMaxCents]}
          tickFormatter={(v) => formatCents(v)}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatCents(Number(value))} />}
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
            dot={(props) => {
              const { cx, cy, value } = props
              if (cx == null || cy == null || !value || Number(value) <= 0) return null
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={s.color}
                  stroke="var(--background)"
                  strokeWidth={1.5}
                />
              )
            }}
            activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 1.5 }}
          />
        ))}
        <ReferenceLine y={0} stroke="#fff" strokeWidth={1.5} ifOverflow="visible" />
      </AreaChart>
    </ChartContainer>
  )
}

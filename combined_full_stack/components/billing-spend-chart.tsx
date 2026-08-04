"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { formatCents } from "@/lib/format"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-[10px]"
        />
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
          cursor={false}
          content={<ChartTooltipContent formatter={(value) => formatCents(Number(value))} />}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="natural"
            stackId="a"
            fill={`var(--color-${s.key})`}
            fillOpacity={0.4}
            stroke={`var(--color-${s.key})`}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

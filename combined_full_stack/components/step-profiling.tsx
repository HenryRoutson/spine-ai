"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import type { PipelineRun, RunStep } from "@/lib/types"
import { formatCostCents, formatMs } from "@/lib/llm-distribution"
import {
  buildStepMeanStats,
  buildStepProfiles,
  runsMatchingSignature,
  runStepSignature,
  type StepMeanStats,
} from "@/lib/step-profiling"
import { useStatusPalette } from "@/lib/chart-colors"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

function truncateLabel(label: string, max = 12): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`
}

function StepMetricAreaChart({
  title,
  stats,
  value,
  format,
  color,
  palette,
}: {
  title: string
  stats: StepMeanStats[]
  value: (step: StepMeanStats) => number
  format: (n: number) => string
  color?: string
  palette: { ok: string; err: string; retry: string }
}) {
  const chartData = stats.map((step, i) => ({
    step: String(i + 1),
    label: truncateLabel(step.label),
    value: Math.max(0, value(step)),
  }))
  const maxVal = Math.max(...chartData.map((d) => d.value), 0.01)
  const yMax = +(maxVal * 1.1).toFixed(6)
  const hasFailed = stats.some((s) => s.failed > 0)
  const strokeColor = color ?? (hasFailed ? palette.err : palette.ok)

  const chartConfig: ChartConfig = {
    value: { label: title, color: strokeColor },
  }

  return (
    <div className="min-w-0 rounded border border-border bg-background p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <p className="truncate font-mono text-[9px] font-medium uppercase tracking-wide text-foreground">{title}</p>
        <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-muted-foreground">
          {format(maxVal)}
        </span>
      </div>
      <ChartContainer config={chartConfig} className="aspect-[2/1] w-full min-h-[112px]">
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 4, right: 8, top: 4, bottom: 22 }}
        >
          <CartesianGrid vertical={false} />
          <YAxis hide domain={[0, yMax]} />
          <XAxis
            dataKey="step"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            className="font-mono text-[8px]"
            tickFormatter={(v) => String(v)}
            label={{
              value: "Step",
              position: "insideBottom",
              offset: -14,
              style: {
                fontSize: 9,
                fontFamily: "ui-monospace, monospace",
                textAnchor: "middle",
                fill: "var(--muted-foreground)",
              },
            }}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { step?: string; label?: string } | undefined
                  return p ? `Step ${p.step}: ${p.label}` : undefined
                }}
                formatter={(v) => format(Number(v))}
              />
            }
          />
          <Area
            dataKey="value"
            type="linear"
            baseValue={0}
            fill="var(--color-value)"
            fillOpacity={0.4}
            stroke="var(--color-value)"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

export function StepProfiling({
  runs,
  stepOrder,
}: {
  runs: PipelineRun[]
  stepOrder: RunStep[]
}) {
  const palette = useStatusPalette()
  const signature = useMemo(() => runStepSignature(stepOrder), [stepOrder])
  const matchingRuns = useMemo(() => runsMatchingSignature(runs, signature), [runs, signature])
  const stats = useMemo(() => {
    const profiles = buildStepProfiles(matchingRuns, stepOrder)
    return buildStepMeanStats(profiles)
  }, [matchingRuns, stepOrder])

  if (stats.length === 0) return null

  const ok = stats.reduce((n, s) => n + s.n - s.failed, 0)
  const failed = stats.reduce((n, s) => n + s.failed, 0)

  return (
    <div className="rounded-md border-2 border-border bg-muted/10 p-2">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-1.5">
        <div>
          <h4 className="font-mono text-[10px] font-medium uppercase tracking-wide text-foreground">
            Step profiling
          </h4>
          <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
            Mean latency &amp; cost per step across {matchingRuns.length} run
            {matchingRuns.length === 1 ? "" : "s"} with the same pipeline
          </p>
        </div>
        <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
          <span className={palette.okText}>{ok} ok</span>
          {failed > 0 && (
            <>
              {" · "}
              <span className={palette.errText}>{failed} failed</span>
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-3">
        <StepMetricAreaChart
          title="Mean latency"
          stats={stats}
          value={(s) => s.meanMs}
          format={formatMs}
          palette={palette}
        />
        <StepMetricAreaChart
          title="Mean cost"
          stats={stats}
          value={(s) => s.meanCostCents}
          format={formatCostCents}
          palette={palette}
        />
        <StepMetricAreaChart
          title="Description Validation cost"
          stats={stats}
          value={(s) => s.meanDescriptionCheckCostCents}
          format={formatCostCents}
          color={palette.retry}
          palette={palette}
        />
      </div>

      <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
        Steps in pipeline order ·{" "}
        <span className={palette.okText}>ok</span>
        {" · "}
        <span className={palette.errText}>any failed</span>
      </p>
    </div>
  )
}

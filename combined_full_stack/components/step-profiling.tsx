"use client"

import { useMemo } from "react"
import type { PipelineRun, RunStep } from "@/lib/types"
import { formatCostCents, formatMs } from "@/lib/llm-distribution"
import {
  buildStepMeanStats,
  buildStepProfiles,
  runsMatchingSignature,
  runStepSignature,
  type StepMeanStats,
} from "@/lib/step-profiling"
import { CHART_AXIS, CHART_STAT, useStatusPalette } from "@/lib/chart-colors"
import type { StatusPalette } from "@/lib/color-scheme"

// AI : fixed cell width — rigid grid; value row + plot + label row baked into padding.
const STEP_W = 40
const PLOT_H = 96
const PAD = { t: 12, r: 4, b: 36, l: 24 }

function barColor(failed: number, palette: StatusPalette): { fill: string; stroke: string } {
  return failed > 0 ? { fill: palette.err, stroke: palette.errStroke } : { fill: palette.ok, stroke: palette.okStroke }
}

function truncateLabel(label: string, max = 12): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`
}

function StepMetricBarChart({
  title,
  stats,
  value,
  format,
  barFill,
  barStroke,
  palette,
}: {
  title: string
  stats: StepMeanStats[]
  value: (step: StepMeanStats) => number
  format: (n: number) => string
  barFill?: string
  barStroke?: string
  palette: StatusPalette
}) {
  const maxVal = Math.max(...stats.map(value), 0.01)
  const plotW = stats.length * STEP_W
  const w = PAD.l + plotW + PAD.r
  const h = PAD.t + PLOT_H + PAD.b
  const plotX = PAD.l
  const plotTop = PAD.t
  const baselineY = plotTop + PLOT_H

  return (
    <div className="min-w-0 rounded border border-border bg-background p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <p className="truncate font-mono text-[9px] font-medium uppercase tracking-wide text-foreground">{title}</p>
        <span className="shrink-0 font-mono text-[8px] text-muted-foreground">{format(maxVal)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-border" aria-hidden preserveAspectRatio="xMinYMin meet">
        <rect
          x={plotX}
          y={plotTop}
          width={plotW}
          height={PLOT_H}
          className="fill-muted/15"
          stroke={CHART_AXIS}
          strokeWidth={1}
        />

        <line x1={plotX} y1={baselineY} x2={plotX + plotW} y2={baselineY} stroke={CHART_AXIS} strokeWidth={1.25} />
        <line x1={plotX} y1={plotTop} x2={plotX} y2={baselineY} stroke={CHART_AXIS} strokeWidth={1} />

        <text x={plotX - 4} y={baselineY + 3} fill={CHART_STAT} fontSize={8} fontFamily="ui-monospace, monospace" textAnchor="end">
          0
        </text>
        <text x={plotX - 4} y={plotTop + 8} fill={CHART_STAT} fontSize={8} fontFamily="ui-monospace, monospace" textAnchor="end">
          {format(maxVal)}
        </text>

        {stats.map((step, i) => {
          const barX = plotX + STEP_W * i
          const v = value(step)
          const barH = v > 0 ? (v / maxVal) * PLOT_H : 0
          const color =
            barFill && barStroke
              ? { fill: barFill, stroke: barStroke }
              : barColor(step.failed, palette)
          const centerX = barX + STEP_W / 2
          const valueY = v > 0 ? baselineY - barH - 3 : baselineY - 3

          return (
            <g key={step.moduleId}>
              {v > 0 && (
                <>
                  <rect x={barX} y={baselineY - barH} width={STEP_W} height={barH} fill={color.fill} />
                  <line
                    x1={barX}
                    y1={baselineY - barH}
                    x2={barX + STEP_W}
                    y2={baselineY - barH}
                    stroke={color.stroke}
                    strokeWidth={1}
                  />
                </>
              )}
              <text
                x={centerX}
                y={valueY}
                fill={CHART_STAT}
                fontSize={7}
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
              >
                {format(v)}
              </text>
              <text
                x={centerX}
                y={baselineY + 12}
                fill={CHART_STAT}
                fontSize={7}
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
              >
                {i + 1}
              </text>
              <text
                x={centerX}
                y={baselineY + 24}
                fill={CHART_STAT}
                fontSize={6}
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
              >
                {truncateLabel(step.label)}
              </text>
            </g>
          )
        })}
      </svg>
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
        <StepMetricBarChart
          title="Mean latency"
          stats={stats}
          value={(s) => s.meanMs}
          format={formatMs}
          palette={palette}
        />
        <StepMetricBarChart
          title="Mean cost"
          stats={stats}
          value={(s) => s.meanCostCents}
          format={formatCostCents}
          palette={palette}
        />
        <StepMetricBarChart
          title="Description Validation cost"
          stats={stats}
          value={(s) => s.meanDescriptionCheckCostCents}
          format={formatCostCents}
          barFill={palette.retry}
          barStroke={palette.retryStroke}
          palette={palette}
        />
      </div>

      <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
        Connected bars = steps in order ·{" "}
        <span className={palette.okText}>ok</span>
        {" · "}
        <span className={palette.errText}>any failed</span>
      </p>
    </div>
  )
}

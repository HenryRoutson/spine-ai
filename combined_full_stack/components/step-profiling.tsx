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

import {
  CHART_AXIS,
  CHART_ERR,
  CHART_ERR_STROKE,
  CHART_ERR_TEXT_CLASS,
  CHART_OK,
  CHART_OK_STROKE,
  CHART_OK_TEXT_CLASS,
  CHART_STAT,
} from "@/lib/chart-colors"
const PAD = { t: 12, r: 8, b: 48, l: 52 }
const PLOT_H = 132

function barColor(failed: number): { fill: string; stroke: string } {
  return failed > 0 ? { fill: CHART_ERR, stroke: CHART_ERR_STROKE } : { fill: CHART_OK, stroke: CHART_OK_STROKE }
}

function truncateLabel(label: string, max = 14): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`
}

function StepMetricBarChart({
  title,
  stats,
  value,
  format,
  showStepLabels,
}: {
  title: string
  stats: StepMeanStats[]
  value: (step: StepMeanStats) => number
  format: (n: number) => string
  showStepLabels: boolean
}) {
  const maxVal = Math.max(...stats.map(value), 0.01)
  const plotW = Math.max(320, stats.length * 48)
  const w = PAD.l + plotW + PAD.r
  const h = PAD.t + PLOT_H + PAD.b
  const plotX = PAD.l
  const baselineY = PAD.t + PLOT_H
  const stepSpan = plotW / stats.length

  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-foreground">{title}</p>
        <span className="font-mono text-[9px] text-muted-foreground">max {format(maxVal)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-border" aria-hidden>
        <rect
          x={plotX}
          y={PAD.t}
          width={plotW}
          height={PLOT_H}
          className="fill-muted/15"
          stroke={CHART_AXIS}
          strokeWidth={1}
        />

        <line x1={plotX} y1={baselineY} x2={plotX + plotW} y2={baselineY} stroke={CHART_AXIS} strokeWidth={1} />

        <text x={plotX - 6} y={baselineY + 3} fill={CHART_STAT} fontSize={8} fontFamily="ui-monospace, monospace" textAnchor="end">
          0
        </text>
        <text x={plotX - 6} y={PAD.t + 9} fill={CHART_STAT} fontSize={8} fontFamily="ui-monospace, monospace" textAnchor="end">
          {format(maxVal)}
        </text>

        {stats.map((step, i) => {
          const barX = plotX + stepSpan * i
          const v = value(step)
          const barH = (v / maxVal) * PLOT_H
          const color = barColor(step.failed)
          const centerX = barX + stepSpan / 2

          return (
            <g key={step.moduleId}>
              <rect
                x={barX}
                y={baselineY - barH}
                width={stepSpan}
                height={Math.max(barH, v > 0 ? 1 : 0)}
                fill={color.fill}
              />
              {barH > 0 && (
                <line
                  x1={barX}
                  y1={baselineY - barH}
                  x2={barX + stepSpan}
                  y2={baselineY - barH}
                  stroke={color.stroke}
                  strokeWidth={1}
                />
              )}
              {barH >= 16 && (
                <text
                  x={centerX}
                  y={baselineY - barH - 4}
                  fill={CHART_STAT}
                  fontSize={7}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                >
                  {format(v)}
                </text>
              )}
              {showStepLabels && (
                <>
                  <text
                    x={centerX}
                    y={baselineY + 14}
                    fill={CHART_STAT}
                    fontSize={8}
                    fontFamily="ui-monospace, monospace"
                    textAnchor="middle"
                  >
                    {i + 1}
                  </text>
                  <text
                    x={centerX}
                    y={baselineY + 28}
                    fill={CHART_STAT}
                    fontSize={7}
                    fontFamily="ui-monospace, monospace"
                    textAnchor="end"
                    transform={`rotate(-40, ${centerX}, ${baselineY + 28})`}
                  >
                    {truncateLabel(step.label)}
                  </text>
                </>
              )}
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
    <div className="rounded-md border-2 border-border bg-muted/10 p-3">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
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
          <span className={CHART_OK_TEXT_CLASS}>{ok} ok</span>
          {failed > 0 && (
            <>
              {" · "}
              <span className={CHART_ERR_TEXT_CLASS}>{failed} failed</span>
            </>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <StepMetricBarChart
          title="Mean latency"
          stats={stats}
          value={(s) => s.meanMs}
          format={formatMs}
          showStepLabels={false}
        />
        <StepMetricBarChart
          title="Mean cost"
          stats={stats}
          value={(s) => s.meanCostCents}
          format={formatCostCents}
          showStepLabels
        />
      </div>

      <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
        Connected bars = steps in order · green = ok · red = any failed run
      </p>
    </div>
  )
}

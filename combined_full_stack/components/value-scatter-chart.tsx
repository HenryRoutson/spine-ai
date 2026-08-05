"use client"

import { useMemo } from "react"
import { buildValueScatter, LlmCallDisplayStatus, normalCurvePoints, type MetricScatter } from "@/lib/llm-distribution"

const W = 280
const H = 108
const PAD = { l: 6, r: 6, t: 6, b: 28 }
import { CHART_STAT, useStatusPalette } from "@/lib/chart-colors"
const PLOT_STROKE = "currentColor"
const R = 5

function xScale(min: number, max: number, v: number): number {
  const span = Math.max(1, max - min)
  return PAD.l + ((v - min) / span) * (W - PAD.l - PAD.r)
}

function yScale(v: number, plotH: number): number {
  return PAD.t + plotH - v * plotH
}

export function ValueScatterChart({
  title,
  scatter: scatterProp,
  items,
  format,
  axisLabel,
  count,
  axisMin,
}: {
  title: string
  scatter?: MetricScatter | null
  items?: { value: number; status: LlmCallDisplayStatus }[]
  format: (n: number) => string
  axisLabel: string
  count: number
  axisMin?: number
}) {
  const palette = useStatusPalette()
  const scatter = useMemo(
    () => scatterProp ?? (items ? buildValueScatter(items) : null),
    [scatterProp, items],
  )
  if (!scatter) return null

  const xMin = axisMin ?? scatter.min
  const xMax = scatter.max
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const curveH = plotH * 0.38
  const curve = normalCurvePoints(scatter.mean, scatter.std, xMin, xMax, 1, 40)
  const fmt = format
  const meanX = xScale(xMin, xMax, scatter.mean)
  const stdLo = xScale(xMin, xMax, scatter.mean - scatter.std)
  const stdHi = xScale(xMin, xMax, scatter.mean + scatter.std)
  const plotX = PAD.l
  const plotY = PAD.t

  return (
    <div className="min-w-0 rounded border border-border bg-background p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-1 border-b border-border pb-1">
        <span className="truncate font-mono text-[9px] font-medium uppercase tracking-wide text-foreground">
          {title}
        </span>
        <span className="shrink-0 font-mono text-[8px] text-muted-foreground">
          μ={fmt(scatter.mean)} · σ={fmt(scatter.std)} · n={count}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[108px] w-full text-border" aria-hidden>
        <rect
          x={plotX}
          y={plotY}
          width={plotW}
          height={plotH}
          className="fill-muted/20"
          stroke={PLOT_STROKE}
          strokeWidth={1.5}
          rx={2}
        />
        {curve.length > 1 && (
          <path
            d={curve
              .map((p, i) => {
                const x = xScale(xMin, xMax, p.x)
                const y = plotY + curveH - p.y * curveH
                return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
              })
              .join(" ")}
            fill="none"
            stroke={CHART_STAT}
            strokeWidth={1.5}
            opacity={0.9}
          />
        )}
        {scatter.std > 0 && (
          <>
            <line
              x1={stdLo}
              x2={stdLo}
              y1={plotY}
              y2={plotY + plotH}
              stroke={CHART_STAT}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.65}
            />
            <line
              x1={stdHi}
              x2={stdHi}
              y1={plotY}
              y2={plotY + plotH}
              stroke={CHART_STAT}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.65}
            />
          </>
        )}
        <line
          x1={meanX}
          x2={meanX}
          y1={plotY}
          y2={plotY + plotH}
          stroke={CHART_STAT}
          strokeWidth={1.5}
          opacity={0.85}
        />
        {scatter.points.map((pt) => {
          const cx = xScale(xMin, xMax, pt.x)
          const cy = yScale(pt.y, plotH)
          const fill =
            pt.status === LlmCallDisplayStatus.Ok ? palette.ok : pt.status === LlmCallDisplayStatus.Retried ? palette.retry : palette.err
          const stroke =
            pt.status === LlmCallDisplayStatus.Ok
              ? palette.okStroke
              : pt.status === LlmCallDisplayStatus.Retried
                ? palette.retryStroke
                : palette.errStroke
          return (
            <circle
              key={pt.index}
              cx={cx}
              cy={cy}
              r={R}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.75}
            />
          )
        })}
        <text x={plotX + 2} y={H - 14} fill={CHART_STAT} fontSize={7} fontFamily="ui-monospace, monospace">
          {fmt(xMin)}
        </text>
        <text
          x={plotX + plotW - 2}
          y={H - 14}
          fill={CHART_STAT}
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          textAnchor="end"
        >
          {fmt(xMax)}
        </text>
        <text
          x={W / 2}
          y={H - 4}
          fill={CHART_STAT}
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
        >
          {axisLabel}
        </text>
      </svg>
    </div>
  )
}

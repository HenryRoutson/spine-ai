"use client"

import { useMemo } from "react"
import type { LlmCallRecord } from "@/lib/types"
import {
  buildMetricScatter,
  formatMetric,
  metricAxisLabel,
  normalCurvePoints,
  type MetricField,
} from "@/lib/llm-distribution"

const W = 300
const H = 120
const PAD = { l: 8, r: 8, t: 10, b: 20 }
const OK = "#22c55e"
const OK_STROKE = "#15803d"
const ERR = "#ef4444"
const ERR_STROKE = "#b91c1c"
const STAT = "#94a3b8"
const PLOT_STROKE = "currentColor"
const R = 5

function xScale(min: number, max: number, v: number): number {
  const span = Math.max(1, max - min)
  return PAD.l + ((v - min) / span) * (W - PAD.l - PAD.r)
}

function yScale(v: number, plotH: number): number {
  return PAD.t + plotH - v * plotH
}

function MetricScatterChart({
  title,
  field,
  calls,
}: {
  title: string
  field: MetricField
  calls: LlmCallRecord[]
}) {
  const scatter = useMemo(() => buildMetricScatter(calls, field), [calls, field])
  if (!scatter) return null

  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const curveH = plotH * 0.38
  const curve = normalCurvePoints(scatter.mean, scatter.std, scatter.min, scatter.max, 1, 40)
  const fmt = (n: number) => formatMetric(field, n)

  const meanX = xScale(scatter.min, scatter.max, scatter.mean)
  const stdLo = xScale(scatter.min, scatter.max, scatter.mean - scatter.std)
  const stdHi = xScale(scatter.min, scatter.max, scatter.mean + scatter.std)
  const plotX = PAD.l
  const plotY = PAD.t

  return (
    <div className="min-w-0 flex-1 rounded-md border-2 border-border bg-background p-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-foreground">
          {title}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          μ={fmt(scatter.mean)} · σ={fmt(scatter.std)} · n={calls.length}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full text-border" aria-hidden>
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
                const x = xScale(scatter.min, scatter.max, p.x)
                const y = plotY + curveH - p.y * curveH
                return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
              })
              .join(" ")}
            fill="none"
            stroke={STAT}
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
              stroke={STAT}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.65}
            />
            <line
              x1={stdHi}
              x2={stdHi}
              y1={plotY}
              y2={plotY + plotH}
              stroke={STAT}
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
          stroke={STAT}
          strokeWidth={1.5}
          opacity={0.85}
        />
        {scatter.points.map((pt) => {
          const cx = xScale(scatter.min, scatter.max, pt.x)
          const cy = yScale(pt.y, plotH)
          const ok = pt.status === "ok"
          return (
            <circle
              key={pt.index}
              cx={cx}
              cy={cy}
              r={R}
              fill={ok ? OK : ERR}
              stroke={ok ? OK_STROKE : ERR_STROKE}
              strokeWidth={1.75}
            />
          )
        })}
        <text x={plotX + 2} y={H - 5} fill={STAT} fontSize={8} fontFamily="ui-monospace, monospace">
          {fmt(scatter.min)}
        </text>
        <text
          x={plotX + plotW - 2}
          y={H - 5}
          fill={STAT}
          fontSize={8}
          fontFamily="ui-monospace, monospace"
          textAnchor="end"
        >
          {fmt(scatter.max)}
        </text>
        <text
          x={W / 2}
          y={H - 5}
          fill={STAT}
          fontSize={8}
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
        >
          {metricAxisLabel(field)}
        </text>
      </svg>
    </div>
  )
}

export function LlmCallDistribution({
  calls,
  compact,
}: {
  calls: LlmCallRecord[]
  compact?: boolean
}) {
  if (calls.length === 0) return null

  const ok = calls.filter((c) => c.status === "ok").length
  const failed = calls.length - ok

  return (
    <div
      className={
        compact
          ? "mt-2 pl-7"
          : "rounded-md border-2 border-border bg-muted/10 p-3"
      }
    >
      {!compact && (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
          <h4 className="font-mono text-[10px] font-medium uppercase tracking-wide text-foreground">
            LLM call distributions
          </h4>
          <span className="font-mono text-[9px] text-muted-foreground">
            <span className="text-[#22c55e]">{ok} ok</span>
            {failed > 0 && (
              <>
                {" · "}
                <span className="text-[#ef4444]">{failed} failed</span>
              </>
            )}
          </span>
        </div>
      )}
      {compact && (
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">
          Call distributions ·{" "}
          <span className="text-[#22c55e]">{ok} ok</span>
          {failed > 0 && (
            <>
              {" · "}
              <span className="text-[#ef4444]">{failed} failed</span>
            </>
          )}
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-3">
        <MetricScatterChart title="Input (chars)" field="inputChars" calls={calls} />
        <MetricScatterChart title="Output (chars)" field="outputChars" calls={calls} />
        <MetricScatterChart title="Response latency" field="latencyMs" calls={calls} />
      </div>
      <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
        Each dot = one call · green = ok · red = failed · gray = μ ± σ
      </p>
    </div>
  )
}

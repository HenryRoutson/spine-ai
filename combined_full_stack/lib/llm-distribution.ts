import type { LlmCallRecord, RunStep } from "@/lib/types"

export type MetricField = "inputChars" | "outputChars" | "latencyMs"

export type ScatterPoint = {
  x: number
  y: number
  status: LlmCallRecord["status"]
  index: number
}

export type MetricScatter = {
  points: ScatterPoint[]
  mean: number
  std: number
  min: number
  max: number
}

export function distributionStats(values: number[]): { mean: number; std: number } {
  const n = values.length
  if (n === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((a, v) => a + v, 0) / n
  if (n === 1) return { mean, std: 0 }
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n
  return { mean, std: Math.sqrt(variance) }
}

// AI : jitter y by call index so overlapping x values stay visible on the strip.
function jitterY(index: number, total: number, xKey: number): number {
  const band = (index + 0.5) / total
  const wobble = (((xKey * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.12
  return Math.min(0.96, Math.max(0.04, band + wobble))
}

export function buildValueScatter(
  items: { value: number; status: LlmCallRecord["status"] }[],
): MetricScatter | null {
  if (items.length === 0) return null
  const values = items.map((i) => i.value)
  const { mean, std } = distributionStats(values)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = items.map((item, index) => ({
    x: item.value,
    y: jitterY(index, items.length, item.value + index),
    status: item.status,
    index,
  }))
  return { points, mean, std, min, max }
}

export function buildMetricScatter(calls: LlmCallRecord[], field: MetricField): MetricScatter | null {
  return buildValueScatter(
    calls.map((call) => ({ value: call[field], status: call.status })),
  )
}

// AI : normal PDF scaled to overlay height for the gray mean/std curve.
export function normalCurvePoints(
  mean: number,
  std: number,
  min: number,
  max: number,
  peakHeight: number,
  points = 48,
): { x: number; y: number }[] {
  if (std <= 0 || peakHeight <= 0) {
    return [{ x: mean, y: peakHeight }]
  }
  const pad = std * 2.5
  const x0 = Math.max(min, mean - pad)
  const x1 = Math.min(max + 1, mean + pad)
  const coeff = 1 / (std * Math.sqrt(2 * Math.PI))
  const raw: number[] = []
  for (let i = 0; i <= points; i++) {
    const x = x0 + ((x1 - x0) * i) / points
    raw.push(coeff * Math.exp(-0.5 * ((x - mean) / std) ** 2))
  }
  const pdfMax = Math.max(...raw, 1e-9)
  return raw.map((y, i) => ({
    x: x0 + ((x1 - x0) * i) / points,
    y: (y / pdfMax) * peakHeight,
  }))
}

export function formatChars(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function formatMs(n: number): string {
  if (n >= 60000) return `${(n / 60000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`
  return `${Math.round(n)}ms`
}

export function formatCostCents(n: number): string {
  if (n >= 100) return `$${(n / 100).toFixed(2)}`
  return `${n.toFixed(2)}c`
}

const METRIC_FORMAT: Record<MetricField, (n: number) => string> = {
  inputChars: formatChars,
  outputChars: formatChars,
  latencyMs: formatMs,
}

const METRIC_AXIS: Record<MetricField, string> = {
  inputChars: "chars",
  outputChars: "chars",
  latencyMs: "latency",
}

export function formatMetric(field: MetricField, n: number): string {
  return METRIC_FORMAT[field](n)
}

export function metricAxisLabel(field: MetricField): string {
  return METRIC_AXIS[field]
}

// AI : older runs without per-call telemetry — synthesize one point from step previews.
export function llmCallsFromStep(step: RunStep): LlmCallRecord[] {
  if (step.llmCalls?.length) return step.llmCalls
  if (step.kind !== "llm" && step.kind !== "llm-batch") return []
  const failed = step.status === "error"
  return [
    {
      inputChars: step.inputPreview.length,
      outputChars: (step.outputJson ?? step.outputPreview).length,
      latencyMs: step.ms,
      status: failed ? "error" : "ok",
    },
  ]
}

export function collectRunLlmCalls(steps: RunStep[]): LlmCallRecord[] {
  return steps.flatMap((s) => llmCallsFromStep(s))
}

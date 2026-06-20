import type { LlmCallRecord, RunStep } from "@/lib/types"

export type LengthField = "inputChars" | "outputChars"

export type ScatterPoint = {
  x: number
  y: number
  status: LlmCallRecord["status"]
  index: number
}

export type LengthScatter = {
  points: ScatterPoint[]
  mean: number
  std: number
  min: number
  max: number
}

function lengthValues(calls: LlmCallRecord[], field: LengthField): number[] {
  return calls.map((c) => c[field])
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

export function buildLengthScatter(calls: LlmCallRecord[], field: LengthField): LengthScatter | null {
  if (calls.length === 0) return null
  const values = lengthValues(calls, field)
  const { mean, std } = distributionStats(values)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = calls.map((call, index) => ({
    x: call[field],
    y: jitterY(index, calls.length, call[field] + index),
    status: call.status,
    index,
  }))
  return { points, mean, std, min, max }
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

// AI : older runs without per-call telemetry — synthesize one point from step previews.
export function llmCallsFromStep(step: RunStep): LlmCallRecord[] {
  if (step.llmCalls?.length) return step.llmCalls
  if (step.kind !== "llm" && step.kind !== "llm-batch") return []
  const failed = step.status === "error"
  return [
    {
      inputChars: step.inputPreview.length,
      outputChars: (step.outputJson ?? step.outputPreview).length,
      status: failed ? "error" : "ok",
    },
  ]
}

export function collectRunLlmCalls(steps: RunStep[]): LlmCallRecord[] {
  return steps.flatMap((s) => llmCallsFromStep(s))
}

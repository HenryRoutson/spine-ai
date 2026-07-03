import { FailureKind, LlmCallStatus, RunStepStatus } from "@/lib/types"
import type { LlmCallRecord, RunFailureRecord, RunStep } from "@/lib/types"
import { formatCostCents, formatMs } from "@/lib/format"

export type MetricField = "inputChars" | "outputChars" | "latencyMs"

export type LlmCallDisplayStatus = LlmCallRecord["status"] | "retried"

export type LlmCallSummary = {
  ok: number
  retried: number
  failed: number
  displayStatuses: LlmCallDisplayStatus[]
}

export type ScatterPoint = {
  x: number
  y: number
  status: LlmCallDisplayStatus
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

export function failureKindLabel(kind: FailureKind): string {
  switch (kind) {
    case FailureKind.Provider:
      return "LLM provider"
    case FailureKind.JsonParse:
      return "JSON parse"
    case FailureKind.Schema:
      return "Schema validation (pydantic/zod)"
    case FailureKind.StepOutput:
      return "Step output validation (pydantic/zod)"
  }
}

export function failuresFromLlmCalls(
  calls: LlmCallRecord[] | undefined,
  stepSucceeded: boolean,
): RunFailureRecord[] {
  if (!calls?.length) return []
  const display = displayStatusesForCalls(calls, stepSucceeded)
  return calls
    .map((call, i) => ({ call, display: display[i] }))
    .filter(({ call }) => call.failureKind)
    .map(({ call, display }) => ({
      kind: call.failureKind!,
      detail: call.failureDetail ?? (call.httpStatus ? `HTTP ${call.httpStatus}` : ""),
      attempt: call.attempt,
      recovered: display === "retried",
    }))
}

export function stepFailures(step: RunStep): RunFailureRecord[] {
  if (step.failures?.length) return step.failures
  return failuresFromLlmCalls(llmCallsFromStep(step), step.status !== RunStepStatus.Error)
}

export function displayStatusesForCalls(
  calls: LlmCallRecord[],
  stepSucceeded: boolean,
): LlmCallDisplayStatus[] {
  return calls.map((call, i) => {
    if (call.status === LlmCallStatus.Ok) return LlmCallStatus.Ok
    const recovered = stepSucceeded && calls.slice(i + 1).some((c) => c.status === LlmCallStatus.Ok)
    return recovered ? "retried" : LlmCallStatus.Error
  })
}

export function summarizeLlmCalls(calls: LlmCallRecord[], stepSucceeded = true): LlmCallSummary {
  const displayStatuses = displayStatusesForCalls(calls, stepSucceeded)
  return {
    ok: displayStatuses.filter((s) => s === "ok").length,
    retried: displayStatuses.filter((s) => s === "retried").length,
    failed: displayStatuses.filter((s) => s === "error").length,
    displayStatuses,
  }
}

export function buildValueScatter(
  items: { value: number; status: LlmCallDisplayStatus }[],
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

export function buildMetricScatter(
  calls: LlmCallRecord[],
  field: MetricField,
  stepSucceeded = true,
): MetricScatter | null {
  const summary = summarizeLlmCalls(calls, stepSucceeded)
  return buildValueScatter(
    calls.map((call, i) => ({
      value: call[field],
      status: summary.displayStatuses[i],
    })),
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

export { formatCents, formatCostCents, formatUsdFromCents, formatMs } from "@/lib/format"

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
  const failed = step.status === RunStepStatus.Error
  return [
    {
      inputChars: step.inputPreview.length,
      outputChars: (step.outputJson ?? step.outputPreview).length,
      latencyMs: step.ms,
      status: failed ? LlmCallStatus.Error : LlmCallStatus.Ok,
    },
  ]
}

export function descriptionCheckLlmCallsFromStep(step: RunStep): LlmCallRecord[] {
  return step.descriptionCheckLlmCalls ?? []
}

export function collectRunLlmCalls(steps: RunStep[]): LlmCallRecord[] {
  return steps.flatMap((s) => llmCallsFromStep(s))
}

export function summarizeRunLlmCalls(steps: RunStep[]): LlmCallSummary {
  const perStep = steps
    .map((step) => summarizeLlmCalls(llmCallsFromStep(step), step.status !== RunStepStatus.Error))
    .filter((s) => s.ok + s.retried + s.failed > 0)
  return {
    ok: perStep.reduce((n, s) => n + s.ok, 0),
    retried: perStep.reduce((n, s) => n + s.retried, 0),
    failed: perStep.reduce((n, s) => n + s.failed, 0),
    displayStatuses: perStep.flatMap((s) => s.displayStatuses),
  }
}

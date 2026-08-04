import type { PipelineRun, RunStep } from "@/lib/types"

function sumStepMs(steps: readonly RunStep[]): number {
  return steps.reduce((a, s) => a + (s.ms ?? 0), 0)
}

function sumLlmLatencyMs(steps: readonly RunStep[]): number {
  return steps.reduce((a, s) => {
    const calls = [...(s.llmCalls ?? []), ...(s.descriptionCheckLlmCalls ?? [])]
    return a + calls.reduce((b, c) => b + (c.latencyMs ?? 0), 0)
  }, 0)
}

function sumStepBilledCents(steps: readonly RunStep[]): number {
  return +steps.reduce((a, s) => a + (s.costCents ?? 0), 0).toFixed(4)
}

function sumStepSavedCents(steps: readonly RunStep[]): number {
  return +steps.reduce((a, s) => a + (s.savedCostCents ?? 0), 0).toFixed(4)
}

// AI : headline stats — stored totals can be 0 on cache-heavy or legacy runs; fall back to step traces.
export function runTotalMs(run: PipelineRun): number {
  const stored = Number.isFinite(run.totalMs) ? run.totalMs : 0
  if (stored > 0) return stored
  const fromSteps = sumStepMs(run.steps)
  if (fromSteps > 0) return fromSteps
  return sumLlmLatencyMs(run.steps)
}

export function runBilledCents(run: PipelineRun): number {
  const stored = Number.isFinite(run.billedCents) ? run.billedCents : 0
  if (stored > 0) return stored
  return sumStepBilledCents(run.steps)
}

export function runSavedCents(run: PipelineRun): number {
  const stored = Number.isFinite(run.savedCents) ? run.savedCents : 0
  if (stored > 0) return stored
  return sumStepSavedCents(run.steps)
}

// AI : server persists wall-clock latency when per-step ms under-reports (cache hits used to write ms=0).
export function finalizeRunMetrics(
  steps: readonly RunStep[],
  startedAt: number,
): { totalMs: number; billedCents: number } {
  const stepMs = sumStepMs(steps)
  const wallMs = Math.max(0, Date.now() - startedAt)
  return {
    totalMs: Math.max(stepMs, wallMs),
    billedCents: sumStepBilledCents(steps),
  }
}

// AI : slim list rows from GET /api/state omit heavy step payloads — hydrate via GET /api/runs/:id.
export function isSlimPipelineRun(run: PipelineRun): boolean {
  if (!run.steps.length) return false
  return run.steps.every((s) => !s.outputJson && !(s.llmCalls?.length) && !(s.serverLogs?.length))
}

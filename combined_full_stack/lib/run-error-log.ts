// AI : extract error-only slices from pipeline runs — for copy, view, and diagnosis context.

import { failuresFromLlmCalls } from "@/lib/llm-distribution"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { formatRunErrorForDisplay } from "@/lib/run-errors"
import { enrichRunModules, modulesFromRunSteps } from "@/lib/pipeline-run-diff"
import { JobLogLevel } from "@/lib/run-types"
import type { PipelineModule, PipelineRun, RunStep } from "@/lib/types"

export type RunErrorFilter = "all" | "errors"

export function runHasErrors(run: PipelineRun): boolean {
  if (run.status === "error") return true
  if (run.test?.results.some((r) => r.status === "fail")) return true
  return run.steps.some((s) => s.status === "error")
}

export function filterRunsByErrorStatus(runs: PipelineRun[], filter: RunErrorFilter): PipelineRun[] {
  if (filter === "all") return runs
  return runs.filter(runHasErrors)
}

function errorServerLogLines(step: RunStep): string[] {
  return (step.serverLogs ?? [])
    .filter((l) => l.level === JobLogLevel.Error || l.level === JobLogLevel.Warn)
    .map((l) => `[${l.level}] ${l.tag}: ${l.line}`)
}

function stepErrorLines(step: RunStep): string[] {
  const lines: string[] = []
  if (step.status === "error" && step.outputPreview.trim()) {
    lines.push(step.outputPreview.trim())
  }
  const llmFailures = failuresFromLlmCalls(step.llmCalls, step.status !== "error")
  const descFailures = failuresFromLlmCalls(
    step.descriptionCheckLlmCalls,
    step.inputDescriptionCheck?.matches !== false,
  )
  const mergedFailures = [...(step.failures ?? []), ...llmFailures, ...descFailures]
  for (const f of mergedFailures) {
    if (f.recovered) continue
    lines.push(`[${f.kind}] ${f.detail}`)
  }
  lines.push(...errorServerLogLines(step))
  return lines
}

export function runErrorSteps(run: PipelineRun): RunStep[] {
  return run.steps.filter((s) => stepErrorLines(s).length > 0 || s.status === "error")
}

export function runErrorLogText(run: PipelineRun): string {
  const lines: string[] = []
  lines.push(`Run: ${run.id}`)
  lines.push(`Status: ${run.status}`)
  lines.push(`Started: ${new Date(run.startedAt).toISOString()}`)
  lines.push(`Duration: ${formatSecondsShort(run.totalMs)}`)
  lines.push(`Cost: ${formatCostCents(run.billedCents)}`)

  const display = formatRunErrorForDisplay(run)
  if (display) {
    lines.push("")
    lines.push("── Summary ──")
    lines.push(`${display.title}: ${display.message}`)
    if (display.detail?.trim() && display.detail.trim() !== display.message.trim()) {
      lines.push(display.detail.trim())
    }
  }

  if (run.test?.results.some((r) => r.status === "fail")) {
    lines.push("")
    lines.push(`── Test failures · ${run.test.testDocName} ──`)
    for (const r of run.test.results.filter((x) => x.status === "fail")) {
      lines.push(`[FAIL] ${r.label}${r.diffPath ? ` (diff at ${r.diffPath})` : ""}`)
      if (r.deterministicDiff) lines.push(r.deterministicDiff)
      if (r.expected !== undefined) lines.push(`Expected: ${JSON.stringify(r.expected)}`)
      if (r.actual !== undefined) lines.push(`Actual: ${JSON.stringify(r.actual)}`)
    }
  }

  const errorSteps = runErrorSteps(run)
  if (errorSteps.length) {
    lines.push("")
    lines.push("── Error steps ──")
    errorSteps.forEach((step, i) => {
      lines.push("")
      lines.push(`${i + 1}. [${step.status.toUpperCase()}] ${step.label}`)
      for (const errLine of stepErrorLines(step)) {
        errLine.split("\n").forEach((l) => lines.push(`   ${l}`))
      }
    })
  }

  return lines.join("\n")
}

export type RunErrorLogJson = {
  kind: "pipeline_run_error"
  version: 1
  run: {
    id: string
    status: string
    startedAt: number
    totalMs: number
    billedCents: number
    model: string
    notes?: string
  }
  summary?: ReturnType<typeof formatRunErrorForDisplay>
  pipelineAtRun: Array<{
    id: string
    kind: string
    label: string
    status: string
    model?: string
    ms: number
    costCents: number
    structureIn?: string
    structureOut?: string
    prompt?: string
    note?: string
  }>
  errorSteps: Array<{
    moduleId: string
    label: string
    kind: string
    status: string
    errors: string[]
    inputPreview?: string
    outputPreview?: string
    serverLogErrors?: string[]
  }>
  testFailures?: Array<{
    label: string
    diffPath?: string
    deterministicDiff?: string
    expected?: unknown
    actual?: unknown
  }>
}

export function runErrorLogJsonObject(
  run: PipelineRun,
  pipelineModules: PipelineModule[],
): RunErrorLogJson {
  const modulesAtRun = enrichRunModules(modulesFromRunSteps(run.steps), pipelineModules)
  const errorSteps = runErrorSteps(run).map((step) => ({
    moduleId: step.moduleId,
    label: step.label,
    kind: step.kind,
    status: step.status,
    errors: stepErrorLines(step),
    inputPreview: step.inputPreview?.trim() || undefined,
    outputPreview: step.status === "error" ? step.outputPreview?.trim() : undefined,
    serverLogErrors: errorServerLogLines(step),
  }))

  return {
    kind: "pipeline_run_error",
    version: 1,
    run: {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      totalMs: run.totalMs,
      billedCents: run.billedCents,
      model: run.model,
      notes: run.notes,
    },
    summary: formatRunErrorForDisplay(run) ?? undefined,
    pipelineAtRun: run.steps.map((step, i) => ({
      id: step.moduleId,
      kind: step.kind,
      label: step.label,
      status: step.status,
      model: step.model,
      ms: step.ms,
      costCents: step.costCents,
      ...(modulesAtRun[i]
        ? {
            structureIn: modulesAtRun[i]!.inStructureId,
            structureOut: modulesAtRun[i]!.outStructureId,
            prompt: modulesAtRun[i]!.prompt?.trim() || undefined,
            note: modulesAtRun[i]!.note?.trim() || undefined,
          }
        : {}),
    })),
    errorSteps,
    testFailures: run.test?.results
      .filter((r) => r.status === "fail")
      .map((r) => ({
        label: r.label,
        diffPath: r.diffPath,
        deterministicDiff: r.deterministicDiff,
        expected: r.expected,
        actual: r.actual,
      })),
  }
}

export function runErrorLogJson(run: PipelineRun, pipelineModules: PipelineModule[]): string {
  return JSON.stringify(runErrorLogJsonObject(run, pipelineModules), null, 2)
}

// AI : clipboard payload for failed test steps — only the diverging fields (input / process / output / expected).

import { stablePrettyJson } from "@/lib/deep_equal"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { testStepDiffFields } from "@/lib/testing-files"
import { RunTestStepStatus, type PipelineRun, type RunTestStepResult } from "@/lib/types"

function appendJsonBlock(lines: string[], label: string, value: unknown) {
  lines.push(`${label}:`)
  for (const l of stablePrettyJson(value).split("\n")) lines.push(`  ${l}`)
}

export function testStepIsFailure(r: RunTestStepResult): boolean {
  return (
    r.status === RunTestStepStatus.Fail ||
    r.status === RunTestStepStatus.NotReached ||
    r.inputDescriptionCheck?.matches === false
  )
}

export type TestFailureFieldRecord = {
  path: string
  kind: "deterministic" | "semantic"
  expected?: unknown
  actual?: unknown
  reason?: string
}

export type TestFailureFormatOpts = {
  testDocName?: string
  run?: PipelineRun | null
  runError?: string | null
  // AI : step input previews can be huge (e.g. map over 15 grading prompts) — off by default.
  includePipelineInput?: boolean
}

export type TestFailureStepRecord = {
  label: string
  statusTag: string
  inputLines: string[]
  inputSummary?: string
  relevantInputItems?: string[]
  inputCheckFailed: boolean
  inputCheckReason?: string
  inputCheckItems?: Array<{ label?: string; reason: string }>
  notReached: boolean
  diffPath?: string
  fields: TestFailureFieldRecord[]
  // AI : when field extraction yields nothing — e.g. missing actual on a fail row.
  fallbackExpected?: unknown
  fallbackActual?: unknown
}

function statusTagForStep(r: RunTestStepResult): string {
  return r.inputDescriptionCheck?.matches === false && r.status === RunTestStepStatus.Skipped
    ? "INPUT CHECK"
    : r.status.toUpperCase()
}

function fieldRecordsForStep(r: RunTestStepResult): TestFailureFieldRecord[] {
  const fields: TestFailureFieldRecord[] = testStepDiffFields(r).map((f) => ({
    path: f.path,
    kind: "deterministic",
    expected: f.expected,
    actual: f.actual,
    reason: r.deterministicDiffExplanations?.find((d) => d.path === f.path)?.reason.trim() || undefined,
  }))
  for (const pr of r.probabilisticResults?.filter((x) => !x.pass) ?? []) {
    fields.push({
      path: pr.path,
      kind: "semantic",
      expected: pr.expected,
      actual: pr.actual,
      reason: pr.reason.trim() || undefined,
    })
  }
  return fields
}

function relevantInputItemLabels(
  fields: TestFailureFieldRecord[],
  run: PipelineRun | null | undefined,
  label: string,
): string[] {
  const runStep = run?.steps.find((s) => labelAsStateKey(s.label) === labelAsStateKey(label))
  const items = runStep?.inputPreviewItems
  if (!items?.length) return []
  const indexes = new Set<number>()
  for (const f of fields) {
    const m = /^\[(\d+)\]/.exec(f.path)
    if (m) indexes.add(Number(m[1]))
  }
  return [...indexes]
    .sort((a, b) => a - b)
    .map((i) => items[i]?.label)
    .filter((x): x is string => !!x)
}

export function collectTestFailureSteps(
  results: RunTestStepResult[],
  opts?: Pick<TestFailureFormatOpts, "run" | "includePipelineInput">,
): TestFailureStepRecord[] {
  const run = opts?.run
  const includePipelineInput = opts?.includePipelineInput ?? false
  return results.filter(testStepIsFailure).map((r) => {
    const fields = fieldRecordsForStep(r)
    const hasFieldFailures = fields.length > 0
    const fallback =
      !hasFieldFailures &&
      r.inputDescriptionCheck?.matches !== false &&
      (r.expected !== undefined || r.actual !== undefined)
        ? { expected: r.expected, actual: r.actual }
        : undefined
    const inputLines = includePipelineInput ? stepInputLines(run, r.label) : []
    const inputSummary = includePipelineInput ? undefined : stepInputSummary(run, r.label)
    const relevantInputItems = includePipelineInput
      ? undefined
      : relevantInputItemLabels(fields, run, r.label)
    return {
      label: r.label,
      statusTag: statusTagForStep(r),
      inputLines,
      inputSummary,
      relevantInputItems,
      inputCheckFailed: r.inputDescriptionCheck?.matches === false,
      inputCheckReason: r.inputDescriptionCheck?.reason.trim() || undefined,
      inputCheckItems: r.inputDescriptionCheck?.items
        ?.filter((i) => !i.matches)
        .map((i) => ({ label: i.label, reason: i.reason.trim() })),
      notReached: r.status === RunTestStepStatus.NotReached,
      diffPath: r.diffPath,
      fields,
      fallbackExpected: fallback?.expected,
      fallbackActual: fallback?.actual,
    }
  })
}

function stepInputLines(run: PipelineRun | null | undefined, label: string): string[] {
  const runStep = run?.steps.find((s) => labelAsStateKey(s.label) === labelAsStateKey(label))
  if (!runStep) return []
  const lines: string[] = []
  if (runStep.inputPreviewItems?.length) {
    for (const item of runStep.inputPreviewItems) {
      lines.push(`  ── ${item.label} ──`)
      for (const l of item.text.split("\n")) lines.push(`  ${l}`)
    }
  } else if (runStep.inputPreview?.trim()) {
    for (const l of runStep.inputPreview.trim().split("\n")) lines.push(`  ${l}`)
  }
  return lines
}

function stepInputSummary(run: PipelineRun | null | undefined, label: string): string | undefined {
  const runStep = run?.steps.find((s) => labelAsStateKey(s.label) === labelAsStateKey(label))
  if (!runStep) return undefined
  if (runStep.inputPreviewItems?.length) {
    return `${runStep.inputPreviewItems.length} batched item(s)`
  }
  const preview = runStep.inputPreview?.trim()
  if (!preview) return undefined
  const lineCount = preview.split("\n").length
  return lineCount > 1 ? `${lineCount} lines` : "1 line"
}

export function testResultsHaveFailures(results: RunTestStepResult[]): boolean {
  return results.some(testStepIsFailure)
}

function appendStepFailure(lines: string[], step: TestFailureStepRecord) {
  lines.push(`── [${step.statusTag}] ${step.label} ──`)
  lines.push(`process: ${step.label}`)

  if (step.inputLines.length) {
    lines.push("input:")
    lines.push(...step.inputLines)
  } else if (step.inputSummary) {
    lines.push(`input: ${step.inputSummary} (toggle pipeline to expand)`)
    for (const itemLabel of step.relevantInputItems ?? []) {
      lines.push(`  relevant: ${itemLabel}`)
    }
  }

  if (step.inputCheckFailed) {
    lines.push(
      `input check: matches false${step.inputCheckReason ? ` — ${step.inputCheckReason}` : ""}`,
    )
    for (const item of step.inputCheckItems ?? []) {
      lines.push(`  · ${item.label ?? "item"}${item.reason ? `: ${item.reason}` : ""}`)
    }
  }

  if (step.notReached) {
    if (step.fallbackExpected !== undefined) appendJsonBlock(lines, "expected", step.fallbackExpected)
    lines.push("output: — no output —")
    lines.push("")
    return
  }

  for (const f of step.fields) {
    lines.push(`field: ${f.path}${f.kind === "semantic" ? " (semantic)" : ""}`)
    if (f.expected !== undefined) appendJsonBlock(lines, "expected", f.expected)
    if (f.actual !== undefined) appendJsonBlock(lines, "output", f.actual)
    if (f.reason) lines.push(`reason: ${f.reason}`)
    lines.push("")
  }

  if (step.fields.length === 0 && (step.fallbackExpected !== undefined || step.fallbackActual !== undefined)) {
    if (step.diffPath) lines.push(`diff at: ${step.diffPath}`)
    if (step.fallbackExpected !== undefined) appendJsonBlock(lines, "expected", step.fallbackExpected)
    if (step.fallbackActual !== undefined) appendJsonBlock(lines, "output", step.fallbackActual)
    else lines.push("output: — no output —")
    lines.push("")
  }
}

export function formatTestFailuresForClipboard(
  results: RunTestStepResult[],
  opts?: TestFailureFormatOpts,
): string {
  const steps = collectTestFailureSteps(results, opts)
  const lines: string[] = []

  if (opts?.testDocName) lines.push(`Test: ${opts.testDocName}`)
  if (opts?.runError?.trim()) {
    lines.push(`Run error: ${opts.runError.trim()}`)
    lines.push("")
  }
  if (!steps.length) return lines.join("\n").trimEnd()

  lines.push(`${steps.length} failure${steps.length === 1 ? "" : "s"}`)
  lines.push("")
  for (const step of steps) appendStepFailure(lines, step)

  return lines.join("\n").trimEnd()
}

export function formatTestFailuresJsonObject(
  results: RunTestStepResult[],
  opts?: TestFailureFormatOpts,
) {
  const steps = collectTestFailureSteps(results, opts)
  if (!steps.length && !opts?.testDocName && !opts?.runError?.trim()) return undefined
  return {
    testDocName: opts?.testDocName,
    runError: opts?.runError?.trim() || undefined,
    includePipelineInput: opts?.includePipelineInput ?? false,
    failureCount: steps.length,
    failures: steps.map((step) => ({
      label: step.label,
      status: step.statusTag,
      diffPath: step.diffPath,
      inputSummary: step.inputSummary,
      relevantInputItems: step.relevantInputItems?.length ? step.relevantInputItems : undefined,
      inputLines: step.inputLines.length ? step.inputLines : undefined,
      inputCheck:
        step.inputCheckFailed
          ? {
              reason: step.inputCheckReason,
              items: step.inputCheckItems,
            }
          : undefined,
      notReached: step.notReached || undefined,
      fields: step.fields.map((f) => ({
        path: f.path,
        kind: f.kind,
        expected: f.expected,
        actual: f.actual,
        reason: f.reason,
      })),
      fallback:
        step.fields.length === 0 && (step.fallbackExpected !== undefined || step.fallbackActual !== undefined)
          ? { expected: step.fallbackExpected, actual: step.fallbackActual }
          : undefined,
    })),
  }
}

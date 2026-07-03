// AI : *_testing.json format — per-step expected outputs to pinpoint where a pipeline diverges.
// AI : validated against the live pipeline (labels + spine output types) since pipelines drift.

import { deepEqual, deepEqualDiffPath } from "@/lib/deep_equal"
import { namedInputDocNames, resolveNamedRunInputs, type ResolvedNamedInputs } from "@/lib/inference-presets"
import { labelAsStateKey, validatePipelineStateEntry } from "@/lib/server/pipeline_state"
import { tryParseJson } from "@/lib/json-utils"
import type { DocRef, PipelineModule, PipelineRun, Project, RunTestStepResult } from "@/lib/types"

export const TESTING_FILE_SUFFIX = "_testing.json"

type step_label_string = string
type doc_name_string = string

export type SpineTestFile = {
  description?: string
  // AI : input step label → doc name(s) so a test pins its own inputs
  inputs?: Record<step_label_string, doc_name_string | doc_name_string[]>
  // AI : step label → exact expected output; null = placeholder not yet filled in
  expectedOutputs: Record<step_label_string, unknown>
}

export type TestFileIssue = {
  level: "error" | "warning"
  where: string
  message: string
}

export type TestParseResult =
  | { ok: true; test: SpineTestFile }
  | { ok: false; error: string }

export function isTestingFileName(name: string): boolean {
  return name.toLowerCase().endsWith(TESTING_FILE_SUFFIX)
}

export function parseTestFile(content: string): TestParseResult {
  const parsed = tryParseJson(content, { trim: true })
  if (!parsed.ok) return { ok: false, error: `invalid json: ${parsed.error.message}` }
  const value = parsed.value
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "test file must be a JSON object" }
  }
  const obj = value as Record<string, unknown>
  const expected = obj.expectedOutputs
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    return { ok: false, error: 'missing "expectedOutputs" object (step label → expected value)' }
  }
  const inputs = obj.inputs
  if (inputs !== undefined && (inputs === null || typeof inputs !== "object" || Array.isArray(inputs))) {
    return { ok: false, error: '"inputs" must be an object (input step label → doc name)' }
  }
  return {
    ok: true,
    test: {
      description: typeof obj.description === "string" ? obj.description : undefined,
      inputs: inputs as SpineTestFile["inputs"],
      expectedOutputs: expected as SpineTestFile["expectedOutputs"],
    },
  }
}

const docNames = namedInputDocNames

function moduleByLabel(modules: PipelineModule[], label: string): PipelineModule | undefined {
  return modules.find((m) => labelAsStateKey(m.label) === labelAsStateKey(label))
}

export function inputModulesOf(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === "input")
}

// AI : does this test still fit the current pipeline? Labels may be stale, values may mismatch types.
export function validateTestFile(
  test: SpineTestFile,
  project: Project,
  projectDocs: DocRef[],
): TestFileIssue[] {
  const issues: TestFileIssue[] = []
  const modules = project.modules

  const expectedEntries = Object.entries(test.expectedOutputs)
  if (!expectedEntries.length) {
    issues.push({ level: "error", where: "expectedOutputs", message: "no expected outputs defined" })
  }
  for (const [label, value] of expectedEntries) {
    const mod = moduleByLabel(modules, label)
    if (!mod) {
      issues.push({
        level: "error",
        where: label,
        message: "step no longer exists in the pipeline — update this test",
      })
      continue
    }
    if (value === null) {
      issues.push({ level: "warning", where: label, message: "placeholder — fill in the expected output" })
      continue
    }
    const check = validatePipelineStateEntry(labelAsStateKey(label), value, project)
    if (!check.ok) {
      issues.push({
        level: "error",
        where: label,
        message: `expected value does not match this step's output type:\n${check.error}`,
      })
    }
  }

  const inputs = test.inputs ?? {}
  for (const [label, value] of Object.entries(inputs)) {
    const mod = moduleByLabel(modules, label)
    if (!mod) {
      issues.push({ level: "error", where: label, message: "input step not found in the pipeline" })
      continue
    }
    if (mod.kind !== "input") {
      issues.push({ level: "error", where: label, message: `"${label}" is a ${mod.kind} step, not an input` })
      continue
    }
    const names = docNames(value)
    if (!names.length) {
      issues.push({ level: "warning", where: label, message: "no document name set for this input" })
    }
    for (const name of names) {
      if (!projectDocs.some((d) => d.name === name)) {
        issues.push({ level: "error", where: label, message: `document "${name}" not found in this project` })
      }
    }
  }
  for (const m of inputModulesOf(modules)) {
    if (!(labelAsStateKey(m.label) in inputs) && !Object.keys(inputs).some((l) => labelAsStateKey(l) === labelAsStateKey(m.label))) {
      issues.push({
        level: "warning",
        where: m.label,
        message: "input step has no document assigned — the test cannot run until one is set",
      })
    }
  }
  return issues
}

export type ResolvedTestInputs = ResolvedNamedInputs

// AI : delegates to the shared named-inputs resolver (lib/inference-presets.ts).
export function resolveTestRunInputs(
  test: SpineTestFile,
  modules: PipelineModule[],
  projectDocs: DocRef[],
): ResolvedTestInputs {
  return resolveNamedRunInputs(test.inputs ?? {}, modules, projectDocs)
}

// AI : same shape the run persists (PipelineRun.test.results) — one type, no drift.
export type TestStepResult = RunTestStepResult
export type TestStepStatus = TestStepResult["status"]

// AI : the pinpoint view — first failing step in pipeline order is where the pipeline goes wrong.
export function compareRunToTest(
  run: PipelineRun,
  test: SpineTestFile,
  modules: PipelineModule[],
): TestStepResult[] {
  const expectedByKey = new Map(
    Object.entries(test.expectedOutputs).map(([label, v]) => [labelAsStateKey(label), v]),
  )
  const results: TestStepResult[] = []
  for (const m of modules) {
    const key = labelAsStateKey(m.label)
    if (!expectedByKey.has(key)) continue
    const expected = expectedByKey.get(key)
    const step = run.steps.find((s) => labelAsStateKey(s.label) === key)
    if (!step || step.outputJson === undefined) {
      results.push({ label: m.label, status: "not-reached", expected })
      continue
    }
    const parsed = tryParseJson(step.outputJson)
    const actual = parsed.ok ? parsed.value : step.outputJson
    if (deepEqual(actual, expected)) {
      results.push({ label: m.label, status: "pass", expected, actual })
    } else {
      results.push({
        label: m.label,
        status: "fail",
        diffPath: deepEqualDiffPath(actual, expected),
        expected,
        actual,
      })
    }
  }
  return results
}

export function firstFailure(results: TestStepResult[]): TestStepResult | undefined {
  return results.find((r) => r.status !== "pass")
}

// AI : starter file — golden outputs when the project ships them; otherwise just the output
// AI : steps as null placeholders. Tests are partial by design — cover only the steps you care about.
export function testFileSkeleton(project: Project, projectDocs: DocRef[]): string {
  const inputs: Record<step_label_string, doc_name_string> = {}
  for (const m of inputModulesOf(project.modules)) {
    const candidate = projectDocs.find((d) => d.label === "inference" && !isTestingFileName(d.name))
    inputs[labelAsStateKey(m.label)] = candidate?.name ?? ""
  }
  const golden = project.expectedOutputs ?? {}
  const expectedOutputs: Record<step_label_string, unknown> = {}
  for (const m of project.modules) {
    if (m.kind === "input") continue
    const key = labelAsStateKey(m.label)
    if (!key) continue
    if (key in golden) expectedOutputs[key] = golden[key]
  }
  if (!Object.keys(expectedOutputs).length) {
    for (const m of project.modules) {
      if (m.kind !== "output") continue
      const key = labelAsStateKey(m.label)
      if (key) expectedOutputs[key] = null
    }
  }
  const skeleton: SpineTestFile = {
    description: "Describe what this test checks",
    inputs,
    expectedOutputs,
  }
  return JSON.stringify(skeleton, null, 2)
}

export function nextTestFileName(existing: DocRef[]): string {
  const taken = new Set(existing.map((d) => d.name))
  for (let n = 1; ; n++) {
    const name = `test_${n}${TESTING_FILE_SUFFIX}`
    if (!taken.has(name)) return name
  }
}

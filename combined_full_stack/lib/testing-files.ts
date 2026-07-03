// AI : *_testing.json format — per-step expected outputs to pinpoint where a pipeline diverges.
// AI : validated against the live pipeline (labels + spine output types) since pipelines drift.

import { deepEqual, deepEqualDiffPath } from "@/lib/deep_equal"
import { jsonUnifiedDiff } from "@/lib/json-diff"
import { resolveNamedRunInputs, type ResolvedNamedInputs } from "@/lib/inference-presets"
import { validateNamedInputs, isInferenceSetupFileName } from "@/lib/inference-setup-files"
import { labelAsStateKey, validatePipelineStateEntry } from "@/lib/server/pipeline_state"
import { fieldToTypeExpr, stepSpineOutType } from "@/lib/server/type_expr"
import { tryParseJson } from "@/lib/json-utils"
import { DocLabel, ModuleKind, RunTestStepStatus, type RunTestProbabilisticResult } from "@/lib/types"
import type {
  DocRef,
  PipelineModule,
  PipelineRun,
  Project,
  RunTestStepResult,
  StructureModel,
  TypeExpr,
} from "@/lib/types"

export const TESTING_FILE_SUFFIX = "_testing.json"

type step_label_string = string
type doc_name_string = string

// AI : deterministic-ness is NOT stored here — it lives on structure fields
// AI : (ModelField.deterministic); probabilistic fields are exact-excluded then LLM-checked.
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


function moduleByLabel(modules: PipelineModule[], label: string): PipelineModule | undefined {
  return modules.find((m) => labelAsStateKey(m.label) === labelAsStateKey(label))
}

export function inputModulesOf(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === ModuleKind.Input)
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

  issues.push(...validateNamedInputs(test.inputs ?? {}, project, projectDocs))
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

// AI : input/combine steps are not scored — run log now stores the full value (same shape as expected).
function isComparableStep(m: PipelineModule): boolean {
  return m.kind !== ModuleKind.Input && m.kind !== ModuleKind.Combine
}

export function skipReasonForTestStep(m: PipelineModule): string | undefined {
  if (m.kind === ModuleKind.Input) return "Input — no computation"
  if (m.kind === ModuleKind.Combine) return "Combine — not scored"
  return undefined
}

// AI : golden fixtures use seed doc_ids; runs use content hashes — drop for skipped-step display.
function stripDocIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDocIds)
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "doc_id") continue
      out[k] = stripDocIds(v)
    }
    return out
  }
  return value
}

type field_path_string = string

// AI : static walk of a type — every field path whose structure definition says
// AI : deterministic:false (probabilistic — LLM prose that varies per run), e.g. "grades[].feedback".
function collectProbabilisticPaths(
  expr: TypeExpr | undefined,
  models: StructureModel[],
  path: field_path_string,
  seen: Set<string>,
  out: Set<field_path_string>,
): void {
  if (!expr) return
  switch (expr.kind) {
    case "optional":
      return collectProbabilisticPaths(expr.inner, models, path, seen, out)
    case "list":
    case "set":
      return collectProbabilisticPaths(expr.item, models, `${path}[]`, seen, out)
    case "ref": {
      if (seen.has(expr.modelId)) return
      const model = models.find((m) => m.id === expr.modelId)
      if (!model) return
      for (const f of model.fields) {
        const childPath = path ? `${path}.${f.name}` : f.name
        if (f.deterministic === false) out.add(childPath)
        else {
          collectProbabilisticPaths(
            fieldToTypeExpr(f),
            models,
            childPath,
            new Set([...seen, expr.modelId]),
            out,
          )
        }
      }
      return
    }
    default:
      return
  }
}

// AI : what a test would ignore for this step — drives the editor hint and the run report.
export function probabilisticPathsForModule(
  m: PipelineModule,
  models: StructureModel[],
): field_path_string[] {
  const out = new Set<field_path_string>()
  collectProbabilisticPaths(stepSpineOutType(m), models, "", new Set(), out)
  return [...out].sort()
}

// AI : structural walk mirroring the path grammar above — array items normalize to "[]",
// AI : so a value path can be matched against the static probabilistic paths and dropped.
function stripPaths(value: unknown, paths: Set<field_path_string>, path: field_path_string): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map((v) => stripPaths(v, paths, `${path}[]`))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${k}` : k
    if (paths.has(childPath)) continue
    out[k] = stripPaths(v, paths, childPath)
  }
  return out
}

type path_value_pair = { path: field_path_string; value: unknown }

// AI : collect every concrete value at probabilistic paths — e.g. "[].feedback" → "[0].feedback", …
function collectPathValues(value: unknown, pattern: field_path_string, currentPath: field_path_string): path_value_pair[] {
  if (!pattern) return [{ path: currentPath || "(root)", value }]
  if (pattern.startsWith("[]")) {
    if (!Array.isArray(value)) return []
    const rest = pattern.slice(2).replace(/^\./, "")
    return value.flatMap((item, i) =>
      collectPathValues(item, rest, currentPath ? `${currentPath}[${i}]` : `[${i}]`),
    )
  }
  const dot = pattern.indexOf(".")
  const key = dot === -1 ? pattern : pattern.slice(0, dot)
  const rest = dot === -1 ? "" : pattern.slice(dot + 1)
  if (value === null || typeof value !== "object" || Array.isArray(value)) return []
  const obj = value as Record<string, unknown>
  if (!(key in obj)) return []
  const childPath = currentPath ? `${currentPath}.${key}` : key
  return collectPathValues(obj[key], rest, childPath)
}

export type ProbabilisticFieldPair = {
  path: field_path_string
  expected: unknown
  actual: unknown
}

export function probabilisticFieldPairs(
  expected: unknown,
  actual: unknown,
  paths: field_path_string[],
): ProbabilisticFieldPair[] {
  const out: ProbabilisticFieldPair[] = []
  for (const pattern of paths) {
    const expVals = collectPathValues(expected, pattern, "")
    const actVals = collectPathValues(actual, pattern, "")
    const actByPath = new Map(actVals.map((v) => [v.path, v.value]))
    for (const { path, value: exp } of expVals) {
      out.push({ path, expected: exp, actual: actByPath.get(path) })
    }
  }
  return out
}

export type ProbabilisticEvalPayload = {
  label: string
  fields: ProbabilisticFieldPair[]
}

export type ProbabilisticEvalResult = {
  label: string
  fieldResults: RunTestProbabilisticResult[]
  pass: boolean
}

// AI : merge LLM probabilistic-field verdicts — deterministic JSON must already pass.
export function mergeProbabilisticEvaluations(
  results: TestStepResult[],
  evaluations: ProbabilisticEvalResult[],
): TestStepResult[] {
  const evalByKey = new Map(evaluations.map((e) => [labelAsStateKey(e.label), e]))
  return results.map((r) => {
    const ev = evalByKey.get(labelAsStateKey(r.label))
    if (!ev || r.status !== RunTestStepStatus.Pass) return r
    const probabilisticPass = ev.fieldResults.every((x) => x.pass)
    return {
      ...r,
      status: probabilisticPass ? RunTestStepStatus.Pass : RunTestStepStatus.Fail,
      probabilisticResults: ev.fieldResults,
      llmEvaluated: true,
    }
  })
}

export function probabilisticEvalPayloads(
  run: PipelineRun,
  test: SpineTestFile,
  deterministicResults: TestStepResult[],
  project: Pick<Project, "modules" | "models">,
): ProbabilisticEvalPayload[] {
  const expectedByKey = new Map(
    Object.entries(test.expectedOutputs).map(([label, v]) => [labelAsStateKey(label), v]),
  )
  const out: ProbabilisticEvalPayload[] = []
  for (const r of deterministicResults) {
    if (r.status !== RunTestStepStatus.Pass || !r.ignoredPaths?.length) continue
    const m = project.modules.find((mod) => labelAsStateKey(mod.label) === labelAsStateKey(r.label))
    if (!m) continue
    const expected = expectedByKey.get(labelAsStateKey(r.label))
    const step = run.steps.find((s) => labelAsStateKey(s.label) === labelAsStateKey(r.label))
    const parsed = step?.outputJson ? tryParseJson(step.outputJson) : null
    const actual = parsed?.ok ? parsed.value : r.actual
    if (expected === undefined || actual === undefined) continue
    const fields = probabilisticFieldPairs(expected, actual, r.ignoredPaths)
    if (fields.length) out.push({ label: r.label, fields })
  }
  return out
}

// AI : the pinpoint view — first failing step in pipeline order is where the pipeline goes wrong.
// AI : Deterministic fields are exact-compared (git diff on fail); probabilistic fields go to LLM after.
export function compareRunToTest(
  run: PipelineRun,
  test: SpineTestFile,
  project: Pick<Project, "modules" | "models">,
): TestStepResult[] {
  const expectedByKey = new Map(
    Object.entries(test.expectedOutputs).map(([label, v]) => [labelAsStateKey(label), v]),
  )
  const results: TestStepResult[] = []
  for (const m of project.modules) {
    const key = labelAsStateKey(m.label)
    if (!expectedByKey.has(key)) continue
    const expected = expectedByKey.get(key)
    const step = run.steps.find((s) => labelAsStateKey(s.label) === key)
    if (!step || step.outputJson === undefined) {
      results.push({ label: m.label, status: RunTestStepStatus.NotReached, expected })
      continue
    }
    const parsed = tryParseJson(step.outputJson)
    const actual = parsed.ok ? parsed.value : step.outputJson
    if (!isComparableStep(m)) {
      results.push({
        label: m.label,
        status: RunTestStepStatus.Skipped,
        skipReason: skipReasonForTestStep(m),
        expected: stripDocIds(expected),
        actual: actual === undefined ? undefined : stripDocIds(actual),
      })
      continue
    }
    const probabilistic = probabilisticPathsForModule(m, project.models)
    const ignoredPaths = probabilistic.length ? probabilistic : undefined
    const pathSet = new Set(probabilistic)
    const expectedCore = stripPaths(expected, pathSet, "")
    const actualCore = stripPaths(actual, pathSet, "")
    if (deepEqual(actualCore, expectedCore)) {
      results.push({ label: m.label, status: RunTestStepStatus.Pass, ignoredPaths, expected, actual })
    } else {
      results.push({
        label: m.label,
        status: RunTestStepStatus.Fail,
        diffPath: deepEqualDiffPath(actualCore, expectedCore),
        deterministicDiff: jsonUnifiedDiff(expectedCore, actualCore),
        ignoredPaths,
        expected,
        actual,
      })
    }
  }
  return results
}

export function firstFailure(results: TestStepResult[]): TestStepResult | undefined {
  return results.find(
    (r) => r.status === RunTestStepStatus.Fail || r.status === RunTestStepStatus.NotReached,
  )
}

// AI : starter file — golden outputs when the project ships them; otherwise just the output
// AI : steps as null placeholders. Tests are partial by design — cover only the steps you care about.
export function testFileSkeleton(project: Project, projectDocs: DocRef[]): string {
  const inputs: Record<step_label_string, doc_name_string> = {}
  for (const m of inputModulesOf(project.modules)) {
    const candidate = projectDocs.find(
      (d) => d.label === DocLabel.Inference && !isTestingFileName(d.name) && !isInferenceSetupFileName(d.name),
    )
    inputs[labelAsStateKey(m.label)] = candidate?.name ?? ""
  }
  const golden = project.expectedOutputs ?? {}
  const expectedOutputs: Record<step_label_string, unknown> = {}
  for (const m of project.modules) {
    if (m.kind === ModuleKind.Input) continue
    const key = labelAsStateKey(m.label)
    if (!key) continue
    if (key in golden) expectedOutputs[key] = golden[key]
  }
  if (!Object.keys(expectedOutputs).length) {
    for (const m of project.modules) {
      if (m.kind !== ModuleKind.Output) continue
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

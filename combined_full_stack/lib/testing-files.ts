// AI : *_testing.json format — per-step expected outputs to pinpoint where a pipeline diverges.
// AI : validated against the live pipeline (labels + spine output types) since pipelines drift.
// AI : TODO (spec) — test verdict expiry (~7d) in Supabase keyed on testContentSig + pipelineSig; revert restores cached pass/fail.
// AI : TODO (spec) — confusion matrices / field group-by mapping in test compare UI (spec § testing).

import { applySchemaDefaults, jsonSchemaToFormRoot } from "@/lib/schema-form"
import { stepOutputJsonSchema } from "@/lib/step-json-schema"
import { collectTestDiffFields, testValuesDiffPath, testValuesEqual, type TestCompareOpts, type TestDiffField } from "@/lib/deep_equal"
import { jsonUnifiedDiff } from "@/lib/json-diff"
import { resolveNamedRunInputs, type ResolvedNamedInputs } from "@/lib/inference-presets"
import { validateNamedInputs, isInferenceSetupFileName } from "@/lib/inference-setup-files"
import { labelAsStateKey, validatePipelineStateEntry } from "@/lib/server/pipeline_state"
import { fieldToTypeExpr, stepSpineOutType } from "@/lib/server/type_expr"
import { tryParseJson } from "@/lib/json-utils"
import { retrievalMissesFromCompare } from "@/lib/retrieval-utils"
import { buildRunConfigPayload, hashStableJson, stableJson } from "@/lib/run-fingerprint"
import { DocLabel, ModuleKind, RunSource, RunTestStepStatus, type RunTestProbabilisticResult } from "@/lib/types"
import type {
  DocRef,
  ModelId,
  ModuleId,
  PipelineModule,
  PipelineRun,
  Project,
  RunTestStepResult,
  RunTestDeterministicDiffResult,
  StructureModel,
  TypeAlias,
  TypeExpr,
  TolerantFieldPath,
} from "@/lib/types"

export const TESTING_FILE_SUFFIX = "_testing.json"

type step_label_string = string
type doc_name_string = string

// AI : deterministic-ness is NOT stored here — it lives on structure fields
// AI : (ModelField.deterministic); probabilistic fields are exact-excluded then LLM-checked.
export type SpineTestFile = {
  description?: string
  // AI : input step label → doc name(s) — every Input module, including the one paired with Combine Inputs
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

// AI : input/combine steps are not scored — run log stores the full value (same shape as expected).
export function isComparableStep(m: PipelineModule): boolean {
  return m.kind !== ModuleKind.Input && m.kind !== ModuleKind.Combine
}

export function skipReasonForTestStep(m: PipelineModule): string | undefined {
  if (m.kind === ModuleKind.Input) return "Input — no computation"
  if (m.kind === ModuleKind.Combine) return "Combine — input checked, output not scored"
  return undefined
}

// AI : input/combine steps pin uploads under inputs — legacy tests may still list them in expectedOutputs.
export function sanitizeTestFile(test: SpineTestFile, project: Project): SpineTestFile {
  const expectedOutputs: Record<step_label_string, unknown> = {}
  for (const [label, value] of Object.entries(test.expectedOutputs)) {
    const mod = moduleByLabel(project.modules, label)
    if (!mod || !isComparableStep(mod)) continue
    expectedOutputs[labelAsStateKey(label)] = value
  }
  const inputs: NonNullable<SpineTestFile["inputs"]> = { ...(test.inputs ?? {}) }
  for (const m of inputModulesOf(project.modules)) {
    const key = labelAsStateKey(m.label)
    if (key in inputs) continue
    inputs[key] = ""
  }
  return { ...test, inputs, expectedOutputs }
}

// AI : does this test still fit the current pipeline? Labels may be stale, values may mismatch types.
export function validateTestFile(
  test: SpineTestFile,
  project: Project,
  projectDocs: DocRef[],
): TestFileIssue[] {
  const issues: TestFileIssue[] = []
  const modules = project.modules
  test = sanitizeTestFile(test, project)

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
    const schema = stepOutputJsonSchema(project, label)
    const root = schema ? jsonSchemaToFormRoot(schema) : null
    const normalized = root ? applySchemaDefaults(value, root) : value
    const check = validatePipelineStateEntry(labelAsStateKey(label), normalized, project)
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

export type TestStepTrackStatus = "input" | "passthrough" | "tracked" | "untracked"

export type OrphanedExpectedStep = {
  label: step_label_string
  remapCandidates: step_label_string[]
}

export type OrphanedInputStep = {
  label: step_label_string
  remapCandidates: step_label_string[]
}

// AI : live pipeline vs test file — which steps are covered, and what no longer exists.
export type TestPipelineAlignment = {
  stepRows: Array<{ module: PipelineModule; trackStatus: TestStepTrackStatus }>
  orphanedExpected: OrphanedExpectedStep[]
  orphanedInputs: OrphanedInputStep[]
}

function trackedExpectedKeys(expectedOutputs: Record<step_label_string, unknown>): Set<string> {
  return new Set(Object.keys(expectedOutputs).map(labelAsStateKey))
}

// AI : typed remap targets — pipeline steps whose output type accepts this expected value.
export function remapCandidatesForExpectedValue(
  expectedValue: unknown,
  expectedOutputs: Record<step_label_string, unknown>,
  project: Project,
): step_label_string[] {
  const tracked = trackedExpectedKeys(expectedOutputs)
  const candidates: step_label_string[] = []
  for (const m of project.modules) {
    if (!isComparableStep(m)) continue
    const key = labelAsStateKey(m.label)
    if (tracked.has(key)) continue
    if (expectedValue === null) {
      candidates.push(key)
      continue
    }
    const check = validatePipelineStateEntry(key, expectedValue, project)
    if (check.ok) candidates.push(key)
  }
  return candidates
}

function remapCandidatesForOrphanInput(
  orphanLabel: step_label_string,
  inputs: SpineTestFile["inputs"],
  project: Project,
): step_label_string[] {
  const used = new Set(Object.keys(inputs ?? {}).map(labelAsStateKey))
  used.delete(labelAsStateKey(orphanLabel))
  return inputModulesOf(project.modules)
    .map((m) => labelAsStateKey(m.label))
    .filter((key) => !used.has(key))
}

export function analyzeTestPipelineAlignment(
  test: Pick<SpineTestFile, "inputs" | "expectedOutputs">,
  project: Project,
): TestPipelineAlignment {
  const sanitized = sanitizeTestFile(
    { expectedOutputs: test.expectedOutputs, inputs: test.inputs },
    project,
  )
  const tracked = trackedExpectedKeys(sanitized.expectedOutputs)
  const stepRows = project.modules.map((module) => {
    const key = labelAsStateKey(module.label)
    let trackStatus: TestStepTrackStatus
    if (module.kind === ModuleKind.Input) trackStatus = "input"
    else if (!isComparableStep(module)) trackStatus = "passthrough"
    else if (tracked.has(key)) trackStatus = "tracked"
    else trackStatus = "untracked"
    return { module, trackStatus }
  })

  const orphanedExpected: OrphanedExpectedStep[] = []
  for (const [label, value] of Object.entries(test.expectedOutputs)) {
    const mod = moduleByLabel(project.modules, label)
    if (mod) continue
    orphanedExpected.push({
      label: labelAsStateKey(label),
      remapCandidates: remapCandidatesForExpectedValue(value, sanitized.expectedOutputs, project),
    })
  }

  const orphanedInputs: OrphanedInputStep[] = Object.keys(sanitized.inputs ?? {})
    .filter((label) => !inputModulesOf(project.modules).some((m) => labelAsStateKey(m.label) === labelAsStateKey(label)))
    .map((label) => ({
      label: labelAsStateKey(label),
      remapCandidates: remapCandidatesForOrphanInput(label, test.inputs, project),
    }))

  return { stepRows, orphanedExpected, orphanedInputs }
}

export function buildTestCoverageMap(alignment: TestPipelineAlignment): Map<ModuleId, TestStepTrackStatus> {
  const out = new Map<ModuleId, TestStepTrackStatus>()
  for (const { module, trackStatus } of alignment.stepRows) out.set(module.id, trackStatus)
  return out
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

// AI : per-step input guard — same rule as run engine (lib/server/input_description_check.ts).
function stepChecksInputDescription(m: Pick<PipelineModule, "inputDescription" | "checkInputDescription">): boolean {
  if (!m.inputDescription?.trim()) return false
  return m.checkInputDescription !== false
}

function orderTestResultsByPipeline(results: TestStepResult[], modules: PipelineModule[]): TestStepResult[] {
  const byKey = new Map(results.map((r) => [labelAsStateKey(r.label), r]))
  const ordered: TestStepResult[] = []
  const seen = new Set<string>()
  for (const m of modules) {
    const key = labelAsStateKey(m.label)
    const row = byKey.get(key)
    if (!row) continue
    ordered.push(row)
    seen.add(key)
  }
  for (const r of results) {
    const key = labelAsStateKey(r.label)
    if (!seen.has(key)) ordered.push(r)
  }
  return ordered
}

// AI : fold run-time inputDescription checks into the test report — combine steps are scored here, not via expectedOutputs.
export function mergeInputDescriptionChecks(
  run: PipelineRun,
  results: TestStepResult[],
  project: Pick<Project, "modules">,
): TestStepResult[] {
  const byKey = new Map(results.map((r) => [labelAsStateKey(r.label), { ...r }]))
  for (const m of project.modules) {
    if (!stepChecksInputDescription(m)) continue
    const key = labelAsStateKey(m.label)
    const step = run.steps.find((s) => labelAsStateKey(s.label) === key)
    const check = step?.inputDescriptionCheck
    if (!check) continue
    const existing = byKey.get(key)
    if (check.matches === false) {
      byKey.set(key, {
        label: m.label,
        status: RunTestStepStatus.Fail,
        inputDescriptionCheck: check,
        skipReason: existing?.skipReason ?? skipReasonForTestStep(m),
        expected: existing?.expected,
        actual: existing?.actual,
        diffPath: existing?.diffPath,
        deterministicDiff: existing?.deterministicDiff,
        deterministicDiffExplanations: existing?.deterministicDiffExplanations,
        ignoredPaths: existing?.ignoredPaths,
        tolerantPaths: existing?.tolerantPaths,
        probabilisticResults: existing?.probabilisticResults,
        llmEvaluated: existing?.llmEvaluated,
      })
      continue
    }
    if (existing) {
      byKey.set(key, { ...existing, inputDescriptionCheck: check })
      continue
    }
    byKey.set(key, {
      label: m.label,
      status: RunTestStepStatus.Skipped,
      skipReason: skipReasonForTestStep(m) ?? "input checked — not scored",
      inputDescriptionCheck: check,
    })
  }
  return orderTestResultsByPipeline([...byKey.values()], project.modules)
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
// AI : deterministic:false (probabilistic — LLM prose that varies per run), e.g. "[].mistake_explanation".
function isNumericField(f: Pick<StructureModel["fields"][number], "type" | "ref" | "typeExpr" | "deterministic">): boolean {
  if (f.deterministic === false) return false
  const expr = fieldToTypeExpr(f)
  return expr.kind === "prim" && (expr.name === "int" || expr.name === "float")
}

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

// AI : int/float fields with testTolerance — compared with ± in tests, not LLM-checked.
function collectTolerantPaths(
  expr: TypeExpr | undefined,
  models: StructureModel[],
  path: field_path_string,
  seen: Set<string>,
  out: Map<field_path_string, number>,
): void {
  if (!expr) return
  switch (expr.kind) {
    case "optional":
      return collectTolerantPaths(expr.inner, models, path, seen, out)
    case "list":
    case "set":
      return collectTolerantPaths(expr.item, models, `${path}[]`, seen, out)
    case "ref": {
      if (seen.has(expr.modelId)) return
      const model = models.find((m) => m.id === expr.modelId)
      if (!model) return
      for (const f of model.fields) {
        const childPath = path ? `${path}.${f.name}` : f.name
        if (f.deterministic === false) continue
        if (
          isNumericField(f) &&
          f.testTolerance !== undefined &&
          Number.isFinite(f.testTolerance) &&
          f.testTolerance >= 0
        ) {
          out.set(childPath, f.testTolerance)
          continue
        }
        collectTolerantPaths(
          fieldToTypeExpr(f),
          models,
          childPath,
          new Set([...seen, expr.modelId]),
          out,
        )
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

export function tolerantPathsForModule(
  m: PipelineModule,
  models: StructureModel[],
): TolerantFieldPath[] {
  const out = new Map<field_path_string, number>()
  collectTolerantPaths(stepSpineOutType(m), models, "", new Set(), out)
  return [...out.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, tolerance]) => ({ path, tolerance }))
}

export function toleranceForFieldPath(
  path: field_path_string,
  tolerantPaths: TolerantFieldPath[],
): number | undefined {
  const norm = normalizeFieldPath(path)
  return tolerantPaths.find((t) => normalizeFieldPath(t.path) === norm)?.tolerance
}

export function isTolerantFieldPath(path: field_path_string, tolerantPaths: TolerantFieldPath[]): boolean {
  return toleranceForFieldPath(path, tolerantPaths) !== undefined
}

// AI : concrete run paths use [0] indices — patterns use [] (same grammar as stripPaths).
export function normalizeFieldPath(path: field_path_string): field_path_string {
  return path.replace(/\[\d+\]/g, "[]")
}

export function isProbabilisticFieldPath(
  path: field_path_string,
  probabilisticPaths: field_path_string[],
): boolean {
  if (!path) return false
  const norm = normalizeFieldPath(path)
  return probabilisticPaths.some((p) => normalizeFieldPath(p) === norm)
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

// AI : null/undefined/"" expected refs mean "do not LLM-check this path on this row".
export function isProbabilisticReferenceValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ""
}

export function probabilisticReferencePaths(
  expected: unknown,
  paths: field_path_string[],
): field_path_string[] {
  const out: field_path_string[] = []
  for (const pattern of paths) {
    for (const { path, value } of collectPathValues(expected, pattern, "")) {
      if (isProbabilisticReferenceValue(value)) out.push(path)
    }
  }
  return out
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
      if (!isProbabilisticReferenceValue(exp)) continue
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

export type DeterministicDiffEvalPayload = {
  label: string
  fields: TestDiffField[]
  tolerantPaths?: TolerantFieldPath[]
}

export type DeterministicDiffEvalResult = {
  label: string
  fieldResults: RunTestDeterministicDiffResult[]
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

const MAX_DETERMINISTIC_DIFF_FIELDS = 50

function deterministicCoreCompareOpts(r: TestStepResult): TestCompareOpts | undefined {
  if (!r.tolerantPaths?.length) return undefined
  return { tolerantByPattern: new Map(r.tolerantPaths.map((t) => [t.path, t.tolerance])) }
}

function deterministicDiffFieldsForResult(r: TestStepResult): TestDiffField[] {
  if (r.expected === undefined || r.actual === undefined) return []
  const pathSet = new Set(r.ignoredPaths ?? [])
  const expectedCore = stripPaths(r.expected, pathSet, "")
  const actualCore = stripPaths(r.actual, pathSet, "")
  return collectTestDiffFields(expectedCore, actualCore, deterministicCoreCompareOpts(r)).slice(
    0,
    MAX_DETERMINISTIC_DIFF_FIELDS,
  )
}

export function deterministicDiffEvalPayloads(results: TestStepResult[]): DeterministicDiffEvalPayload[] {
  const out: DeterministicDiffEvalPayload[] = []
  for (const r of results) {
    if (r.status !== RunTestStepStatus.Fail || !r.deterministicDiff) continue
    const fields = deterministicDiffFieldsForResult(r)
    if (!fields.length) continue
    out.push({ label: r.label, fields, tolerantPaths: r.tolerantPaths })
  }
  return out
}

export function mergeDeterministicDiffExplanations(
  results: TestStepResult[],
  evaluations: DeterministicDiffEvalResult[],
): TestStepResult[] {
  const evalByKey = new Map(evaluations.map((e) => [labelAsStateKey(e.label), e]))
  return results.map((r) => {
    const ev = evalByKey.get(labelAsStateKey(r.label))
    if (!ev?.fieldResults.length) return r
    return { ...r, deterministicDiffExplanations: ev.fieldResults }
  })
}

export function diffExplanationMap(
  explanations: RunTestDeterministicDiffResult[] | undefined,
): ReadonlyMap<field_path_string, string> {
  const out = new Map<field_path_string, string>()
  for (const row of explanations ?? []) {
    if (row.path && row.reason) out.set(row.path, row.reason)
  }
  return out
}

export function deterministicCompareCores(
  expected: unknown,
  actual: unknown,
  ignoredPaths?: field_path_string[],
): { expectedCore: unknown; actualCore: unknown } {
  const pathSet = new Set(ignoredPaths ?? [])
  return {
    expectedCore: stripPaths(expected, pathSet, ""),
    actualCore: stripPaths(actual, pathSet, ""),
  }
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
    const tolerant = tolerantPathsForModule(m, project.models)
    const tolerantPaths = tolerant.length ? tolerant : undefined
    const pathSet = new Set(probabilistic)
    const expectedCore = stripPaths(expected, pathSet, "")
    const actualCore = stripPaths(actual, pathSet, "")
    const compareOpts: TestCompareOpts = {
      tolerantByPattern: tolerant.length ? new Map(tolerant.map((t) => [t.path, t.tolerance])) : undefined,
    }
    if (testValuesEqual(actualCore, expectedCore, compareOpts)) {
      const base = { label: m.label, status: RunTestStepStatus.Pass, ignoredPaths, tolerantPaths, expected, actual }
      if (m.kind === ModuleKind.Retrieval) {
        const misses = retrievalMissesFromCompare(expected, actual)
        results.push(misses.length ? { ...base, retrievalMissExplanations: misses } : base)
      } else {
        results.push(base)
      }
    } else {
      const row = {
        label: m.label,
        status: RunTestStepStatus.Fail,
        diffPath: testValuesDiffPath(actualCore, expectedCore, compareOpts),
        deterministicDiff: jsonUnifiedDiff(expectedCore, actualCore),
        ignoredPaths,
        tolerantPaths,
        expected,
        actual,
      }
      if (m.kind === ModuleKind.Retrieval) {
        const misses = retrievalMissesFromCompare(expected, actual)
        results.push(misses.length ? { ...row, retrievalMissExplanations: misses } : row)
      } else {
        results.push(row)
      }
    }
  }
  return results
}

export function firstFailure(results: TestStepResult[]): TestStepResult | undefined {
  return results.find(
    (r) =>
      r.status === RunTestStepStatus.Fail ||
      r.status === RunTestStepStatus.NotReached ||
      r.inputDescriptionCheck?.matches === false,
  )
}

export function testVerdictPassed(results: TestStepResult[]): boolean {
  return firstFailure(results) === undefined
}

function testContentPayload(content: string): unknown {
  const parsed = parseTestFile(content)
  if (parsed.ok) return parsed.test
  return { raw: content }
}

function pipelinePayload(
  project: Project,
  model: ModelId | undefined,
  pipeline?: { modules: PipelineModule[]; models: StructureModel[]; typeAliases: TypeAlias[] },
): ReturnType<typeof buildRunConfigPayload> {
  const p = pipeline
    ? { ...project, modules: pipeline.modules, models: pipeline.models, typeAliases: pipeline.typeAliases }
    : project
  return buildRunConfigPayload(p, model)
}

function runContextPayload(
  content: string,
  project: Project,
  model: ModelId | undefined,
  pipeline?: { modules: PipelineModule[]; models: StructureModel[]; typeAliases: TypeAlias[] },
): { pipeline: ReturnType<typeof buildRunConfigPayload>; content: string } {
  return { pipeline: pipelinePayload(project, model, pipeline), content }
}

export function testContentSig(content: string): string {
  return hashStableJson(testContentPayload(content))
}

export function testContentStableSig(content: string): string {
  return stableJson(testContentPayload(content))
}

export function testPipelineSig(
  project: Project,
  model: ModelId | undefined,
  pipeline?: { modules: PipelineModule[]; models: StructureModel[]; typeAliases: TypeAlias[] },
): string {
  return hashStableJson(pipelinePayload(project, model, pipeline))
}

export function testPipelineStableSig(
  project: Project,
  model: ModelId | undefined,
  pipeline?: { modules: PipelineModule[]; models: StructureModel[]; typeAliases: TypeAlias[] },
): string {
  return stableJson(pipelinePayload(project, model, pipeline))
}

// AI : legacy combined sig — older runs only; new runs store testContentSig + pipelineSig separately.
export function testRunContextSig(
  content: string,
  project: Project,
  model: ModelId | undefined,
  pipeline?: { modules: PipelineModule[]; models: StructureModel[]; typeAliases: TypeAlias[] },
): string {
  return hashStableJson(runContextPayload(content, project, model, pipeline))
}

export function testRunContextStableSig(
  content: string,
  project: Project,
  model: ModelId | undefined,
  pipeline?: { modules: PipelineModule[]; models: StructureModel[]; typeAliases: TypeAlias[] },
): string {
  return stableJson(runContextPayload(content, project, model, pipeline))
}

export type TestSigLegacy = {
  contentStable?: string
  pipelineStable?: string
  combinedStable?: string
}

function sigMatches(stored: string | undefined, hash: string, stable?: string): boolean {
  if (!stored) return false
  if (stored === hash) return true
  // AI : legacy runs persisted full stableJson before hash sigs were introduced.
  return !!stable && stored === stable
}

export function testReportMatchesSigs(
  report: { testContentSig?: string; pipelineSig?: string; contextSig?: string },
  testContentSig: string,
  pipelineSig: string,
  legacy?: TestSigLegacy,
): boolean {
  if (report.testContentSig !== undefined && report.pipelineSig !== undefined) {
    return (
      sigMatches(report.testContentSig, testContentSig, legacy?.contentStable) &&
      sigMatches(report.pipelineSig, pipelineSig, legacy?.pipelineStable)
    )
  }
  if (report.contextSig && legacy?.combinedStable) {
    return report.contextSig === legacy.combinedStable
  }
  return false
}

export function latestTestVerdictForDoc(
  runs: PipelineRun[],
  testDocName: string,
  testContentSig: string,
  pipelineSig: string,
  legacy?: TestSigLegacy,
): boolean | null {
  let latest: PipelineRun | undefined
  for (const r of runs) {
    if (r.source !== RunSource.Testing || r.test?.testDocName !== testDocName) continue
    if (!testReportMatchesSigs(r.test, testContentSig, pipelineSig, legacy)) continue
    if (!latest || r.startedAt > latest.startedAt) latest = r
  }
  if (!latest?.test) return null
  return testVerdictPassed(latest.test.results)
}

// AI : all persisted runs for a test file — unlike lastVerdict, no sig filter (spec § run history).
export function testRunHistoryForDoc(runs: PipelineRun[], testDocName: string): PipelineRun[] {
  return runs
    .filter((r) => r.source === RunSource.Testing && r.test?.testDocName === testDocName)
    .sort((a, b) => b.startedAt - a.startedAt)
}

// AI : sidebar pass/fail — most recent run for this file, even when test/pipeline changed since.
export function lastTestRunVerdictForDoc(runs: PipelineRun[], testDocName: string): boolean | null {
  const latest = testRunHistoryForDoc(runs, testDocName)[0]
  if (!latest?.test) return null
  return testVerdictPassed(latest.test.results)
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
    if (m.kind === ModuleKind.Input || m.kind === ModuleKind.Combine) continue
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

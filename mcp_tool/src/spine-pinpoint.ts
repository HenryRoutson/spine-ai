// AI : MCP-facing wrappers — same pinpoint logic as the Testing tab / isolated error UI.

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { loadProjectContext, readTextFile } from "@/lib/cli/project_context"
import { validateTestContent } from "@/lib/cli/validate_test"
import { tryParseJson } from "@/lib/json-utils"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import {
  collectTestFailureSteps,
  formatTestFailuresForClipboard,
  formatTestFailuresJsonObject,
} from "@/lib/test-error-copy"
import { testOutcomePassed } from "@/lib/test-expect-failure"
import {
  compareRunToTest,
  firstFailure,
  parseTestFile,
  testVerdictPassed,
  type SpineTestFile,
  type TestStepResult,
} from "@/lib/testing-files"
import { RunStatus, type PipelineRun, type Project, type RunId } from "@/lib/types"
import { schemaValidationForStepOutput } from "./spine-step-models.js"

export type repo_path_string = string

export type PinpointFailureInput = {
  projectSeedPath: repo_path_string
  testFilePath: repo_path_string
  runPath?: repo_path_string
  runJson?: string
}

export type PinpointFailureResult = {
  passed: boolean
  testFile: string
  projectName: string
  expectFailure?: SpineTestFile["expectFailure"]
  firstFailure?: {
    step: string
    status: string
    diffPath?: string
    schemaValidation?: { ok: boolean; error?: string; validation: "pipeline_state" | "structure_model" }
    isolated: ReturnType<typeof formatTestFailuresJsonObject>
    isolatedText: string
  }
  stepSummary: Array<{
    step: string
    status: string
    diffPath?: string
  }>
  note: string
}

function absPath(path: string, cwd: string): string {
  return resolve(cwd, path)
}

function readRunFromInput(input: Pick<PinpointFailureInput, "runPath" | "runJson">, cwd: string): PipelineRun {
  const raw =
    input.runJson ??
    (input.runPath ? readTextFile(absPath(input.runPath, cwd)) : undefined)
  if (!raw?.trim()) {
    throw new Error("provide runPath or runJson — a finished pipeline run to compare")
  }
  const parsed = tryParseJson(raw, { trim: true })
  if (!parsed.ok) throw new Error(`invalid run JSON: ${parsed.error.message}`)
  return normalizeRun(parsed.value)
}

function normalizeRun(value: unknown): PipelineRun {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("run JSON must be an object")
  }
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.steps)) {
    throw new Error('run JSON must include a "steps" array')
  }
  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id : "mcp-run"
  const status =
    obj.status === RunStatus.Error || obj.status === RunStatus.Running || obj.status === RunStatus.Ok
      ? obj.status
      : RunStatus.Ok
  return {
    id: id as RunId,
    startedAt: typeof obj.startedAt === "number" ? obj.startedAt : Date.now(),
    status,
    totalMs: typeof obj.totalMs === "number" ? obj.totalMs : 0,
    billedCents: typeof obj.billedCents === "number" ? obj.billedCents : 0,
    savedCents: typeof obj.savedCents === "number" ? obj.savedCents : 0,
    model: typeof obj.model === "string" ? obj.model : "mcp",
    steps: obj.steps as PipelineRun["steps"],
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
  }
}

function compactStep(r: TestStepResult) {
  return {
    step: r.label,
    status: r.status,
    diffPath: r.diffPath,
  }
}

function firstFailureRecord(
  results: TestStepResult[],
  run: PipelineRun,
  testFile: string,
  project: Project,
): PinpointFailureResult["firstFailure"] | undefined {
  const fail = firstFailure(results)
  if (!fail) return undefined
  const isolated = formatTestFailuresJsonObject([fail], {
    testDocName: testFile,
    run,
    includePipelineInput: false,
  })
  const isolatedText = formatTestFailuresForClipboard([fail], {
    testDocName: testFile,
    run,
    includePipelineInput: false,
  })
  const runStep = run.steps.find((s) => labelAsStateKey(s.label) === labelAsStateKey(fail.label))
  const actualParsed = runStep?.outputJson ? tryParseJson(runStep.outputJson) : null
  const actual = actualParsed?.ok ? actualParsed.value : runStep?.outputJson
  const schemaValidation = schemaValidationForStepOutput(project, fail.label, actual)
  return {
    step: fail.label,
    status: fail.status,
    diffPath: fail.diffPath,
    schemaValidation,
    isolated,
    isolatedText,
  }
}

// AI : deterministic compare only — probabilistic / LLM field checks come later with benchmarks.
export function pinpointFailure(input: PinpointFailureInput, cwd: string): PinpointFailureResult {
  const seedPath = absPath(input.projectSeedPath, cwd)
  const testPath = absPath(input.testFilePath, cwd)
  const ctx = loadProjectContext(seedPath)
  const testContent = readTextFile(testPath)
  const parsed = parseTestFile(testContent)
  if (!parsed.ok) throw new Error(parsed.error)

  const run = readRunFromInput(input, cwd)
  const results = compareRunToTest(run, parsed.test, ctx.project)
  const deterministicPassed = testVerdictPassed(results)
  const passed = testOutcomePassed(
    parsed.test,
    results,
    run,
    false,
    deterministicPassed,
  )

  const fail = firstFailureRecord(results, run, testPath, ctx.project)
  return {
    passed,
    testFile: testPath,
    projectName: ctx.project.name,
    expectFailure: parsed.test.expectFailure,
    firstFailure: fail,
    stepSummary: results.map(compactStep),
    note: "Deterministic field compare only — probabilistic (LLM-checked) fields and cache are ignored for now.",
  }
}

export function compareRunToTestReport(input: PinpointFailureInput, cwd: string) {
  const seedPath = absPath(input.projectSeedPath, cwd)
  const testPath = absPath(input.testFilePath, cwd)
  const ctx = loadProjectContext(seedPath)
  const testContent = readTextFile(testPath)
  const parsed = parseTestFile(testContent)
  if (!parsed.ok) throw new Error(parsed.error)

  const run = readRunFromInput(input, cwd)
  const results = compareRunToTest(run, parsed.test, ctx.project)
  const failureSteps = collectTestFailureSteps(results, { run, includePipelineInput: false })

  return {
    passed: testOutcomePassed(parsed.test, results, run, false, testVerdictPassed(results)),
    testFile: testPath,
    projectName: ctx.project.name,
    results,
    failureSteps,
    note: "Deterministic compare only — no LLM semantic checks.",
  }
}

export function validateTestFile(input: { projectSeedPath: repo_path_string; testFilePath: repo_path_string }, cwd: string) {
  const seedPath = absPath(input.projectSeedPath, cwd)
  const testPath = absPath(input.testFilePath, cwd)
  const ctx = loadProjectContext(seedPath)
  return validateTestContent(ctx, readTextFile(testPath), testPath)
}

export function parseTestFileCommand(testFilePath: repo_path_string, cwd: string) {
  const testPath = absPath(testFilePath, cwd)
  const content = readFileSync(testPath, "utf8")
  const parsed = parseTestFile(content)
  if (!parsed.ok) throw new Error(parsed.error)
  return { testFile: testPath, test: parsed.test }
}

export function listProjectTests(projectSeedPath: repo_path_string, cwd: string) {
  const ctx = loadProjectContext(absPath(projectSeedPath, cwd))
  return ctx.seed.docSpecs
    .filter((d) => d.name.endsWith("_testing.json"))
    .map((d) => ({ name: d.name, path: d.path }))
}

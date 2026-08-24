#!/usr/bin/env tsx
// AI : CLI bridge for scripts/benchmark_mcp_deepseek.py — list/prepare/score spine *_testing.json benchmarks.

import "../src/bootstrap-env.js"

import { readdirSync } from "node:fs"
import { basename, join, relative, resolve } from "node:path"
import { compileCustomFn } from "@/lib/custom_code"
import { loadProjectContext, readTextFile, type ProjectContext } from "@/lib/cli/project_context"
import { loadTestInputContents } from "@/lib/test-expect-failure"
import { isLlmKind } from "@/lib/module-kinds"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { materializeInputDocument } from "@/lib/server/structure"
import { deriveStepPrompt, validateStepOutputValue } from "../src/spine-step-models.js"
import {
  compareRunToTestReport,
  parseTestFileCommand,
  type PinpointFailureInput,
} from "../src/spine-pinpoint.js"
import { isTestingFileName, parseTestFile, type SpineTestFile } from "@/lib/testing-files"
import { ModuleKind, RunStatus, RunStepStatus, RunTestStepStatus, type PipelineModule, type PipelineRun, type RunStep } from "@/lib/server/types"

type repo_path_string = string

const REPO_ROOT = process.env.SPINE_REPO_ROOT ?? resolve(import.meta.dirname, "../..")
const SEEDS_DIR = join(REPO_ROOT, "combined_full_stack/seeds")

export type BenchmarkRef = {
  seedPath: repo_path_string
  testPath: repo_path_string
  projectName: string
  testName: string
  pinnedStepCount: number
  llmStepCount: number
  runnable: boolean
  skipReason?: string
}

export type PreparedLlmStep = {
  label: string
  kind: string
  moduleId: string
  input: unknown
}

export type PrepareBenchmarkResult = {
  seedPath: string
  testPath: string
  projectName: string
  llmSteps: PreparedLlmStep[]
  deterministicSteps: Array<{ label: string; kind: string; output: unknown }>
  skippedSteps: Array<{ label: string; reason: string }>
}

function abs(path: string): string {
  return resolve(REPO_ROOT, path)
}

function rel(path: string): string {
  return relative(REPO_ROOT, abs(path)).replace(/\\/g, "/")
}

function readSeedTestDocs(ctx: ProjectContext, testPath: string): Record<string, string> {
  const testContent = readTextFile(testPath)
  const parsed = parseTestFile(testContent)
  if (!parsed.ok) throw new Error(parsed.error)
  return loadTestInputContents(parsed.test, ctx.project.modules, ctx.docRefs, (name) => {
    const spec = ctx.seed.docSpecs.find((d) => d.name === name)
    if (!spec) return undefined
    try {
      return readTextFile(spec.path)
    } catch {
      return undefined
    }
  })
}

function pinnedExpected(test: SpineTestFile): Map<string, unknown> {
  const out = new Map<string, unknown>()
  for (const [label, value] of Object.entries(test.expectedOutputs ?? {})) {
    if (value !== null && value !== undefined) out.set(labelAsStateKey(label), value)
  }
  return out
}

function hasRunnableExpected(test: SpineTestFile): boolean {
  if (test.expectFailure) return false
  return Object.values(test.expectedOutputs ?? {}).some((v) => v !== null && v !== undefined)
}

function runCustomCode(m: PipelineModule, input: unknown, state: Record<string, unknown>): unknown {
  const code = m.fallbackList?.[0]?.typescript ?? m.code
  if (!code?.trim()) throw new Error(`custom-code step "${m.label}" has no code`)
  const fn = compileCustomFn(code)
  return fn.length >= 2 ? fn(input, state) : fn(input)
}

function materializeInputStep(
  m: PipelineModule,
  ctx: ProjectContext,
  contentByDocId: Record<string, string>,
  test: SpineTestFile,
): unknown {
  const resolved = test.inputs?.[m.label]
  if (!resolved) throw new Error(`test inputs missing step "${m.label}"`)
  const names = Array.isArray(resolved) ? resolved : [resolved]
  const name = names[0]
  if (!name) throw new Error(`empty input assignment for "${m.label}"`)
  const spec = ctx.seed.docSpecs.find((d) => d.name === name)
  if (!spec) throw new Error(`unknown doc "${name}" for "${m.label}"`)
  const raw = readTextFile(spec.path)
  return materializeInputDocument(raw, spec.name, m, ctx.project.models, {
    docName: name,
    label: m.label,
    note: m.note,
  })
}

function upstreamInput(m: PipelineModule, modules: PipelineModule[], state: Record<string, unknown>): unknown {
  const idx = modules.findIndex((x) => x.id === m.id)
  if (idx <= 0) throw new Error(`step "${m.label}" has no upstream`)
  const prev = modules[idx - 1]
  if (!prev) throw new Error(`step "${m.label}" has no previous module`)
  const key = labelAsStateKey(prev.label)
  if (!(key in state) && state[prev.label] !== undefined) return state[prev.label]
  return state[key] ?? state[prev.label]
}

export function listBenchmarks(): BenchmarkRef[] {
  const seeds = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"))
  const out: BenchmarkRef[] = []
  for (const seedFile of seeds) {
    const seedPath = join("combined_full_stack/seeds", seedFile)
    const ctx = loadProjectContext(abs(seedPath))
    for (const doc of ctx.seed.docSpecs.filter((d) => isTestingFileName(d.name))) {
      const testContent = readTextFile(doc.path)
      const parsed = parseTestFile(testContent)
      if (!parsed.ok) continue
      const pinned = pinnedExpected(parsed.test)
      const llmSteps = ctx.project.modules.filter((m) => isLlmKind(m.kind))
      const runnable = hasRunnableExpected(parsed.test)
      out.push({
        seedPath,
        testPath: rel(doc.path),
        projectName: ctx.project.name,
        testName: doc.name,
        pinnedStepCount: pinned.size,
        llmStepCount: llmSteps.length,
        runnable,
        skipReason: runnable
          ? undefined
          : parsed.test.expectFailure
            ? "negative test (expectFailure)"
            : "no golden expectedOutputs filled",
      })
    }
  }
  return out.sort((a, b) => a.projectName.localeCompare(b.projectName))
}

export function prepareBenchmark(seedPath: repo_path_string, testPath: repo_path_string): PrepareBenchmarkResult {
  const ctx = loadProjectContext(abs(seedPath))
  const testAbs = abs(testPath)
  const testContent = readTextFile(testAbs)
  const parsed = parseTestFile(testContent)
  if (!parsed.ok) throw new Error(parsed.error)
  if (!hasRunnableExpected(parsed.test)) {
    throw new Error("benchmark has no filled expectedOutputs or is a negative test")
  }

  const golden = pinnedExpected(parsed.test)
  const contentByDocId = readSeedTestDocs(ctx, testAbs)
  const state: Record<string, unknown> = {}
  const llmSteps: PreparedLlmStep[] = []
  const deterministicSteps: PrepareBenchmarkResult["deterministicSteps"] = []
  const skippedSteps: PrepareBenchmarkResult["skippedSteps"] = []

  for (const m of ctx.project.modules) {
    const key = labelAsStateKey(m.label)
    if (isLlmKind(m.kind)) {
      llmSteps.push({
        label: m.label,
        kind: m.kind,
        moduleId: m.id,
        input: upstreamInput(m, ctx.project.modules, state),
      })
      continue
    }

    if (golden.has(key)) {
      const output = golden.get(key)
      state[key] = output
      state[m.label] = output
      deterministicSteps.push({ label: m.label, kind: m.kind, output })
      continue
    }

    try {
      let output: unknown
      if (m.kind === ModuleKind.Input) {
        output = materializeInputStep(m, ctx, contentByDocId, parsed.test)
      } else if (m.kind === ModuleKind.CustomCode) {
        output = runCustomCode(m, upstreamInput(m, ctx.project.modules, state), state)
      } else if (m.kind === ModuleKind.Output || m.kind === ModuleKind.HumanReview || m.kind === ModuleKind.Assert) {
        skippedSteps.push({ label: m.label, reason: "terminal / non-data step" })
        continue
      } else {
        skippedSteps.push({ label: m.label, reason: `unsupported deterministic kind "${m.kind}" without golden pin` })
        continue
      }
      state[key] = output
      state[m.label] = output
      deterministicSteps.push({ label: m.label, kind: m.kind, output })
    } catch (err) {
      skippedSteps.push({ label: m.label, reason: (err as Error).message })
    }
  }

  return {
    seedPath: rel(seedPath),
    testPath: rel(testPath),
    projectName: ctx.project.name,
    llmSteps,
    deterministicSteps,
    skippedSteps,
  }
}

export function buildRunFromSteps(
  projectName: string,
  deterministicSteps: PrepareBenchmarkResult["deterministicSteps"],
  llmOutputs: Array<{ label: string; output: unknown }>,
): PipelineRun {
  const steps: RunStep[] = []
  const byLabel = new Map<string, unknown>()
  for (const s of deterministicSteps) byLabel.set(s.label, s.output)
  for (const s of llmOutputs) byLabel.set(s.label, s.output)
  for (const [label, output] of byLabel) {
    steps.push({
      moduleId: `bench_${label}` as RunStep["moduleId"],
      label,
      kind: ModuleKind.Llm,
      status: RunStepStatus.Ok,
      ms: 0,
      costCents: 0,
      inputPreview: "",
      outputPreview: "",
      outputJson: JSON.stringify(output, null, 2),
    })
  }
  return {
    id: `bench_${Date.now()}` as PipelineRun["id"],
    startedAt: Date.now(),
    status: RunStatus.Ok,
    totalMs: 0,
    billedCents: 0,
    savedCents: 0,
    model: "deepseek/deepseek-chat",
    steps,
    notes: `benchmark run — ${projectName}`,
  }
}

export function scoreBenchmark(
  seedPath: repo_path_string,
  testPath: repo_path_string,
  run: PipelineRun,
) {
  const relSeed = seedPath.startsWith(REPO_ROOT) ? seedPath : abs(seedPath)
  const relTest = testPath.startsWith(REPO_ROOT) ? testPath : abs(testPath)
  const input: PinpointFailureInput = {
    projectSeedPath: relSeed,
    testFilePath: relTest,
    runJson: JSON.stringify(run),
  }
  const report = compareRunToTestReport(input, REPO_ROOT)
  const comparable = report.results.filter((r) => r.status !== RunTestStepStatus.Skipped)
  const passed = comparable.filter((r) => r.status === RunTestStepStatus.Pass).length
  const failed = comparable.filter((r) => r.status === RunTestStepStatus.Fail || r.status === RunTestStepStatus.NotReached).length
  return {
    passed: report.passed,
    projectName: report.projectName,
    stepResults: report.results.map((r) => ({
      step: r.label,
      status: r.status,
      diffPath: r.diffPath,
    })),
    summary: { passed, failed, total: comparable.length },
    firstFailure: report.failureSteps[0] ?? null,
  }
}

function cmdList() {
  console.log(JSON.stringify({ benchmarks: listBenchmarks() }, null, 2))
}

function cmdPrepare(seedPath: string, testPath: string) {
  const relSeed = seedPath.includes("seeds/") ? seedPath : join("combined_full_stack/seeds", basename(seedPath))
  const relTest = testPath.includes("documents/") ? testPath : testPath
  console.log(JSON.stringify(prepareBenchmark(relSeed, relTest), null, 2))
}

function cmdScore(seedPath: string, testPath: string, runJson: string) {
  const run = JSON.parse(runJson) as PipelineRun
  const relSeed = seedPath.includes("seeds/") ? seedPath : join("combined_full_stack/seeds", basename(seedPath))
  console.log(JSON.stringify(scoreBenchmark(relSeed, testPath, run), null, 2))
}

function cmdParseTest(testPath: string) {
  console.log(JSON.stringify(parseTestFileCommand(testPath, REPO_ROOT), null, 2))
}

function cmdTool(name: string, argsJson: string) {
  const args = JSON.parse(argsJson) as Record<string, unknown>
  switch (name) {
    case "derive_step_prompt":
      console.log(JSON.stringify(deriveStepPrompt(args as Parameters<typeof deriveStepPrompt>[0], REPO_ROOT)))
      break
    case "validate_step_output":
      console.log(JSON.stringify(validateStepOutputValue(args as Parameters<typeof validateStepOutputValue>[0], REPO_ROOT)))
      break
    default:
      throw new Error(`unknown tool: ${name}`)
  }
}

function usage() {
  console.error(`Usage:
  benchmark_bridge.ts list
  benchmark_bridge.ts prepare <seed.json> <test.json>
  benchmark_bridge.ts score <seed.json> <test.json> '<run-json>'
  benchmark_bridge.ts tool <derive_step_prompt|validate_step_output> '<json-args>'
  benchmark_bridge.ts parse-test <test.json>`)
  process.exit(2)
}

const [cmd, ...rest] = process.argv.slice(2)
switch (cmd) {
  case "list":
    cmdList()
    break
  case "prepare":
    if (rest.length < 2) usage()
    cmdPrepare(rest[0]!, rest[1]!)
    break
  case "score":
    if (rest.length < 3) usage()
    cmdScore(rest[0]!, rest[1]!, rest[2]!)
    break
  case "parse-test":
    if (rest.length < 1) usage()
    cmdParseTest(rest[0]!)
    break
  case "tool":
    if (rest.length < 2) usage()
    cmdTool(rest[0]!, rest[1]!)
    break
  default:
    usage()
}

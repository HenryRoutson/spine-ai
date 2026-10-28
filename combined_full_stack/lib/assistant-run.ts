// AI : shared client path for agent / Vibe approve-to-run (source: assistant | testing).

import { buildChatbotResult } from "@/lib/chatbot-step"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { readAllowDuplicateRuns } from "@/lib/inference-settings"
import {
  buildDefaultInputDocs,
  flattenInputDocIds,
  inputDocsByModuleFromAssignment,
  moduleInputReady,
  orderedInputModules,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import { docsForProject } from "@/lib/project-docs"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { awaitRun, startRun, startRunWithRetry, type AwaitRunResult } from "@/lib/run-engine"
import { formatRunErrorForDisplay } from "@/lib/run-errors"
import { runHasErrors } from "@/lib/run-error-log"
import { formatTestFailuresForClipboard } from "@/lib/test-error-copy"
import { evaluateTestReport } from "@/lib/testing-evaluate"
import {
  isTestingFileName,
  parseTestFile,
  resolveTestRunInputs,
  testContentSig,
  testPipelineSig,
  testVerdictForFile,
  type SpineTestFile,
  type TestStepResult,
} from "@/lib/testing-files"
import {
  ModuleKind,
  RunSource,
  RunTestStepStatus,
  type DocId,
  type DocRef,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type PipelineRun,
  type Project,
  type ProjectId,
  type RunJobId,
  type RunTestReport,
} from "@/lib/types"

export type AssistantRunInferenceArgs = {
  project: Project
  modules: PipelineModule[]
  docs: DocRef[]
  model: ModelId
  /** AI : optional override; else default assignment from project docs. */
  inputDocs?: InputDocsAssignment
  allowDuplicateRuns?: boolean
}

export type AssistantRunInferenceReady = {
  ok: true
  inputDocs: InputDocsAssignment
  primary: DocId
  rest: DocId[]
  byModule: Partial<Record<ModuleId, DocId[]>>
}

export type AssistantRunInferenceBlocked = {
  ok: false
  reason: string
}

export function resolveAssistantInferenceInputs(
  args: AssistantRunInferenceArgs,
): AssistantRunInferenceReady | AssistantRunInferenceBlocked {
  const inputModules = orderedInputModules(args.modules)
  if (!inputModules.length) {
    return { ok: false, reason: "Pipeline has no input steps to run." }
  }
  const inputDocs =
    args.inputDocs ?? buildDefaultInputDocs(args.docs, args.project, inputModules)
  const missing = inputModules.filter((m) => !moduleInputReady(m, inputDocs))
  if (missing.length) {
    return {
      ok: false,
      reason: `Assign documents for: ${missing.map((m) => m.label || m.id).join(", ")}`,
    }
  }
  const orderedIds = flattenInputDocIds(inputModules, inputDocs)
  const primary = orderedIds[0]
  if (!primary) {
    return { ok: false, reason: "No input documents selected." }
  }
  return {
    ok: true,
    inputDocs,
    primary,
    rest: orderedIds.slice(1),
    byModule: inputDocsByModuleFromAssignment(inputModules, inputDocs),
  }
}

export async function startAssistantInferenceRun(
  projectId: ProjectId,
  resolved: AssistantRunInferenceReady,
  model: ModelId,
  allowDuplicateRuns = readAllowDuplicateRuns(),
): Promise<{ jobId: RunJobId }> {
  return startRun(
    projectId,
    resolved.primary,
    model,
    resolved.rest,
    resolved.byModule,
    allowDuplicateRuns,
    RunSource.Assistant,
  )
}

export async function runAssistantInference(
  args: AssistantRunInferenceArgs,
): Promise<AwaitRunResult> {
  const resolved = resolveAssistantInferenceInputs(args)
  if (!resolved.ok) throw new Error(resolved.reason)
  const { jobId } = await startAssistantInferenceRun(
    args.project.id,
    resolved,
    args.model,
    args.allowDuplicateRuns ?? readAllowDuplicateRuns(),
  )
  // AI : agent/Vibe unattended — auto-approve human gates (same as Testing).
  return awaitRun(jobId, {
    onHumanReview: () => Promise.resolve("approved" as const),
    onChatbot: (spec) => {
      const prompt =
        spec.input &&
        typeof spec.input === "object" &&
        !Array.isArray(spec.input) &&
        typeof (spec.input as { prompt?: unknown }).prompt === "string"
          ? (spec.input as { prompt: string }).prompt
          : ""
      return Promise.resolve(buildChatbotResult(prompt, [], "exit"))
    },
    projectLlmProviders: args.project.llmProviders,
  })
}

export function pipelineHasHumanGate(modules: PipelineModule[]): boolean {
  return modules.some((m) => m.kind === ModuleKind.HumanReview || m.kind === ModuleKind.Chatbot)
}

export function listProjectTestingDocs(docs: DocRef[], project: Project): DocRef[] {
  return docsForProject(docs, project).filter((d) => isTestingFileName(d.name))
}

export function pickProjectTestingDoc(
  docs: DocRef[],
  project: Project,
  testDocName?: string,
): DocRef | null {
  const testing = listProjectTestingDocs(docs, project)
  if (!testing.length) return null
  if (!testDocName?.trim()) return testing[0] ?? null
  const want = testDocName.trim().toLowerCase()
  return (
    testing.find((d) => d.name.toLowerCase() === want) ??
    testing.find((d) => d.name.toLowerCase().includes(want)) ??
    null
  )
}

export type AssistantTestRunResult = {
  run: PipelineRun
  report: TestStepResult[]
  testDocName: string
  passed: boolean
  persistedTest: RunTestReport
  test: SpineTestFile
}

export async function runAssistantTest(args: {
  project: Project
  modules: PipelineModule[]
  docs: DocRef[]
  model: ModelId
  testDocName?: string
  flushPendingSave?: () => Promise<boolean | void>
}): Promise<AssistantTestRunResult> {
  const doc = pickProjectTestingDoc(args.docs, args.project, args.testDocName)
  if (!doc) {
    throw new Error(
      args.testDocName?.trim()
        ? `No testing file named "${args.testDocName}" (*_testing.json).`
        : "No *_testing.json files in this project — ask the agent to create one, or open Testing.",
    )
  }
  const data = await fetchDocText(doc.id)
  const content = docTextContent(data)
  const parsed = parseTestFile(content)
  if (!parsed.ok) throw new Error(`${doc.name}: ${parsed.error}`)

  const projectDocs = docsForProject(args.docs, args.project)
  const resolved = resolveTestRunInputs(parsed.test, args.modules, projectDocs)
  if (!resolved.ok) throw new Error(resolved.error)

  await args.flushPendingSave?.()
  const { jobId } = await startRunWithRetry(
    args.project.id,
    resolved.primary,
    args.model,
    resolved.rest,
    resolved.byModule,
    // AI : every agent test gets its own Logging entry (same as Testing tab).
    true,
    RunSource.Testing,
  )
  const { run } = await awaitRun(jobId, {
    onHumanReview: () => Promise.resolve("approved" as const),
    onChatbot: (spec) => {
      const prompt =
        spec.input &&
        typeof spec.input === "object" &&
        !Array.isArray(spec.input) &&
        typeof (spec.input as { prompt?: unknown }).prompt === "string"
          ? (spec.input as { prompt: string }).prompt
          : ""
      return Promise.resolve(buildChatbotResult(prompt, [], "exit"))
    },
    projectLlmProviders: args.project.llmProviders,
  })

  const report = await evaluateTestReport(run, parsed.test, args.project, args.model)
  const passed = testVerdictForFile(parsed.test, report, run, false)
  const persistedTest: RunTestReport = {
    testDocName: doc.name,
    results: report,
    testContentSig: testContentSig(content),
    pipelineSig: testPipelineSig(args.project, args.model),
    expectFailure: parsed.test.expectFailure,
  }
  return {
    run: { ...run, source: run.source ?? RunSource.Testing, test: persistedTest },
    report,
    testDocName: doc.name,
    passed,
    persistedTest,
    test: parsed.test,
  }
}

export function formatAssistantInferenceVerdict(run: PipelineRun): string {
  const display = formatRunErrorForDisplay(run)
  const lines = [
    `Pipeline run finished · ${run.status} · ${formatSecondsShort(run.totalMs)} · ${formatCostCents(run.billedCents)}`,
    `Run id: ${run.id}${run.source ? ` · source: ${run.source}` : ""}`,
  ]
  if (display) {
    lines.push(`${display.title}: ${display.message}`)
  } else if (!runHasErrors(run)) {
    lines.push("No step errors.")
  }
  return lines.join("\n")
}

export function formatAssistantTestVerdict(result: AssistantTestRunResult): string {
  const { run, report, testDocName, passed, test } = result
  const lines = [
    `Test ${passed ? "PASSED" : "FAILED"} · ${testDocName}`,
    `Run ${run.id} · ${run.status} · ${formatSecondsShort(run.totalMs)} · ${formatCostCents(run.billedCents)}`,
  ]
  if (test.description?.trim()) lines.push(test.description.trim())
  const failCount = report.filter(
    (r) =>
      r.status === RunTestStepStatus.Fail ||
      r.status === RunTestStepStatus.NotReached ||
      r.inputDescriptionCheck?.matches === false,
  ).length
  const passCount = report.length - failCount
  lines.push(`Steps: ${passCount} ok · ${failCount} failing (of ${report.length})`)
  if (!passed) {
    const detail = formatTestFailuresForClipboard(report, {
      testDocName,
      run,
      includePipelineInput: false,
    })
    if (detail.trim()) {
      lines.push("")
      lines.push(detail.trim().slice(0, 3500))
    }
  }
  return lines.join("\n")
}

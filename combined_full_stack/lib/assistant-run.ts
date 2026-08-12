// AI : shared client path for agent / Vibe approve-to-run (source: assistant).

import { readAllowDuplicateRuns } from "@/lib/inference-settings"
import {
  buildDefaultInputDocs,
  flattenInputDocIds,
  inputDocsByModuleFromAssignment,
  moduleInputReady,
  orderedInputModules,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import { awaitRun, startRun, type AwaitRunResult } from "@/lib/run-engine"
import {
  ModuleKind,
  RunSource,
  type DocId,
  type DocRef,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type Project,
  type ProjectId,
  type RunJobId,
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
  return awaitRun(jobId, {})
}

export function pipelineHasHumanGate(modules: PipelineModule[]): boolean {
  return modules.some((m) => m.kind === ModuleKind.HumanReview || m.kind === ModuleKind.Chatbot)
}

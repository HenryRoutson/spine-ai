// AI : client shim for the real server run engine — POST /api/runs starts the pipeline,
// AI : then the Inference tab polls progress until the persisted PipelineRun arrives.
// AI : user-authored transform/custom steps run here in the browser (never on the server).
import { invariant } from "@/lib/assert"
import {
  CustomCodeExhaustedError,
  formatCustomCodeFailureLog,
  runAssertWithFallbacks,
  runCustomCodeWithFallbacks,
} from "@/lib/custom_code"
import { readApiErrorBody, formatApiError, JSON_HEADERS, FETCH_NO_STORE } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import type {
  DocId,
  JobLogEntry,
  ModelId,
  ModuleId,
  PipelineRun,
  ProjectId,
  RunJob,
  RunJobId,
  RunStepStatus,
  StepDescriptionFields,
  StepProgress,
  StepSubProgress,
} from "@/lib/types"
import type { ClientStepSpec } from "@/lib/run-types"

export type StepUiState = StepDescriptionFields & {
  status: StepProgress["status"] | "idle"
  sub?: StepSubProgress
}

type StepUiStatus = StepProgress["status"] | RunStepStatus | "idle"

function mergeStepDescriptionFields(
  cur: StepUiState | undefined,
  next: StepProgress,
): Pick<
  StepUiState,
  "outputPreview" | "inputDescriptionCheck" | "descriptionCheckLlmCalls" | "descriptionCheckCostCents"
> {
  const stepDone = next.status !== "running"
  return {
    outputPreview: next.outputPreview ?? (stepDone ? cur?.outputPreview : cur?.outputPreview),
    inputDescriptionCheck: next.inputDescriptionCheck ?? cur?.inputDescriptionCheck,
    descriptionCheckLlmCalls: next.descriptionCheckLlmCalls ?? cur?.descriptionCheckLlmCalls,
    descriptionCheckCostCents: next.descriptionCheckCostCents ?? cur?.descriptionCheckCostCents,
  }
}

function stepStatusRank(s: StepUiStatus): number {
  if (s === "running") return 1
  if (s === "ok" || s === "cached") return 2
  if (s === "error") return 3
  return 0
}

// AI : stale Supabase polls must not rewind a step from ok → running in the progress UI.
export function mergeStepStates(
  prev: Map<ModuleId, StepUiState>,
  polled: StepProgress[],
): Map<ModuleId, StepUiState> {
  const next = new Map(prev)
  for (const s of polled) {
    invariant(s.moduleId, "step progress missing moduleId")
    const cur = next.get(s.moduleId)
    const curStatus = cur?.status ?? "idle"
    let status: StepUiState["status"] = curStatus
    if (!cur || s.status === "error" || stepStatusRank(s.status) >= stepStatusRank(curStatus)) {
      status = s.status
    }
    const descFields = mergeStepDescriptionFields(cur, s)
    next.set(s.moduleId, {
      status,
      sub: status === "running" ? s.sub ?? cur?.sub : undefined,
      ...descFields,
    })
  }
  return next
}

export class RunStartError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = "RunStartError"
  }
}

// AI : 402 from POST /api/runs — insufficient credit or billing cap; Inference shows a Billing CTA.
export function isRunBillingError(e: unknown): e is RunStartError {
  return e instanceof RunStartError && e.status === 402
}

const MAX_PROGRESS_POLLS = 10
const PROGRESS_POLL_BACKOFF_MS = 200

function throwApiError(context: string, res: Response, body: Awaited<ReturnType<typeof readApiErrorBody>>): never {
  throw new RunStartError(formatApiError(context, res, body), res.status, body?.code)
}

export type StartRunResult = {
  jobId: RunJobId;
  fingerprint?: string;
};

export async function startRun(
  projectId: ProjectId,
  inputDocId: DocId,
  model: ModelId,
  inputDocIds: DocId[] = [],
  inputDocsByModule?: Partial<Record<ModuleId, DocId[]>>,
): Promise<StartRunResult> {
  const res = await fetch(API_ROUTES.runs, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ projectId, inputDocId, inputDocIds, inputDocsByModule, model }),
  })
  if (!res.ok) {
    const body = await readApiErrorBody(res)
    throw new RunStartError(
      formatApiError(
        `Failed to start pipeline for project ${projectId}, doc ${inputDocId}, model ${model}`,
        res,
        body,
      ),
      res.status,
      body?.code,
    )
  }
  const body = (await res.json()) as StartRunResult
  invariant(body.jobId, `POST /api/runs missing jobId for project ${projectId}`)
  return body
}

export async function runProgress(jobId: RunJobId): Promise<RunJob> {
  // AI : first polls can 404 when progress GET hits a cold bundle before the job file is visible.
  let lastDetail: string | undefined
  for (let attempt = 0; attempt < MAX_PROGRESS_POLLS; attempt++) {
    const res = await fetch(API_ROUTES.runProgress(jobId), FETCH_NO_STORE)
    if (res.status === 404 && attempt < MAX_PROGRESS_POLLS - 1) {
      const body = await readApiErrorBody(res)
      lastDetail = [body?.error, body?.detail].filter(Boolean).join(" — ") || lastDetail
      await new Promise((r) => setTimeout(r, PROGRESS_POLL_BACKOFF_MS * (attempt + 1)))
      continue
    }
    if (!res.ok) {
      throwApiError(`Progress poll for job ${jobId} failed`, res, await readApiErrorBody(res))
    }
    return res.json() as Promise<RunJob>
  }
  throw new Error(
    `Progress poll for job ${jobId} failed after ${MAX_PROGRESS_POLLS} attempts (404)` +
      (lastDetail ? `: ${lastDetail}` : ": server has no record of this run") +
      ". The job may not have been created, or the server restarted and dropped in-progress runs. Try Run pipeline again.",
  )
}

export interface AwaitRunCallbacks {
  onStep?: (steps: StepProgress[]) => void
  onLogs?: (logs: JobLogEntry[], newLines: JobLogEntry[]) => void
  // AI : human-review steps pause until the operator approves or rejects in Inference.
  onHumanReview?: (spec: ClientStepSpec) => Promise<"approved" | "rejected">
}

export type AwaitRunResult = {
  run: PipelineRun
  deduped?: boolean
  cachedRunId?: PipelineRun["id"]
}

export type ClientStepSubmitPayload = {
  output?: unknown
  error?: string
  clientLogs?: JobLogEntry[]
}

// AI : shared poll loop for dev runs and shared-link runs — handles browser client steps + human review.
export async function awaitJobCompletion(
  poll: () => Promise<RunJob>,
  submitClientStep: (payload: ClientStepSubmitPayload) => Promise<void>,
  callbacks: AwaitRunCallbacks | ((steps: StepProgress[]) => void),
  intervalMs = 700,
): Promise<AwaitRunResult> {
  const { onStep, onLogs, onHumanReview } = typeof callbacks === "function" ? { onStep: callbacks } : callbacks
  let seenLogs = 0
  let clientStepBusy = false
  let clientStepSubmittedFor: ModuleId | undefined
  for (;;) {
    const job = await poll()
    onStep?.(job.steps)
    const logs = job.logs ?? []
    const newLines = logs.slice(seenLogs)
    if (newLines.length) {
      for (const l of newLines) {
        const fn = l.level === "error" ? console.error : l.level === "warn" ? console.warn : console.log
        fn(`[pipeline] ${l.line}`)
      }
      onLogs?.(logs, newLines)
      seenLogs = logs.length
    }
    if (!job.clientStep) clientStepSubmittedFor = undefined
    if (
      job.clientStep?.kind === "human-review" &&
      !job.run &&
      !job.error &&
      !clientStepBusy &&
      clientStepSubmittedFor !== job.clientStep.moduleId
    ) {
      const spec = job.clientStep
      if (onHumanReview) {
        clientStepBusy = true
        try {
          const decision = await onHumanReview(spec)
          if (decision === "approved") {
            await submitClientStep({ output: spec.input })
          } else {
            await submitClientStep({ error: "Human review rejected" })
          }
          clientStepSubmittedFor = spec.moduleId
        } finally {
          clientStepBusy = false
        }
        continue
      }
      throw new Error("This pipeline requires human review, which is not available on this page")
    }
    if (
      job.clientStep &&
      job.clientStep.kind !== "human-review" &&
      !job.run &&
      !job.error &&
      !clientStepBusy &&
      clientStepSubmittedFor !== job.clientStep.moduleId
    ) {
      const { moduleId, entries, input, pipelineState, kind, expectedOutputs } = job.clientStep
      if (!entries?.length) {
        await submitClientStep({ error: `${kind} step has no code configured` })
        clientStepSubmittedFor = moduleId
        continue
      }
      clientStepBusy = true
      const clientLogs: JobLogEntry[] = []
      const tag = kind === "assert" ? "assert" : "custom-code"
      try {
        const { output, failures, attemptIndex, language } =
          kind === "assert"
            ? await runAssertWithFallbacks(entries, input, pipelineState, expectedOutputs)
            : await runCustomCodeWithFallbacks(entries, input, pipelineState)
        for (const f of failures) {
          clientLogs.push({
            at: Date.now(),
            level: "warn",
            tag,
            line: formatCustomCodeFailureLog(f, tag),
            moduleId,
          })
        }
        if (failures.length) {
          clientLogs.push({
            at: Date.now(),
            level: "info",
            tag,
            line: `${tag} succeeded on attempt ${attemptIndex + 1} (${language}) after ${failures.length} fallback(s)`,
            moduleId,
          })
        }
        if (output === undefined) {
          throw new Error(
            kind === "assert"
              ? "assert returned undefined — throw or return true on success"
              : "custom code returned undefined — add a trailing (input) => output arrow or an explicit return",
          )
        }
        await submitClientStep({ output, clientLogs })
        clientStepSubmittedFor = moduleId
      } catch (err) {
        const failures =
          err instanceof CustomCodeExhaustedError
            ? err.failures
            : [
                {
                  attemptIndex: 0,
                  language: entries[0]?.language ?? "typescript",
                  code: entries[0]?.code ?? "",
                  error: (err as Error).message,
                  stack: (err as Error).stack,
                  input,
                },
              ]
        for (const f of failures) {
          clientLogs.push({
            at: Date.now(),
            level: "error",
            tag,
            line: formatCustomCodeFailureLog(f, tag),
            moduleId,
          })
        }
        clientLogs.push({
          at: Date.now(),
          level: "error",
          tag,
          line: `${tag} exhausted all ${entries.length} attempt(s)`,
          moduleId,
        })
        await submitClientStep({
          error: (err as Error).message,
          clientLogs,
        })
        clientStepSubmittedFor = moduleId
      } finally {
        clientStepBusy = false
      }
      continue
    }
    if (job.error) throw new Error(job.error)
    if (job.run) {
      invariant(job.run.id, "completed job missing run.id")
      invariant(!job.clientStep, `completed job still has pending client step ${job.clientStep?.moduleId}`)
      return {
        run: job.run,
        deduped: job.deduped,
        cachedRunId: job.cachedRunId,
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

// AI : poll until the run finishes; callbacks stream progress + server logs to the UI / console.
async function submitClientStep(
  jobId: RunJobId,
  payload: ClientStepSubmitPayload,
): Promise<void> {
  const res = await fetch(API_ROUTES.runClientStep(jobId), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })
  if (res.ok) return
  const body = await readApiErrorBody(res)
  // AI : race fix — stale progress can trigger a second POST after claim; 409 is harmless, keep polling.
  if (res.status === 409 && body?.error?.includes("not waiting for client code")) return
  throwApiError(`Client code step for job ${jobId} failed`, res, body)
}

export async function awaitRun(
  jobId: RunJobId,
  callbacks: AwaitRunCallbacks | ((steps: StepProgress[]) => void),
  intervalMs = 700,
): Promise<AwaitRunResult> {
  return awaitJobCompletion(
    () => runProgress(jobId),
    (payload) => submitClientStep(jobId, payload),
    callbacks,
    intervalMs,
  )
}

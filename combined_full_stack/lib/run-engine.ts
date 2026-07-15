// AI : client shim for the real server run engine — POST /api/runs starts the pipeline,
// AI : then the Inference tab polls progress until the persisted PipelineRun arrives.
// AI : user-authored transform/custom steps run here in the browser (never on the server).
import { invariant } from "@/lib/assert"
import {
  CustomCodeExhaustedError,
  formatCustomCodeFailureLog,
  runAssertWithFallbacks,
  runCustomCodeWithFallbacks,
  type CustomCodeAttemptFailure,
} from "@/lib/custom_code"
import { CODE_ERROR_NS, recordCodeError } from "@/lib/code-error-history"
import { readApiErrorBody, formatApiError, JSON_HEADERS, FETCH_NO_STORE } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { RATE_LIMITS } from "@/lib/rate_limit_config"
import type {
  DocId,
  JobLogEntry,
  ModelId,
  ModuleId,
  PipelineRun,
  ProjectId,
  RunJob,
  RunJobId,
  RunSource,
  RunStepStatus,
  StepDescriptionFields,
  StepProgress,
  StepSubProgress,
} from "@/lib/types"
import { JobLogLevel, type ClientStepSpec } from "@/lib/run-types"
import type { HumanReviewDecision, UserFeedbackPayload } from "@/lib/feedback-types"

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
    outputPreview: next.outputPreview ?? (stepDone ? cur?.outputPreview : undefined),
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
const PROGRESS_429_RETRY_MAX = 60
const DEFAULT_POLL_INTERVAL_MS = 700

// AI : parallel job polls share one user rate-limit bucket — stretch interval so N jobs stay under poll tier max.
export function pollIntervalForParallelJobs(parallelCount: number): number {
  const maxPerMin = RATE_LIMITS.poll.max
  const minGapMs = Math.ceil(60_000 / maxPerMin)
  return Math.max(DEFAULT_POLL_INTERVAL_MS, minGapMs * Math.max(1, parallelCount))
}

function retryAfterMs(res: Response): number {
  const sec = Number.parseInt(res.headers.get("Retry-After") ?? "2", 10)
  return Math.max(500, (Number.isFinite(sec) ? sec : 2) * 1000)
}

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
  allowDuplicateRuns = false,
  source?: RunSource.Testing,
): Promise<StartRunResult> {
  const res = await fetch(API_ROUTES.runs, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      projectId,
      inputDocId,
      inputDocIds,
      inputDocsByModule,
      model,
      allowDuplicateRuns,
      source,
    }),
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

export async function pollJobProgress(url: string, context: string): Promise<RunJob> {
  // AI : first polls can 404 when progress GET hits a cold bundle before the job file is visible.
  let lastDetail: string | undefined
  let notFoundAttempts = 0
  let rateLimitRetries = 0
  while (notFoundAttempts < MAX_PROGRESS_POLLS) {
    const res = await fetch(url, FETCH_NO_STORE)
    if (res.status === 429 && rateLimitRetries < PROGRESS_429_RETRY_MAX) {
      rateLimitRetries++
      await readApiErrorBody(res)
      await new Promise((r) => setTimeout(r, retryAfterMs(res)))
      continue
    }
    if (res.status === 404 && notFoundAttempts < MAX_PROGRESS_POLLS - 1) {
      const body = await readApiErrorBody(res)
      lastDetail = [body?.error, body?.detail].filter(Boolean).join(" — ") || lastDetail
      notFoundAttempts++
      await new Promise((r) => setTimeout(r, PROGRESS_POLL_BACKOFF_MS * notFoundAttempts))
      continue
    }
    if (!res.ok) {
      throwApiError(`${context} failed`, res, await readApiErrorBody(res))
    }
    return res.json() as Promise<RunJob>
  }
  throw new Error(
    `${context} failed after ${MAX_PROGRESS_POLLS} attempts (404)` +
      (lastDetail ? `: ${lastDetail}` : ": server has no record of this run") +
      ". The job may not have been created, or the server restarted and dropped in-progress runs. Try Run pipeline again.",
  )
}

export async function runProgress(jobId: RunJobId): Promise<RunJob> {
  return pollJobProgress(API_ROUTES.runProgress(jobId), `Progress poll for job ${jobId}`)
}

export interface AwaitRunCallbacks {
  onStep?: (steps: StepProgress[]) => void
  onLogs?: (logs: JobLogEntry[], newLines: JobLogEntry[]) => void
  // AI : human-review steps pause until the operator approves or rejects in Inference.
  onHumanReview?: (spec: ClientStepSpec) => Promise<HumanReviewDecision>
  signal?: AbortSignal
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
  feedback?: UserFeedbackPayload
}

// AI : assert/custom-code failures are expected project outcomes — warn in console, not Next.js console.error overlay.
function pipelineLogToConsole(entry: JobLogEntry): void {
  const fn = entry.level === "info" ? console.log : console.warn
  fn(`[pipeline] ${entry.line}`)
}

function clientStepFailureLogLevel(tag: string): JobLogEntry["level"] {
  return tag === "assert" || tag === "custom-code" ? JobLogLevel.Warn : JobLogLevel.Error
}

function recordCustomCodeFailures(failures: CustomCodeAttemptFailure[]): void {
  for (const f of failures) {
    recordCodeError(f.code, f.error, CODE_ERROR_NS.customCode)
  }
}

function clientStepSubmitError(kind: string, err: unknown, stepLabel?: string): string {
  const uiLocation = `Inference → Run Pipeline → ${kind} step${stepLabel ? ` (${stepLabel})` : ""}`;
  if (err instanceof CustomCodeExhaustedError) {
    const last = err.failures[err.failures.length - 1];
    if (kind === "assert" && last?.error) {
      return [
        last.error,
        `UI location: ${uiLocation}`,
        formatCustomCodeFailureLog(last, "assert"),
      ].join("\n");
    }
    if (last) {
      return [
        err.message,
        `UI location: ${uiLocation}`,
        formatCustomCodeFailureLog(last, kind === "assert" ? "assert" : "custom-code"),
      ].join("\n");
    }
    return err.message;
  }
  const { message, stack } = err instanceof Error ? err : { message: String(err), stack: undefined };
  return [
    message,
    `UI location: ${uiLocation}`,
    ...(stack?.trim() ? ["Stack trace:", stack.trim()] : []),
  ].join("\n");
}

// AI : shared poll loop for dev runs and shared-link runs — handles browser client steps + human review.
export async function awaitJobCompletion(
  poll: () => Promise<RunJob>,
  submitClientStep: (payload: ClientStepSubmitPayload) => Promise<void>,
  callbacks: AwaitRunCallbacks | ((steps: StepProgress[]) => void),
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
): Promise<AwaitRunResult> {
  const { onStep, onLogs, onHumanReview, signal } =
    typeof callbacks === "function" ? { onStep: callbacks } : callbacks
  let seenLogs = 0
  let clientStepBusy = false
  let clientStepSubmittedFor: ModuleId | undefined
  for (;;) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    const job = await poll()
    onStep?.(job.steps)
    const logs = job.logs ?? []
    const newLines = logs.slice(seenLogs)
    if (newLines.length) {
      for (const l of newLines) pipelineLogToConsole(l)
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
          if (decision.decision === "approved") {
            await submitClientStep({ output: spec.input, feedback: decision.feedback })
          } else {
            await submitClientStep({
              error: "Human review rejected",
              feedback: decision.feedback,
            })
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
      const { moduleId, label, entries, input, pipelineState, kind, expectedOutputs } = job.clientStep
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
            level: JobLogLevel.Warn,
            tag,
            line: formatCustomCodeFailureLog(f, tag),
            moduleId,
          })
        }
        recordCustomCodeFailures(failures)
        if (failures.length) {
          clientLogs.push({
            at: Date.now(),
            level: JobLogLevel.Info,
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
        const failureLevel = clientStepFailureLogLevel(tag)
        for (const f of failures) {
          clientLogs.push({
            at: Date.now(),
            level: failureLevel,
            tag,
            line: formatCustomCodeFailureLog(f, tag),
            moduleId,
          })
        }
        recordCustomCodeFailures(failures)
        clientLogs.push({
          at: Date.now(),
          level: failureLevel,
          tag,
          line: `${tag} exhausted all ${entries.length} attempt(s)`,
          moduleId,
        })
        await submitClientStep({
          error: clientStepSubmitError(kind, err, label),
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

const CONCURRENT_RETRY_MS = 800
const CONCURRENT_RETRY_MAX = 90

// AI : batch test runs share the server job pool — wait for a slot instead of failing on 429.
export async function startRunWithRetry(...args: Parameters<typeof startRun>): Promise<StartRunResult> {
  for (let attempt = 0; attempt < CONCURRENT_RETRY_MAX; attempt++) {
    try {
      return await startRun(...args)
    } catch (e) {
      if (e instanceof RunStartError && e.code === "concurrent_runs" && attempt < CONCURRENT_RETRY_MAX - 1) {
        await new Promise((r) => setTimeout(r, CONCURRENT_RETRY_MS))
        continue
      }
      throw e
    }
  }
  throw new Error("Timed out waiting for a free run slot")
}

export async function cancelRun(jobId: RunJobId): Promise<void> {
  const res = await fetch(API_ROUTES.run(jobId), { method: "DELETE", headers: JSON_HEADERS })
  if (res.ok) return
  if (res.status === 404) return
  throwApiError(`Cancel run job ${jobId} failed`, res, await readApiErrorBody(res))
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
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
): Promise<AwaitRunResult> {
  return awaitJobCompletion(
    () => runProgress(jobId),
    (payload) => submitClientStep(jobId, payload),
    callbacks,
    intervalMs,
  )
}

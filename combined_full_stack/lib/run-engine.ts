// AI : client shim for the real server run engine — POST /api/runs starts the pipeline,
// AI : then the Inference tab polls progress until the persisted PipelineRun arrives.
// AI : user-authored transform/custom steps run here in the browser (never on the server).
import { runCustomFn } from "@/lib/custom_code"
import { readApiErrorBody, formatApiError } from "@/lib/api-client"
import type { DocId, ModelId, ModuleId, PipelineRun, ProjectId, RunStepStatus } from "@/lib/types"
import type { JobLogEntry, RunJob, RunJobId, StepProgress, StepSubProgress } from "@/lib/types"

export type { JobLogEntry, RunJob, RunJobId, StepProgress, StepSubProgress }

export type StepUiState = {
  status: StepProgress["status"] | "idle"
  sub?: StepSubProgress
}

type StepUiStatus = StepProgress["status"] | RunStepStatus | "idle"

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
    const cur = next.get(s.moduleId)
    const curStatus = cur?.status ?? "idle"
    let status: StepUiState["status"] = curStatus
    if (!cur || s.status === "error" || stepStatusRank(s.status) >= stepStatusRank(curStatus)) {
      status = s.status
    }
    next.set(s.moduleId, {
      status,
      sub: status === "running" ? s.sub ?? cur?.sub : undefined,
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

function throwApiError(context: string, res: Response, body: Awaited<ReturnType<typeof readApiErrorBody>>): never {
  throw new RunStartError(formatApiError(context, res, body), res.status, body?.code)
}

export type StartRunResult = {
  jobId: RunJobId;
  deduped?: boolean;
  cachedRunId?: PipelineRun["id"];
  fingerprint?: string;
};

export type MatchRunResult = {
  fingerprint: string;
  cachedRunId: string | null;
  run: PipelineRun | null;
};

export async function matchRun(
  projectId: ProjectId,
  inputDocId: DocId,
  model: ModelId,
  inputDocIds: DocId[] = [],
): Promise<MatchRunResult> {
  const res = await fetch("/api/runs/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, inputDocId, inputDocIds, model }),
  });
  if (!res.ok) {
    throw new Error(
      formatApiError(
        `Failed to match run for project ${projectId}, doc ${inputDocId}, model ${model}`,
        res,
        await readApiErrorBody(res),
      ),
    );
  }
  return (await res.json()) as MatchRunResult;
}

export async function startRun(
  projectId: ProjectId,
  inputDocId: DocId,
  model: ModelId,
  inputDocIds: DocId[] = [],
): Promise<StartRunResult> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, inputDocId, inputDocIds, model }),
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
  return (await res.json()) as StartRunResult
}

export async function runProgress(jobId: RunJobId): Promise<RunJob> {
  // AI : first polls can 404 when progress GET hits a cold bundle before the job file is visible.
  let lastDetail: string | undefined
  for (let attempt = 0; attempt < MAX_PROGRESS_POLLS; attempt++) {
    const res = await fetch(`/api/runs/${jobId}/progress`, { cache: "no-store" })
    if (res.status === 404 && attempt < MAX_PROGRESS_POLLS - 1) {
      const body = await readApiErrorBody(res)
      lastDetail = [body?.error, body?.detail].filter(Boolean).join(" — ") || lastDetail
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
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
}

export type AwaitRunResult = {
  run: PipelineRun
  deduped?: boolean
  cachedRunId?: PipelineRun["id"]
}

// AI : poll until the run finishes; callbacks stream progress + server logs to the UI / console.
async function submitClientStep(jobId: RunJobId, output: unknown): Promise<void> {
  const res = await fetch(`/api/runs/${jobId}/client-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ output }),
  })
  if (!res.ok) {
    throwApiError(`Client code step for job ${jobId} failed`, res, await readApiErrorBody(res))
  }
}

export async function awaitRun(
  jobId: RunJobId,
  callbacks: AwaitRunCallbacks | ((steps: StepProgress[]) => void),
  intervalMs = 700,
): Promise<AwaitRunResult> {
  const { onStep, onLogs } = typeof callbacks === "function" ? { onStep: callbacks } : callbacks
  let seenLogs = 0
  let clientStepBusy = false
  for (;;) {
    const job = await runProgress(jobId)
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
    if (job.clientStep && !job.run && !job.error && !clientStepBusy) {
      clientStepBusy = true
      try {
        const output = await runCustomFn(job.clientStep.code, job.clientStep.input)
        await submitClientStep(jobId, output)
      } finally {
        clientStepBusy = false
      }
      continue
    }
    if (job.error) throw new Error(`Pipeline run ${jobId} failed: ${job.error}`)
    if (job.run) {
      return {
        run: job.run,
        deduped: job.deduped,
        cachedRunId: job.cachedRunId,
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

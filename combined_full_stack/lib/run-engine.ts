// AI : client shim for the real server run engine — POST /api/runs starts the pipeline,
// AI : then the Inference tab polls progress until the persisted PipelineRun arrives.
// AI : type-only imports from lib/server are erased at compile time (no Node code bundled).
import type { JobLogEntry, RunJob, RunJobId } from "@/lib/server/run_jobs"
import type { StepProgress } from "@/lib/server/run_engine"
import type { DocId, ModelId, ModuleId, PipelineRun, ProjectId, RunStepStatus } from "@/lib/types"

export type { JobLogEntry, RunJob, RunJobId, StepProgress }

type StepUiStatus = StepProgress["status"] | RunStepStatus

function stepStatusRank(s: StepUiStatus): number {
  if (s === "running") return 1
  if (s === "ok" || s === "cached") return 2
  if (s === "error") return 3
  return 0
}

// AI : stale Supabase polls must not rewind a step from ok → running in the progress UI.
export function mergeStepStates(
  prev: Map<ModuleId, StepUiStatus>,
  polled: StepProgress[],
): Map<ModuleId, StepUiStatus> {
  const next = new Map(prev)
  for (const s of polled) {
    const cur = next.get(s.moduleId)
    if (!cur || s.status === "error" || stepStatusRank(s.status) >= stepStatusRank(cur)) {
      next.set(s.moduleId, s.status)
    }
  }
  return next
}

type ApiErrorBody = { error?: string; detail?: string; code?: string }

const MAX_PROGRESS_POLLS = 10

async function readApiErrorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    return (await res.json()) as ApiErrorBody
  } catch {
    return null
  }
}

function formatApiError(context: string, res: Response, body: ApiErrorBody | null): string {
  const parts = [body?.error, body?.detail].filter(Boolean)
  const suffix = parts.length > 0 ? `: ${parts.join(" — ")}` : ""
  const code = body?.code ? ` [${body.code}]` : ""
  return `${context} (HTTP ${res.status})${code}${suffix}`
}

export async function startRun(projectId: ProjectId, inputDocId: DocId, model: ModelId): Promise<RunJobId> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, inputDocId, model }),
  })
  if (!res.ok) {
    throw new Error(
      formatApiError(
        `Failed to start pipeline for project ${projectId}, doc ${inputDocId}, model ${model}`,
        res,
        await readApiErrorBody(res),
      ),
    )
  }
  return (await res.json()).jobId as RunJobId
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
      throw new Error(
        formatApiError(`Progress poll for job ${jobId} failed`, res, await readApiErrorBody(res)),
      )
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

// AI : poll until the run finishes; callbacks stream progress + server logs to the UI / console.
export async function awaitRun(
  jobId: RunJobId,
  callbacks: AwaitRunCallbacks | ((steps: StepProgress[]) => void),
  intervalMs = 700,
): Promise<PipelineRun> {
  const { onStep, onLogs } = typeof callbacks === "function" ? { onStep: callbacks } : callbacks
  let seenLogs = 0
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
    if (job.error) throw new Error(`Pipeline run ${jobId} failed: ${job.error}`)
    if (job.run) return job.run
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

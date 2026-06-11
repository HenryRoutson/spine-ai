// AI : client shim for the real server run engine — POST /api/runs starts the pipeline,
// AI : then the Inference tab polls progress until the persisted PipelineRun arrives.
// AI : type-only imports from lib/server are erased at compile time (no Node code bundled).
import type { RunJob, RunJobId } from "@/lib/server/run_jobs"
import type { StepProgress } from "@/lib/server/run_engine"
import type { DocId, ModelId, PipelineRun, ProjectId } from "@/lib/types"

export type { RunJob, RunJobId, StepProgress }

export async function startRun(projectId: ProjectId, inputDocId: DocId, model: ModelId): Promise<RunJobId> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, inputDocId, model }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `run failed to start (${res.status})`)
  return (await res.json()).jobId as RunJobId
}

export async function runProgress(jobId: RunJobId): Promise<RunJob> {
  const res = await fetch(`/api/runs/${jobId}/progress`)
  if (!res.ok) throw new Error(`progress poll failed (${res.status})`)
  return res.json() as Promise<RunJob>
}

// AI : poll until the run finishes; onStep streams partial progress to the UI.
export async function awaitRun(
  jobId: RunJobId,
  onStep: (steps: StepProgress[]) => void,
  intervalMs = 700,
): Promise<PipelineRun> {
  for (;;) {
    const job = await runProgress(jobId)
    onStep(job.steps)
    if (job.error) throw new Error(job.error)
    if (job.run) return job.run
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

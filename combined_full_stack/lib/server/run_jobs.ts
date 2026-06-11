import type { StepProgress } from "./run_engine";
import type { PipelineRun } from "./types";

export type RunJobId = string & { __brand: "RunJobId" };

// AI : what /api/runs/[id]/progress serves — the Inference tab polls this while the
// AI : pipeline executes server-side after the POST /api/runs response was sent.
export interface RunJob {
  steps: StepProgress[]; // latest progress event per module, in pipeline order
  run?: PipelineRun; // set once the run finished (ok or error)
  error?: string; // set when runPipeline itself threw (e.g. invalid pipeline)
}

type JobsSlot = { __forgeRunJobs?: Map<RunJobId, RunJob> };

function jobs(): Map<RunJobId, RunJob> {
  const g = globalThis as JobsSlot;
  g.__forgeRunJobs ??= new Map();
  return g.__forgeRunJobs;
}

export function createJob(): RunJobId {
  const id = ("job_" + Math.random().toString(36).slice(2, 9)) as RunJobId;
  jobs().set(id, { steps: [] });
  return id;
}

export function jobProgress(id: RunJobId, p: StepProgress): void {
  const job = jobs().get(id);
  if (!job) return;
  const i = job.steps.findIndex((s) => s.moduleId === p.moduleId);
  if (i === -1) job.steps.push(p);
  else job.steps[i] = p;
}

export function finishJob(id: RunJobId, outcome: { run?: PipelineRun; error?: string }): void {
  const job = jobs().get(id);
  if (job) Object.assign(job, outcome);
}

export function getJob(id: RunJobId): RunJob | undefined {
  return jobs().get(id);
}

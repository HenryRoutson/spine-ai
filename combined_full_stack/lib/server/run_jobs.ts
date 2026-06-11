import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
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

function jobsDir(): string {
  return join(dataDir(), "jobs");
}

function jobPath(id: RunJobId): string {
  return join(jobsDir(), `${id}.json`);
}

// AI : disk is source of truth — Next bundles route handlers separately in dev and
// AI : after() can land on a different globalThis than POST / progress GET.
function persistJob(id: RunJobId, job: RunJob): void {
  mkdirSync(jobsDir(), { recursive: true });
  writeFileSync(jobPath(id), JSON.stringify(job), "utf8");
  jobs().set(id, job);
}

function loadJob(id: RunJobId): RunJob | undefined {
  const cached = jobs().get(id);
  if (cached) return cached;
  const path = jobPath(id);
  if (!existsSync(path)) return undefined;
  const job = JSON.parse(readFileSync(path, "utf8")) as RunJob;
  jobs().set(id, job);
  return job;
}

export function createJob(): RunJobId {
  const id = ("job_" + Math.random().toString(36).slice(2, 9)) as RunJobId;
  persistJob(id, { steps: [] });
  return id;
}

export function jobProgress(id: RunJobId, p: StepProgress): void {
  const job = loadJob(id);
  if (!job) return;
  const i = job.steps.findIndex((s) => s.moduleId === p.moduleId);
  if (i === -1) job.steps.push(p);
  else job.steps[i] = p;
  persistJob(id, job);
}

export function finishJob(id: RunJobId, outcome: { run?: PipelineRun; error?: string }): void {
  const job = loadJob(id);
  if (!job) return;
  Object.assign(job, outcome);
  persistJob(id, job);
}

export function getJob(id: RunJobId): RunJob | undefined {
  return loadJob(id);
}

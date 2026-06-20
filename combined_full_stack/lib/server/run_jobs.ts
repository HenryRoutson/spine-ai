import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { dataDir } from "./config";
import { installJobLogSink, type JobLogEntry } from "./job_log_sink";
import type { StepProgress } from "./run_engine";
import { logger } from "./server_logger";
import type { PipelineRun } from "./types";

const jobLog = logger("run-jobs");

export type { JobLogEntry };

const MAX_JOB_LOGS = 400;
const LOG_PERSIST_MS = 300;
const SUPABASE_PERSIST_MS = 200;

// AI : pipeline steps must not await Supabase — disk is sync + shared across Next dev bundles.
const supabasePersistTimers = new Map<RunJobId, ReturnType<typeof setTimeout>>();
const supabasePersistChains = new Map<RunJobId, Promise<void>>();

function setJob(id: RunJobId, job: RunJob): void {
  jobs().set(id, job);
  persistJobLocal(id, job);
}

function queueSupabasePersist(id: RunJobId, db: JobDb): void {
  if (!db) return;
  const existing = supabasePersistTimers.get(id);
  if (existing) clearTimeout(existing);
  supabasePersistTimers.set(
    id,
    setTimeout(() => {
      supabasePersistTimers.delete(id);
      const prev = supabasePersistChains.get(id) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          const job = jobs().get(id);
          if (!job) return;
          await supabasePersistJob(db, id, job);
        });
      supabasePersistChains.set(id, next);
      void next.finally(() => {
        if (supabasePersistChains.get(id) === next) supabasePersistChains.delete(id);
      });
    }, SUPABASE_PERSIST_MS),
  );
}

function queuePersist(id: RunJobId, db: JobDb): void {
  queueSupabasePersist(id, db);
}

async function flushPersistChain(id: RunJobId, db: JobDb): Promise<void> {
  flushLogPersistTimer(id);
  const t = supabasePersistTimers.get(id);
  if (t) {
    clearTimeout(t);
    supabasePersistTimers.delete(id);
  }
  const job = jobs().get(id);
  if (!job) return;
  if (!db) return;
  const prev = supabasePersistChains.get(id) ?? Promise.resolve();
  await prev.catch(() => {});
  await supabasePersistJob(db, id, job);
  supabasePersistChains.delete(id);
}

type ActiveJobCtx = { jobId: RunJobId; db: JobDb };
const activeJob = new AsyncLocalStorage<ActiveJobCtx>();
const logPersistTimers = new Map<RunJobId, ReturnType<typeof setTimeout>>();

// AI : any ServerLogger emit inside withJobLogging() is mirrored into job.logs for the browser.
// AI : skip run-jobs — persist debug lines were re-appended and re-triggered Supabase upserts forever.
installJobLogSink((entry) => {
  if (entry.tag === "run-jobs") return;
  const ctx = activeJob.getStore();
  if (ctx) void appendJobLog(ctx.jobId, entry, ctx.db);
});

export function withJobLogging<T>(jobId: RunJobId, db: JobDb, fn: () => Promise<T>): Promise<T> {
  return activeJob.run({ jobId, db }, fn);
}

export type RunJobId = string & { __brand: "RunJobId" };

// AI : what /api/runs/[id]/progress serves — the Inference tab polls this while the
// AI : pipeline executes server-side after the POST /api/runs response was sent.
export interface RunJob {
  steps: StepProgress[]; // latest progress event per module, in pipeline order
  logs?: JobLogEntry[]; // streamed to browser via progress poll
  run?: PipelineRun; // set once the run finished (ok or error)
  error?: string; // set when runPipeline itself threw (e.g. invalid pipeline)
}

export type JobDb = SupabaseClient | null;

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

// AI : Vercel /tmp is per serverless instance — Supabase is the shared backend when configured.
function useSupabaseJobs(): boolean {
  return getSupabasePublicEnv() !== null;
}

export async function openJobDb(): Promise<JobDb> {
  if (!useSupabaseJobs()) return null;
  return createClient();
}

function supabaseErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

async function supabasePersistJob(db: SupabaseClient, id: RunJobId, job: RunJob): Promise<void> {
  const { error } = await db.from("run_jobs").upsert({ id, data: job, updated_at: Date.now() });
  if (error) throw new Error(`run_jobs upsert failed: ${supabaseErrorMessage(error)}`);
}

async function supabaseLoadJob(db: SupabaseClient, id: RunJobId): Promise<RunJob | undefined> {
  const { data, error } = await db.from("run_jobs").select("data").eq("id", id).maybeSingle();
  if (error) throw new Error(`run_jobs load failed: ${supabaseErrorMessage(error)}`);
  return data?.data as RunJob | undefined;
}

// AI : disk is source of truth locally — Next bundles route handlers separately in dev and
// AI : after() can land on a different globalThis than POST / progress GET.
function persistJobLocal(id: RunJobId, job: RunJob): void {
  mkdirSync(jobsDir(), { recursive: true });
  writeFileSync(jobPath(id), JSON.stringify(job), "utf8");
  jobs().set(id, job);
}

function loadJobLocal(id: RunJobId): RunJob | undefined {
  const cached = jobs().get(id);
  if (cached) return cached;
  const path = jobPath(id);
  if (!existsSync(path)) return undefined;
  const job = JSON.parse(readFileSync(path, "utf8")) as RunJob;
  jobs().set(id, job);
  return job;
}

function flushLogPersistTimer(id: RunJobId): void {
  const t = logPersistTimers.get(id);
  if (t) {
    clearTimeout(t);
    logPersistTimers.delete(id);
  }
}

async function appendJobLog(id: RunJobId, entry: JobLogEntry, db: JobDb): Promise<void> {
  let job = jobs().get(id);
  if (!job) job = await loadJob(id, db);
  if (!job) return;
  job.logs ??= [];
  job.logs.push(entry);
  if (job.logs.length > MAX_JOB_LOGS) job.logs.splice(0, job.logs.length - MAX_JOB_LOGS);
  setJob(id, job);

  // AI : terminal jobs were already flushed — don't schedule more Supabase upserts from stray logs.
  if (job.run || job.error) return;

  flushLogPersistTimer(id);
  logPersistTimers.set(
    id,
    setTimeout(() => {
      logPersistTimers.delete(id);
      queuePersist(id, db);
    }, LOG_PERSIST_MS),
  );
}

async function loadJob(id: RunJobId, db: JobDb): Promise<RunJob | undefined> {
  const cached = jobs().get(id);
  if (cached) return cached;
  const onDisk = loadJobLocal(id);
  if (onDisk) return onDisk;
  if (!db) return undefined;
  const job = await supabaseLoadJob(db, id);
  if (job) setJob(id, job);
  return job;
}

export async function createJob(db: JobDb): Promise<RunJobId> {
  const id = ("job_" + Math.random().toString(36).slice(2, 9)) as RunJobId;
  jobLog.info(`createJob`, { jobId: id, backend: db ? "supabase" : "local" });
  const job: RunJob = { steps: [], logs: [] };
  setJob(id, job);
  await flushPersistChain(id, db);
  return id;
}

export async function jobProgress(id: RunJobId, p: StepProgress, db: JobDb): Promise<void> {
  // AI : never reload from Supabase mid-run — a stale remote row would rewind in-memory progress.
  let job = jobs().get(id) ?? loadJobLocal(id);
  if (!job) job = await loadJob(id, db);
  if (!job) {
    jobLog.warn(`jobProgress — job not found`, { jobId: id, moduleId: p.moduleId });
    return;
  }
  jobLog.info(`jobProgress`, {
    jobId: id,
    moduleId: p.moduleId,
    label: p.label,
    status: p.status,
    index: p.index,
    total: p.total,
  });
  const i = job.steps.findIndex((s) => s.moduleId === p.moduleId);
  if (i === -1) job.steps.push(p);
  else job.steps[i] = p;
  setJob(id, job);
  queuePersist(id, db);
}

export async function finishJob(
  id: RunJobId,
  outcome: { run?: PipelineRun; error?: string },
  db: JobDb,
): Promise<void> {
  const job = await loadJob(id, db);
  if (!job) {
    jobLog.warn(`finishJob — job not found`, { jobId: id });
    return;
  }
  jobLog.info(`finishJob`, {
    jobId: id,
    runId: outcome.run?.id,
    runStatus: outcome.run?.status,
    error: outcome.error,
    totalMs: outcome.run?.totalMs,
    billedCents: outcome.run?.billedCents,
  });
  Object.assign(job, outcome);
  setJob(id, job);
  await flushPersistChain(id, db);
}

export async function getJob(id: RunJobId, db: JobDb): Promise<RunJob | undefined> {
  const job = await loadJob(id, db);
  jobLog.debug(`getJob`, { jobId: id, found: !!job, stepCount: job?.steps.length, done: !!(job?.run || job?.error) });
  return job;
}

// AI : extra context for progress 404s — helps distinguish cold-start races from lost jobs.
export async function jobMissingDetail(id: RunJobId, db: JobDb): Promise<string> {
  if (db) {
    try {
      const job = await supabaseLoadJob(db, id);
      if (job) return "job exists in Supabase but failed to load from cache";
      return "no run_jobs row in Supabase — POST /api/runs may not have created this job (check run_jobs table exists)";
    } catch (err) {
      return `Supabase run_jobs lookup failed: ${supabaseErrorMessage(err)}`;
    }
  }
  const path = jobPath(id);
  const onDisk = existsSync(path);
  const inMemory = jobs().has(id);
  if (onDisk) return `job file exists at ${path} but could not be loaded`;
  if (inMemory) return "job is in server memory but failed to load from cache";
  return `no job file at ${path} — POST /api/runs may not have created this job, or the server restarted and cleared ${jobsDir()}`;
}

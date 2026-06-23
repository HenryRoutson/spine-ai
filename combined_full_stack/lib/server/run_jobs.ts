import { uid } from "@/lib/id";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { dataDir } from "./config";
import { installJobLogSink, type JobLogEntry } from "./job_log_sink";
import type { RunJob as RunJobBase, RunJobId, StepProgress } from "@/lib/run-types";
import type { RunCheckpoint } from "./run_checkpoint";
import type { user_id_string } from "./require_auth";
import { logger } from "./server_logger";
import type { PipelineRun, RunId } from "./types";

const jobLog = logger("run-jobs");

export type { JobLogEntry, RunJobId };

// AI : server-only fields layered on the client-safe RunJob DTO.
export interface RunJob extends RunJobBase {
  paused?: RunCheckpoint;
}

const MAX_JOB_LOGS = 400;
const LOG_PERSIST_MS = 300;
const SUPABASE_PERSIST_MS = 200;

// AI : pipeline steps must not await Supabase — disk is sync + shared across Next dev bundles.
const supabasePersistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const supabasePersistChains = new Map<string, Promise<void>>();

function cacheKey(ownerId: JobOwnerId, id: RunJobId): string {
  return `${ownerId}:${id}`;
}

function setJob(ownerId: JobOwnerId, id: RunJobId, job: RunJob): void {
  jobs().set(cacheKey(ownerId, id), job);
  persistJobLocal(ownerId, id, job);
}

function queueSupabasePersist(ownerId: JobOwnerId, id: RunJobId, db: JobDb): void {
  if (!db) return;
  const key = cacheKey(ownerId, id);
  const existing = supabasePersistTimers.get(key);
  if (existing) clearTimeout(existing);
  supabasePersistTimers.set(
    key,
    setTimeout(() => {
      supabasePersistTimers.delete(key);
      const prev = supabasePersistChains.get(key) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          const job = jobs().get(key);
          if (!job) return;
          await supabasePersistJob(db, id, job);
        });
      supabasePersistChains.set(key, next);
      void next.finally(() => {
        if (supabasePersistChains.get(key) === next) supabasePersistChains.delete(key);
      });
    }, SUPABASE_PERSIST_MS),
  );
}

function queuePersist(ownerId: JobOwnerId, id: RunJobId, db: JobDb): void {
  queueSupabasePersist(ownerId, id, db);
}

async function flushPersistChain(ownerId: JobOwnerId, id: RunJobId, db: JobDb): Promise<void> {
  const key = cacheKey(ownerId, id);
  flushLogPersistTimer(key);
  const t = supabasePersistTimers.get(key);
  if (t) {
    clearTimeout(t);
    supabasePersistTimers.delete(key);
  }
  const job = jobs().get(key);
  if (!job) return;
  if (!db) return;
  const prev = supabasePersistChains.get(key) ?? Promise.resolve();
  await prev.catch(() => {});
  await supabasePersistJob(db, id, job);
  supabasePersistChains.delete(key);
}

type ActiveJobCtx = { ownerId: JobOwnerId; jobId: RunJobId; db: JobDb };
const activeJob = new AsyncLocalStorage<ActiveJobCtx>();
const logPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();

// AI : any ServerLogger emit inside withJobLogging() is mirrored into job.logs for the browser.
// AI : skip run-jobs — persist debug lines were re-appended and re-triggered Supabase upserts forever.
installJobLogSink((entry) => {
  if (entry.tag === "run-jobs") return;
  const ctx = activeJob.getStore();
  if (ctx) void appendJobLog(ctx.ownerId, ctx.jobId, entry, ctx.db);
});

export function withJobLogging<T>(
  ownerId: JobOwnerId,
  jobId: RunJobId,
  db: JobDb,
  fn: () => Promise<T>,
): Promise<T> {
  return activeJob.run({ ownerId, jobId, db }, fn);
}

export type JobOwnerId = user_id_string;

// AI : progress poll payload — never includes paused.ctx (sourceText, outputs, etc.).
export type RunJobProgress = Omit<RunJob, "paused">;

export function toProgressResponse(job: RunJob): RunJobProgress {
  const { paused: _paused, ...safe } = job;
  return safe;
}

export type JobDb = SupabaseClient | null;

type JobsSlot = { __forgeRunJobs?: Map<string, RunJob> };

function jobs(): Map<string, RunJob> {
  const g = globalThis as JobsSlot;
  g.__forgeRunJobs ??= new Map();
  return g.__forgeRunJobs;
}

function jobsDir(ownerId: JobOwnerId): string {
  return join(dataDir(), "jobs", ownerId);
}

function jobPath(ownerId: JobOwnerId, id: RunJobId): string {
  return join(jobsDir(ownerId), `${id}.json`);
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
function persistJobLocal(ownerId: JobOwnerId, id: RunJobId, job: RunJob): void {
  mkdirSync(jobsDir(ownerId), { recursive: true });
  writeFileSync(jobPath(ownerId, id), JSON.stringify(job), "utf8");
  jobs().set(cacheKey(ownerId, id), job);
}

function loadJobLocal(ownerId: JobOwnerId, id: RunJobId): RunJob | undefined {
  const key = cacheKey(ownerId, id);
  const cached = jobs().get(key);
  if (cached) return cached;
  const path = jobPath(ownerId, id);
  if (!existsSync(path)) return undefined;
  const job = JSON.parse(readFileSync(path, "utf8")) as RunJob;
  jobs().set(key, job);
  return job;
}

function flushLogPersistTimer(key: string): void {
  const t = logPersistTimers.get(key);
  if (t) {
    clearTimeout(t);
    logPersistTimers.delete(key);
  }
}

async function appendJobLog(
  ownerId: JobOwnerId,
  id: RunJobId,
  entry: JobLogEntry,
  db: JobDb,
): Promise<void> {
  const key = cacheKey(ownerId, id);
  let job = jobs().get(key);
  if (!job) job = await loadJob(ownerId, id, db);
  if (!job) return;
  job.logs ??= [];
  job.logs.push(entry);
  if (job.logs.length > MAX_JOB_LOGS) job.logs.splice(0, job.logs.length - MAX_JOB_LOGS);
  setJob(ownerId, id, job);

  // AI : terminal jobs were already flushed — don't schedule more Supabase upserts from stray logs.
  if (job.run || job.error) return;

  flushLogPersistTimer(key);
  logPersistTimers.set(
    key,
    setTimeout(() => {
      logPersistTimers.delete(key);
      queuePersist(ownerId, id, db);
    }, LOG_PERSIST_MS),
  );
}

async function loadJob(ownerId: JobOwnerId, id: RunJobId, db: JobDb): Promise<RunJob | undefined> {
  const key = cacheKey(ownerId, id);
  const cached = jobs().get(key);
  if (cached) return cached;
  const onDisk = loadJobLocal(ownerId, id);
  if (onDisk) return onDisk;
  if (!db) return undefined;
  const job = await supabaseLoadJob(db, id);
  if (job) setJob(ownerId, id, job);
  return job;
}

export async function pauseJob(
  ownerId: JobOwnerId,
  id: RunJobId,
  checkpoint: RunCheckpoint,
  db: JobDb,
): Promise<void> {
  const job = (await loadJob(ownerId, id, db)) ?? { steps: [], logs: [] };
  job.paused = checkpoint;
  job.clientStep = checkpoint.clientStep;
  setJob(ownerId, id, job);
  await flushPersistChain(ownerId, id, db);
  jobLog.info(`pauseJob`, { jobId: id, ownerId, moduleId: checkpoint.clientStep.moduleId });
}

export async function clearJobPause(ownerId: JobOwnerId, id: RunJobId, db: JobDb): Promise<void> {
  const job = await loadJob(ownerId, id, db);
  if (!job) return;
  delete job.paused;
  delete job.clientStep;
  setJob(ownerId, id, job);
  await flushPersistChain(ownerId, id, db);
}

// AI : atomically claim a paused job for resume — clears paused in-memory before after() runs.
export async function claimJobResume(
  ownerId: JobOwnerId,
  id: RunJobId,
  db: JobDb,
): Promise<RunCheckpoint | undefined> {
  const key = cacheKey(ownerId, id);
  let job = jobs().get(key) ?? loadJobLocal(ownerId, id);
  if (!job) job = await loadJob(ownerId, id, db);
  if (!job?.paused) return undefined;

  const checkpoint = job.paused;
  delete job.paused;
  delete job.clientStep;
  setJob(ownerId, id, job);
  await flushPersistChain(ownerId, id, db);
  jobLog.info(`claimJobResume`, { jobId: id, ownerId, moduleId: checkpoint.clientStep.moduleId });
  return checkpoint;
}

export async function createJob(ownerId: JobOwnerId, db: JobDb): Promise<RunJobId> {
  const id = uid<RunJobId>("job_");
  jobLog.info(`createJob`, { jobId: id, ownerId, backend: db ? "supabase" : "local" });
  const job: RunJob = { steps: [], logs: [] };
  setJob(ownerId, id, job);
  await flushPersistChain(ownerId, id, db);
  return id;
}

export async function jobProgress(
  ownerId: JobOwnerId,
  id: RunJobId,
  p: StepProgress,
  db: JobDb,
): Promise<void> {
  // AI : never reload from Supabase mid-run — a stale remote row would rewind in-memory progress.
  let job = jobs().get(cacheKey(ownerId, id)) ?? loadJobLocal(ownerId, id);
  if (!job) job = await loadJob(ownerId, id, db);
  if (!job) {
    jobLog.warn(`jobProgress — job not found`, { jobId: id, ownerId, moduleId: p.moduleId });
    return;
  }
  jobLog.info(`jobProgress`, {
    jobId: id,
    ownerId,
    moduleId: p.moduleId,
    label: p.label,
    status: p.status,
    index: p.index,
    total: p.total,
  });
  const i = job.steps.findIndex((s) => s.moduleId === p.moduleId);
  if (i === -1) job.steps.push(p);
  else job.steps[i] = p;
  setJob(ownerId, id, job);
  queuePersist(ownerId, id, db);
}

export async function finishJob(
  ownerId: JobOwnerId,
  id: RunJobId,
  outcome: { run?: PipelineRun; error?: string; deduped?: boolean; cachedRunId?: RunId },
  db: JobDb,
): Promise<void> {
  const job = await loadJob(ownerId, id, db);
  if (!job) {
    jobLog.warn(`finishJob — job not found`, { jobId: id, ownerId });
    return;
  }
  jobLog.info(`finishJob`, {
    jobId: id,
    ownerId,
    runId: outcome.run?.id,
    runStatus: outcome.run?.status,
    error: outcome.error,
    totalMs: outcome.run?.totalMs,
    billedCents: outcome.run?.billedCents,
  });
  Object.assign(job, outcome);
  setJob(ownerId, id, job);
  await flushPersistChain(ownerId, id, db);
}

export async function getJob(
  ownerId: JobOwnerId,
  id: RunJobId,
  db: JobDb,
): Promise<RunJob | undefined> {
  const job = await loadJob(ownerId, id, db);
  jobLog.debug(`getJob`, {
    jobId: id,
    ownerId,
    found: !!job,
    stepCount: job?.steps.length,
    done: !!(job?.run || job?.error),
  });
  return job;
}

// AI : extra context for progress 404s — helps distinguish cold-start races from lost jobs.
export async function jobMissingDetail(
  ownerId: JobOwnerId,
  id: RunJobId,
  db: JobDb,
): Promise<string> {
  if (db) {
    try {
      const job = await supabaseLoadJob(db, id);
      if (job) return "job exists in Supabase but failed to load from cache";
      return "no run_jobs row in Supabase — POST /api/runs may not have created this job (check run_jobs table exists)";
    } catch (err) {
      return `Supabase run_jobs lookup failed: ${supabaseErrorMessage(err)}`;
    }
  }
  const path = jobPath(ownerId, id);
  const onDisk = existsSync(path);
  const inMemory = jobs().has(cacheKey(ownerId, id));
  if (onDisk) return `job file exists at ${path} but could not be loaded`;
  if (inMemory) return "job is in server memory but failed to load from cache";
  return `no job file at ${path} — POST /api/runs may not have created this job, or the server restarted and cleared ${jobsDir(ownerId)}`;
}

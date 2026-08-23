// AI : pipeline cron CRUD — Supabase is source of truth so confidential/self-hosted deploys can fire via pg_cron.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uid } from "@/lib/id";
import { isValidCronExpr, isValidIanaTimeZone, nextCronFireAt } from "@/lib/cron-expr";
import type { cron_expr_string, iana_timezone_string } from "@/lib/cron-expr";
import type {
  PipelineScheduleRecord,
  PipelineScheduleRuntime,
  ScheduleDefaultDoc,
} from "@/lib/schedule-types";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { getSiteUrl } from "@/utils/supabase/site_url";
import { dataDir } from "./config";
import { createAdminClient } from "./supabase_admin";
import { isMissingSchemaError } from "./supabase_store";
import type { user_id_string } from "./require_auth";
import type { ModelId, PipelineScheduleId, ProjectId } from "./types";
import { logger } from "./server_logger";

const scheduleLog = logger("pipeline-schedules");
const SCHEDULE_PREFIX = "cron_";
const CLAIM_STALE_MS = 5 * 60_000;
const MAX_CLAIM_BATCH = 10;

export class ScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type StoredSchedule = PipelineScheduleRecord & {
  ownerId: user_id_string;
  revoked: boolean;
};

type StoredRuntime = {
  tickUrl: string | null;
  tickSecret: string | null;
  lastTickAt?: number;
  cronJobReady: boolean;
};

function isServerless(): boolean {
  return !!process.env.VERCEL;
}

async function supabaseForSchedules(): Promise<SupabaseClient | null> {
  return createAdminClient();
}

function schedulesDir(): string {
  return join(dataDir(), "pipeline_schedules");
}

function scheduleFile(id: PipelineScheduleId): string {
  return join(schedulesDir(), `${id}.json`);
}

function runtimeFile(): string {
  return join(dataDir(), "pipeline_schedule_runtime.json");
}

export function newPipelineScheduleId(): PipelineScheduleId {
  return uid<PipelineScheduleId>(SCHEDULE_PREFIX);
}

function toPublicRecord(row: StoredSchedule): PipelineScheduleRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    enabled: row.enabled,
    defaultModel: row.defaultModel,
    defaultDocs: row.defaultDocs,
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    lastClaimedAt: row.lastClaimedAt,
    lastError: row.lastError,
    runCount: row.runCount,
    createdAt: row.createdAt,
  };
}

function rowFromDb(row: Record<string, unknown>): StoredSchedule {
  return {
    id: row.id as PipelineScheduleId,
    ownerId: row.owner_id as user_id_string,
    projectId: row.project_id as ProjectId,
    name: String(row.name),
    cron: String(row.cron) as cron_expr_string,
    timezone: String(row.timezone ?? "UTC") as iana_timezone_string,
    enabled: row.enabled !== false,
    revoked: row.revoked === true,
    defaultModel: (row.default_model as ModelId | null) ?? undefined,
    defaultDocs: (row.default_docs as ScheduleDefaultDoc[]) ?? [],
    nextRunAt: Number(row.next_run_at),
    lastRunAt: row.last_run_at != null ? Number(row.last_run_at) : undefined,
    lastClaimedAt: row.last_claimed_at != null ? Number(row.last_claimed_at) : undefined,
    lastError: (row.last_error as string | null) ?? undefined,
    runCount: Number(row.run_count ?? 0),
    createdAt: Number(row.created_at),
  };
}

function toDbRow(row: StoredSchedule): Record<string, unknown> {
  return {
    id: row.id,
    owner_id: row.ownerId,
    project_id: row.projectId,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    enabled: row.enabled,
    revoked: row.revoked,
    default_model: row.defaultModel ?? null,
    default_docs: row.defaultDocs,
    next_run_at: row.nextRunAt,
    last_run_at: row.lastRunAt ?? null,
    last_claimed_at: row.lastClaimedAt ?? null,
    last_error: row.lastError ?? null,
    run_count: row.runCount,
    created_at: row.createdAt,
  };
}

function saveLocalSchedule(row: StoredSchedule): void {
  mkdirSync(schedulesDir(), { recursive: true });
  writeFileSync(scheduleFile(row.id), JSON.stringify(row), "utf8");
}

function loadLocalSchedule(id: PipelineScheduleId): StoredSchedule | null {
  const path = scheduleFile(id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as StoredSchedule;
}

function listLocalSchedulesForOwner(ownerId: user_id_string, projectId?: ProjectId): StoredSchedule[] {
  if (!existsSync(schedulesDir())) return [];
  return readdirSync(schedulesDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadLocalSchedule(f.replace(".json", "") as PipelineScheduleId))
    .filter((r): r is StoredSchedule => r != null && r.ownerId === ownerId && !r.revoked)
    .filter((r) => (projectId ? r.projectId === projectId : true));
}

function loadLocalRuntime(): StoredRuntime {
  if (!existsSync(runtimeFile())) {
    return { tickUrl: null, tickSecret: null, cronJobReady: false };
  }
  return JSON.parse(readFileSync(runtimeFile(), "utf8")) as StoredRuntime;
}

function saveLocalRuntime(row: StoredRuntime): void {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(runtimeFile(), JSON.stringify(row), "utf8");
}

function newTickSecret(): string {
  return `cron_${randomBytes(24).toString("base64url")}`;
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function assertScheduleSpec(input: {
  name: string;
  cron: string;
  timezone: string;
}): { name: string; cron: cron_expr_string; timezone: iana_timezone_string } {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new ScheduleValidationError("Name must be 1–80 characters");
  if (!isValidCronExpr(input.cron)) {
    throw new ScheduleValidationError("Cron must be 5 fields, like */15 * * * *");
  }
  if (!isValidIanaTimeZone(input.timezone)) {
    throw new ScheduleValidationError("Timezone must be an IANA name, like UTC or Australia/Sydney");
  }
  const nextRunAt = nextCronFireAt(input.cron, input.timezone);
  if (nextRunAt == null) throw new ScheduleValidationError("Cron expression never fires");
  return {
    name,
    cron: input.cron.trim() as cron_expr_string,
    timezone: input.timezone.trim() as iana_timezone_string,
  };
}

// AI : after the migration lands, copy disk fallback rows into Supabase so pg_cron can claim them.
async function promoteLocalSchedules(db: SupabaseClient): Promise<void> {
  if (isServerless() || !existsSync(schedulesDir())) return;
  for (const file of readdirSync(schedulesDir()).filter((f) => f.endsWith(".json"))) {
    const row = loadLocalSchedule(file.replace(".json", "") as PipelineScheduleId);
    if (!row || row.revoked) continue;
    const { error } = await db.from("pipeline_schedules").upsert(toDbRow(row));
    if (error) {
      if (!isMissingSchemaError(error)) {
        scheduleLog.warn(`local→supabase promote skipped`, { id: row.id, error: error.message });
      }
      return;
    }
  }
  const localRuntime = existsSync(runtimeFile()) ? loadLocalRuntime() : null;
  if (!localRuntime?.tickSecret) return;
  const { data: remoteRuntime, error: remoteError } = await db
    .from("pipeline_schedule_runtime")
    .select("tick_secret, cron_job_ready")
    .eq("id", 1)
    .maybeSingle();
  if (remoteError && !isMissingSchemaError(remoteError)) {
    scheduleLog.warn(`runtime promote skipped`, { error: remoteError.message });
    return;
  }
  if (remoteRuntime?.tick_secret) return;
  const { error } = await db.from("pipeline_schedule_runtime").upsert({
    id: 1,
    tick_url: localRuntime.tickUrl,
    tick_secret: localRuntime.tickSecret,
    last_tick_at: localRuntime.lastTickAt ?? null,
    cron_job_ready: localRuntime.cronJobReady,
  });
  if (error && !isMissingSchemaError(error)) {
    scheduleLog.warn(`runtime promote skipped`, { error: error.message });
  }
}

export async function listSchedulesForOwner(
  ownerId: user_id_string,
  projectId?: ProjectId,
): Promise<PipelineScheduleRecord[]> {
  const db = await supabaseForSchedules();
  if (!db) return listLocalSchedulesForOwner(ownerId, projectId).map(toPublicRecord);
  await promoteLocalSchedules(db);
  let q = db.from("pipeline_schedules").select("*").eq("owner_id", ownerId).eq("revoked", false);
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) return listLocalSchedulesForOwner(ownerId, projectId).map(toPublicRecord);
    throw error;
  }
  return (data ?? []).map((row) => toPublicRecord(rowFromDb(row as Record<string, unknown>)));
}

export async function getSchedule(
  ownerId: user_id_string,
  id: PipelineScheduleId,
): Promise<StoredSchedule | null> {
  const db = await supabaseForSchedules();
  if (!db) {
    const row = loadLocalSchedule(id);
    if (!row || row.ownerId !== ownerId || row.revoked) return null;
    return row;
  }
  const { data, error } = await db
    .from("pipeline_schedules")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) {
      const row = loadLocalSchedule(id);
      if (!row || row.ownerId !== ownerId || row.revoked) return null;
      return row;
    }
    throw error;
  }
  if (!data) return null;
  const row = rowFromDb(data as Record<string, unknown>);
  return row.revoked ? null : row;
}

export type CreateScheduleInput = {
  ownerId: user_id_string;
  projectId: ProjectId;
  name: string;
  cron: string;
  timezone: string;
  defaultModel?: ModelId;
  defaultDocs: ScheduleDefaultDoc[];
  enabled?: boolean;
  tickUrl?: string;
};

export async function createSchedule(input: CreateScheduleInput): Promise<PipelineScheduleRecord> {
  const spec = assertScheduleSpec(input);
  const nextRunAt = nextCronFireAt(spec.cron, spec.timezone);
  if (nextRunAt == null) throw new ScheduleValidationError("Cron expression never fires");
  const row: StoredSchedule = {
    id: newPipelineScheduleId(),
    ownerId: input.ownerId,
    projectId: input.projectId,
    name: spec.name,
    cron: spec.cron,
    timezone: spec.timezone,
    enabled: input.enabled !== false,
    revoked: false,
    defaultModel: input.defaultModel,
    defaultDocs: input.defaultDocs,
    nextRunAt,
    runCount: 0,
    createdAt: Date.now(),
  };
  await persistSchedule(row);
  await ensureScheduleRuntime(input.tickUrl);
  return toPublicRecord(row);
}

export type PatchScheduleInput = {
  name?: string;
  cron?: string;
  timezone?: string;
  enabled?: boolean;
  defaultModel?: ModelId | null;
  defaultDocs?: ScheduleDefaultDoc[];
};

export async function patchSchedule(
  ownerId: user_id_string,
  id: PipelineScheduleId,
  patch: PatchScheduleInput,
): Promise<PipelineScheduleRecord | null> {
  const existing = await getSchedule(ownerId, id);
  if (!existing) return null;
  const name = patch.name ?? existing.name;
  const cron = patch.cron ?? existing.cron;
  const timezone = patch.timezone ?? existing.timezone;
  const spec = assertScheduleSpec({ name, cron, timezone });
  const cronChanged = spec.cron !== existing.cron || spec.timezone !== existing.timezone;
  const nextRunAt = cronChanged
    ? (nextCronFireAt(spec.cron, spec.timezone) ?? existing.nextRunAt)
    : existing.nextRunAt;
  const row: StoredSchedule = {
    ...existing,
    name: spec.name,
    cron: spec.cron,
    timezone: spec.timezone,
    enabled: patch.enabled ?? existing.enabled,
    defaultModel: patch.defaultModel === null ? undefined : (patch.defaultModel ?? existing.defaultModel),
    defaultDocs: patch.defaultDocs ?? existing.defaultDocs,
    nextRunAt,
    lastError: cronChanged ? undefined : existing.lastError,
  };
  await persistSchedule(row);
  return toPublicRecord(row);
}

export async function revokeSchedule(ownerId: user_id_string, id: PipelineScheduleId): Promise<boolean> {
  const existing = await getSchedule(ownerId, id);
  if (!existing) return false;
  await persistSchedule({ ...existing, revoked: true, enabled: false });
  return true;
}

async function persistSchedule(row: StoredSchedule): Promise<void> {
  if (!isServerless()) saveLocalSchedule(row);
  const db = await supabaseForSchedules();
  if (!db) {
    if (isServerless() || getSupabasePublicEnv()) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY required to save pipeline schedules");
    }
    saveLocalSchedule(row);
    return;
  }
  const { error } = await db.from("pipeline_schedules").upsert(toDbRow(row));
  if (error) {
    if (isServerless() || !isMissingSchemaError(error)) {
      throw new Error(`schedule persistence failed: ${error.message}`);
    }
    scheduleLog.warn(`supabase upsert failed — saved locally`, { error: error.message });
    saveLocalSchedule(row);
  }
}

export async function getScheduleRuntime(): Promise<PipelineScheduleRuntime> {
  const stored = await loadRuntime();
  return {
    tickUrl: stored.tickUrl,
    tickConfigured: Boolean(stored.tickUrl && stored.tickSecret),
    cronJobReady: stored.cronJobReady,
    lastTickAt: stored.lastTickAt,
  };
}

async function loadRuntime(): Promise<StoredRuntime> {
  const db = await supabaseForSchedules();
  if (!db) return loadLocalRuntime();
  const { data, error } = await db.from("pipeline_schedule_runtime").select("*").eq("id", 1).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return loadLocalRuntime();
    throw error;
  }
  if (!data) return loadLocalRuntime();
  return {
    tickUrl: (data.tick_url as string | null) ?? null,
    tickSecret: (data.tick_secret as string | null) ?? null,
    lastTickAt: data.last_tick_at != null ? Number(data.last_tick_at) : undefined,
    cronJobReady: data.cron_job_ready === true,
  };
}

async function saveRuntime(row: StoredRuntime): Promise<void> {
  if (!isServerless()) saveLocalRuntime(row);
  const db = await supabaseForSchedules();
  if (!db) {
    saveLocalRuntime(row);
    return;
  }
  const { error } = await db.from("pipeline_schedule_runtime").upsert({
    id: 1,
    tick_url: row.tickUrl,
    tick_secret: row.tickSecret,
    last_tick_at: row.lastTickAt ?? null,
    cron_job_ready: row.cronJobReady,
  });
  if (error && !isMissingSchemaError(error)) throw error;
}

function normalizeTickUrl(raw?: string): string {
  const site = getSiteUrl().replace(/\/$/, "");
  const fallback = `${site}/api/schedules/tick`;
  let value = (raw ?? fallback).trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new ScheduleValidationError("Tick URL must start with http:// or https://");
  }
  value = value.replace(/\/$/, "");
  if (!value.endsWith("/api/schedules/tick")) value = `${value}/api/schedules/tick`;
  return value;
}

export async function ensureScheduleRuntime(tickUrl?: string): Promise<PipelineScheduleRuntime> {
  const existing = await loadRuntime();
  const next: StoredRuntime = {
    ...existing,
    tickUrl: tickUrl ? normalizeTickUrl(tickUrl) : (existing.tickUrl ?? normalizeTickUrl()),
    tickSecret: existing.tickSecret || newTickSecret(),
  };
  await saveRuntime(next);
  const db = await supabaseForSchedules();
  if (db) {
    const { error } = await db.rpc("ensure_pipeline_schedule_tick_job");
    if (error) {
      scheduleLog.warn(`pg_cron ensure skipped`, { error: error.message });
    } else {
      next.cronJobReady = true;
      await saveRuntime(next);
    }
  }
  return getScheduleRuntime();
}

export async function verifyTickSecret(secret: string): Promise<boolean> {
  const runtime = await loadRuntime();
  if (!runtime.tickSecret) return false;
  return secretsEqual(secret, runtime.tickSecret);
}

export async function markRuntimeTicked(): Promise<void> {
  const runtime = await loadRuntime();
  await saveRuntime({ ...runtime, lastTickAt: Date.now() });
}

export type ClaimedSchedule = StoredSchedule;

function claimDueSchedulesLocal(now: number, staleBefore: number): ClaimedSchedule[] {
  const claimed: ClaimedSchedule[] = [];
  if (!existsSync(schedulesDir())) return claimed;
  const rows = readdirSync(schedulesDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadLocalSchedule(f.replace(".json", "") as PipelineScheduleId))
    .filter((r): r is StoredSchedule => r != null && r.enabled && !r.revoked && r.nextRunAt <= now)
    .filter((r) => r.lastClaimedAt == null || r.lastClaimedAt < staleBefore)
    .slice(0, MAX_CLAIM_BATCH);
  for (const row of rows) {
    const next = { ...row, lastClaimedAt: now };
    saveLocalSchedule(next);
    claimed.push(next);
  }
  return claimed;
}

export async function claimDueSchedules(now = Date.now()): Promise<ClaimedSchedule[]> {
  const db = await supabaseForSchedules();
  const staleBefore = now - CLAIM_STALE_MS;
  if (!db) return claimDueSchedulesLocal(now, staleBefore);
  await promoteLocalSchedules(db);
  const { data, error } = await db
    .from("pipeline_schedules")
    .select("*")
    .eq("enabled", true)
    .eq("revoked", false)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(MAX_CLAIM_BATCH);
  if (error) {
    if (isMissingSchemaError(error)) {
      return claimDueSchedulesLocal(now, staleBefore);
    }
    throw error;
  }
  const claimed: ClaimedSchedule[] = [];
  for (const raw of data ?? []) {
    const row = rowFromDb(raw as Record<string, unknown>);
    if (row.lastClaimedAt != null && row.lastClaimedAt >= staleBefore) continue;
    const next: StoredSchedule = { ...row, lastClaimedAt: now };
    const { data: updated, error: updateError } = await db
      .from("pipeline_schedules")
      .update({ last_claimed_at: now })
      .eq("owner_id", row.ownerId)
      .eq("id", row.id)
      .eq("next_run_at", row.nextRunAt)
      .select("id");
    if (updateError || !updated?.length) {
      scheduleLog.warn(`claim skipped`, { id: row.id, error: updateError?.message });
      continue;
    }
    claimed.push(next);
  }
  return claimed;
}

export async function markScheduleFired(
  row: StoredSchedule,
  result: { runAt: number; error?: string },
): Promise<void> {
  const nextRunAt = nextCronFireAt(row.cron, row.timezone, result.runAt) ?? row.nextRunAt + 60_000;
  await persistSchedule({
    ...row,
    lastRunAt: result.runAt,
    lastError: result.error,
    runCount: row.runCount + 1,
    nextRunAt,
  });
}

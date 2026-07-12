// AI : landing page demo — budget gate + Supabase call log for pipeline builds.

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LANDING_DEMO_MIN_BALANCE_CENTS,
  LANDING_DEMO_PREVIEW_CHARS,
  LANDING_DEMO_RESERVE_CENTS,
  LANDING_PAGE_BUDGET_CENTS,
  type landing_demo_tag,
} from "@/lib/landing_demo_config";
import { createAdminClient } from "@/lib/server/supabase_admin";
import { dataDir } from "@/lib/server/config";
import { logger } from "@/lib/server/server_logger";
import type { ModelId, ProjectId } from "@/lib/server/types";

const demoLog = logger("landing-demo");

export class LandingBudgetError extends Error {
  constructor(readonly code: "budget_exhausted" | "budget_unavailable") {
    super(code === "budget_exhausted" ? "Landing demo budget exhausted — try again later." : "Landing demo unavailable.");
    this.name = "LandingBudgetError";
  }
}

export type LandingDemoCallRow = {
  id: string;
  promptText: string;
  promptPreview: string;
  outputPreview: string | null;
  // AI : full denormalized diagnostic — reconstruct failing runs from DB alone.
  diagnosticText: string | null;
  diagnosticJson: Record<string, unknown> | null;
  tag: landing_demo_tag;
  buildId: ProjectId | null;
  projectName: string | null;
  model: ModelId;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  latencyMs: number | null;
  createdAt: string;
};

type LandingBudgetState = {
  budgetCents: number;
  spentCents: number;
  calls: LandingDemoCallRow[];
};

const LANDING_BUDGET_ID = "landing";

function previewText(text: string, max = LANDING_DEMO_PREVIEW_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function hashIp(ip: string): string {
  const salt = process.env.LANDING_DEMO_IP_SALT;
  if (process.env.VERCEL && !salt) {
    throw new Error("LANDING_DEMO_IP_SALT required on Vercel");
  }
  return createHash("sha256").update(`${salt ?? "landing-demo"}:${ip}`).digest("hex").slice(0, 16);
}

function localBudgetFile(): string {
  return join(dataDir(), "landing_page_demo.json");
}

function normalizeLocalCall(raw: Partial<LandingDemoCallRow> & Pick<LandingDemoCallRow, "id" | "costCents" | "createdAt">): LandingDemoCallRow {
  const promptText = raw.promptText ?? raw.promptPreview ?? "";
  return {
    id: raw.id,
    promptText,
    promptPreview: raw.promptPreview ?? previewText(promptText),
    outputPreview: raw.outputPreview ?? null,
    diagnosticText: raw.diagnosticText ?? null,
    diagnosticJson: raw.diagnosticJson ?? null,
    tag: raw.tag ?? "build-pipeline",
    buildId: raw.buildId ?? null,
    projectName: raw.projectName ?? null,
    model: raw.model ?? ("gpt-5-mini" as ModelId),
    promptTokens: raw.promptTokens ?? 0,
    completionTokens: raw.completionTokens ?? 0,
    costCents: raw.costCents,
    latencyMs: raw.latencyMs ?? null,
    createdAt: raw.createdAt,
  };
}

function readLocalBudget(): LandingBudgetState {
  const file = localBudgetFile();
  if (!existsSync(file)) {
    return { budgetCents: LANDING_PAGE_BUDGET_CENTS, spentCents: 0, calls: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as LandingBudgetState;
    return { ...parsed, calls: parsed.calls.map((c) => normalizeLocalCall(c)) };
  } catch {
    return { budgetCents: LANDING_PAGE_BUDGET_CENTS, spentCents: 0, calls: [] };
  }
}

function writeLocalBudget(state: LandingBudgetState): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(localBudgetFile(), JSON.stringify(state, null, 2));
}

async function readBudget(): Promise<{ budgetCents: number; spentCents: number; source: "supabase" | "local" }> {
  const admin = await createAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("landing_page_budget")
      .select("budget_cents, spent_cents")
      .eq("id", LANDING_BUDGET_ID)
      .maybeSingle();
    if (!error && data) {
      return {
        budgetCents: Number(data.budget_cents),
        spentCents: Number(data.spent_cents),
        source: "supabase",
      };
    }
    demoLog.warn("landing_page_budget read failed — falling back to local", { error: error?.message });
  }
  const local = readLocalBudget();
  return { budgetCents: local.budgetCents, spentCents: local.spentCents, source: "local" };
}

export { LANDING_DEMO_RESERVE_CENTS };

function reserveLocalLandingBudget(reserveCents: number): boolean {
  const state = readLocalBudget();
  if (state.spentCents + reserveCents > state.budgetCents) return false;
  state.spentCents += reserveCents;
  writeLocalBudget(state);
  return true;
}

function adjustLocalLandingBudget(deltaCents: number): void {
  const state = readLocalBudget();
  state.spentCents = Math.max(0, state.spentCents + deltaCents);
  writeLocalBudget(state);
}

async function adjustLandingBudgetSpent(deltaCents: number): Promise<void> {
  adjustLocalLandingBudget(deltaCents);
  const admin = await createAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("adjust_landing_budget_spent", { p_delta_cents: deltaCents });
  if (error) demoLog.warn("adjust_landing_budget_spent failed", { error: error.message });
}

export async function reserveLandingBudget(
  reserveCents = LANDING_DEMO_RESERVE_CENTS,
): Promise<void> {
  const reserve = +Math.max(0, reserveCents).toFixed(4);
  if (reserve <= 0) {
    await assertLandingBudget();
    return;
  }
  if (reserveLocalLandingBudget(reserve)) return;
  const admin = await createAdminClient();
  if (admin) {
    const { data, error } = await admin.rpc("try_reserve_landing_budget", { p_reserve_cents: reserve });
    if (!error && data) return;
    if (error) demoLog.warn("try_reserve_landing_budget failed", { error: error.message });
  }
  const { budgetCents, spentCents, source } = await readBudget();
  if (source === "supabase" && budgetCents <= 0) throw new LandingBudgetError("budget_unavailable");
  if (budgetCents - spentCents < LANDING_DEMO_MIN_BALANCE_CENTS) throw new LandingBudgetError("budget_exhausted");
  throw new LandingBudgetError("budget_exhausted");
}

export async function releaseLandingBudgetReservation(
  reserveCents = LANDING_DEMO_RESERVE_CENTS,
): Promise<void> {
  const reserve = +Math.max(0, reserveCents).toFixed(4);
  if (reserve <= 0) return;
  await adjustLandingBudgetSpent(-reserve);
}

export async function assertLandingBudget(): Promise<void> {
  const { budgetCents, spentCents, source } = await readBudget();
  const remaining = budgetCents - spentCents;
  if (source === "supabase" && budgetCents <= 0) throw new LandingBudgetError("budget_unavailable");
  if (remaining < LANDING_DEMO_MIN_BALANCE_CENTS) throw new LandingBudgetError("budget_exhausted");
}

async function recordCall(params: {
  prompt: string;
  outputPreview?: string;
  diagnosticText?: string;
  diagnosticJson?: Record<string, unknown>;
  tag: landing_demo_tag;
  buildId?: ProjectId;
  projectName?: string;
  model: ModelId;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  latencyMs: number;
  ip: string;
  budgetReserveCents?: number;
}): Promise<LandingDemoCallRow> {
  const promptText = params.prompt.trim();
  const row: LandingDemoCallRow = {
    id: randomUUID(),
    promptText,
    promptPreview: previewText(promptText),
    outputPreview: params.outputPreview ?? null,
    diagnosticText: params.diagnosticText ?? null,
    diagnosticJson: params.diagnosticJson ?? null,
    tag: params.tag,
    buildId: params.buildId ?? null,
    projectName: params.projectName ?? null,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    costCents: params.costCents,
    latencyMs: params.latencyMs,
    createdAt: new Date().toISOString(),
  };

  const admin = await createAdminClient();
  if (admin) {
    const { error: insertError } = await admin.from("landing_page_calls").insert({
      id: row.id,
      prompt_text: row.promptText,
      prompt_preview: row.promptPreview,
      output_preview: row.outputPreview,
      diagnostic_text: row.diagnosticText,
      diagnostic_json: row.diagnosticJson,
      tag: row.tag,
      build_id: row.buildId,
      project_name: row.projectName,
      model: row.model,
      prompt_tokens: row.promptTokens,
      completion_tokens: row.completionTokens,
      cost_cents: row.costCents,
      latency_ms: row.latencyMs,
      ip_hash: hashIp(params.ip),
    });
    if (insertError) demoLog.warn("landing_page_calls insert failed", { error: insertError.message });
    else {
      const reserve = params.budgetReserveCents ?? 0;
      if (reserve > 0) {
        await adjustLandingBudgetSpent(params.costCents - reserve);
      } else {
        await adjustLandingBudgetSpent(params.costCents);
      }
      return row;
    }
  }

  const local = readLocalBudget();
  const reserve = params.budgetReserveCents ?? 0;
  if (reserve > 0) {
    local.spentCents = Math.max(0, local.spentCents + params.costCents - reserve);
  } else {
    local.spentCents += params.costCents;
  }
  local.calls.unshift(row);
  local.calls = local.calls.slice(0, 200);
  writeLocalBudget(local);
  return row;
}

export async function recordLandingUsage(params: {
  prompt: string;
  outputPreview: string;
  diagnosticText?: string;
  diagnosticJson?: Record<string, unknown>;
  tag: landing_demo_tag;
  buildId?: ProjectId;
  projectName?: string;
  model: ModelId;
  costCents: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  ip: string;
  budgetReserveCents?: number;
}): Promise<LandingDemoCallRow> {
  return recordCall({
    prompt: params.prompt,
    outputPreview: params.outputPreview,
    diagnosticText: params.diagnosticText,
    diagnosticJson: params.diagnosticJson,
    tag: params.tag,
    buildId: params.buildId,
    projectName: params.projectName,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    costCents: params.costCents,
    latencyMs: params.latencyMs,
    ip: params.ip,
    budgetReserveCents: params.budgetReserveCents,
  });
}

export type LandingUsageProfile = {
  source: "supabase" | "local";
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  callCount: number;
  totalCostCents: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgCostPerCallCents: number;
  avgLatencyMs: number | null;
  byModel: Record<
    string,
    { calls: number; costCents: number; promptTokens: number; completionTokens: number }
  >;
  byDay: Array<{ day: string; calls: number; costCents: number }>;
  recentCalls: LandingDemoCallRow[];
};

function dayLabel(iso: string): string {
  return iso.slice(0, 10);
}

export function buildLandingUsageProfile(
  budgetCents: number,
  spentCents: number,
  calls: LandingDemoCallRow[],
  source: "supabase" | "local",
): LandingUsageProfile {
  const totalCostCents = calls.reduce((sum, c) => sum + c.costCents, 0);
  const totalPromptTokens = calls.reduce((sum, c) => sum + c.promptTokens, 0);
  const totalCompletionTokens = calls.reduce((sum, c) => sum + c.completionTokens, 0);
  const latencies = calls.map((c) => c.latencyMs).filter((ms): ms is number => ms != null);
  const byModel: LandingUsageProfile["byModel"] = {};
  const byDayMap = new Map<string, { calls: number; costCents: number }>();

  for (const call of calls) {
    const model = call.model;
    const bucket = byModel[model] ?? { calls: 0, costCents: 0, promptTokens: 0, completionTokens: 0 };
    bucket.calls += 1;
    bucket.costCents += call.costCents;
    bucket.promptTokens += call.promptTokens;
    bucket.completionTokens += call.completionTokens;
    byModel[model] = bucket;

    const day = dayLabel(call.createdAt);
    const dayBucket = byDayMap.get(day) ?? { calls: 0, costCents: 0 };
    dayBucket.calls += 1;
    dayBucket.costCents += call.costCents;
    byDayMap.set(day, dayBucket);
  }

  const callCount = calls.length;
  return {
    source,
    budgetCents,
    spentCents,
    remainingCents: budgetCents - spentCents,
    callCount,
    totalCostCents,
    totalPromptTokens,
    totalCompletionTokens,
    avgCostPerCallCents: callCount > 0 ? totalCostCents / callCount : 0,
    avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    byModel,
    byDay: [...byDayMap.entries()]
      .map(([day, stats]) => ({ day, ...stats }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    recentCalls: calls,
  };
}

export async function fetchLandingUsageProfile(opts?: {
  days?: number;
  limit?: number;
}): Promise<LandingUsageProfile> {
  const days = opts?.days ?? 30;
  const limit = opts?.limit ?? 50;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const admin = await createAdminClient();
  if (admin) {
    const budget = await readBudget();
    const { data, error } = await admin
      .from("landing_page_calls")
      .select(
        "id, prompt_text, prompt_preview, output_preview, diagnostic_text, diagnostic_json, tag, build_id, project_name, model, prompt_tokens, completion_tokens, cost_cents, latency_ms, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      const calls: LandingDemoCallRow[] = data.map((row) => ({
        id: row.id,
        promptText: row.prompt_text ?? row.prompt_preview,
        promptPreview: row.prompt_preview,
        outputPreview: row.output_preview,
        diagnosticText: row.diagnostic_text ?? null,
        diagnosticJson: (row.diagnostic_json as Record<string, unknown> | null) ?? null,
        tag: (row.tag ?? "build-pipeline") as landing_demo_tag,
        buildId: (row.build_id as ProjectId | null) ?? null,
        projectName: row.project_name ?? null,
        model: row.model as ModelId,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        costCents: Number(row.cost_cents),
        latencyMs: row.latency_ms,
        createdAt: row.created_at,
      }));
      return buildLandingUsageProfile(budget.budgetCents, budget.spentCents, calls, "supabase");
    }
    demoLog.warn("landing_page_calls read failed — falling back to local", { error: error?.message });
  }

  const local = readLocalBudget();
  const calls = local.calls.filter((c) => c.createdAt >= since).slice(0, limit);
  return buildLandingUsageProfile(local.budgetCents, local.spentCents, calls, "local");
}

export async function backfillLocalLandingUsageToSupabase(): Promise<{
  inserted: number;
  skipped: number;
  spentCents: number;
}> {
  const admin = await createAdminClient();
  if (!admin) throw new Error("Supabase admin client unavailable — set SUPABASE_SERVICE_ROLE_KEY");

  const local = readLocalBudget();
  let inserted = 0;
  let skipped = 0;

  for (const call of local.calls) {
    const { data: existing } = await admin.from("landing_page_calls").select("id").eq("id", call.id).maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await admin.from("landing_page_calls").insert({
      id: call.id,
      prompt_text: call.promptText,
      prompt_preview: call.promptPreview,
      output_preview: call.outputPreview,
      diagnostic_text: call.diagnosticText,
      diagnostic_json: call.diagnosticJson,
      tag: call.tag,
      build_id: call.buildId,
      project_name: call.projectName,
      model: call.model,
      prompt_tokens: call.promptTokens,
      completion_tokens: call.completionTokens,
      cost_cents: call.costCents,
      latency_ms: call.latencyMs,
      created_at: call.createdAt,
    });
    if (error) throw new Error(error.message);
    inserted += 1;
  }

  const { error: budgetError } = await admin
    .from("landing_page_budget")
    .update({
      budget_cents: local.budgetCents,
      spent_cents: local.spentCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", LANDING_BUDGET_ID);
  if (budgetError) throw new Error(budgetError.message);

  return { inserted, skipped, spentCents: local.spentCents };
}

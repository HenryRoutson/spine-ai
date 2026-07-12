import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { abtestBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { assertCanStartRun, billRunUsage } from "@/lib/server/billing_account";
import { billingKeyForProject } from "@/lib/server/team_billing";
import { teamProjectWriteError } from "@/lib/server/teams";
import { mergeBenchmarkStrategies, runBenchmark } from "@/lib/server/strategies";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import { logger } from "@/lib/server/server_logger";
import { DocLabel } from "@/lib/server/types";
import type { DocId, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:abtest");

// AI : real A/B benchmark (replaces the setTimeout jitter) — all enabled environments run
// AI : on the cheap model, the LLM judge scores them. Takes ~1-2 min; the client awaits.
// AI : TODO — per-step strategy comparison, statistical significance, and pipeline-step-level env pickers.
// AI : keep in sync with ROUTE_MAX_DURATION_RUNS in lib/server/route-config.ts.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { store, auth } = ctx;

  const parsed = await parseRequestJson(req, abtestBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { projectId, inputDocId } = parsed;
  apiLog.info(`POST /api/abtest`, { projectId, inputDocId });
  const project = store.project(projectId as ProjectId);
  if (!project) {
    apiLog.warn(`unknown project`, { projectId });
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND);
  }

  const writeErr = teamProjectWriteError(project);
  if (writeErr) return apiError(writeErr, HTTP.FORBIDDEN);

  // AI : default task input = the oldest inference doc (the seeded source document).
  const docId = inputDocId ?? [...store.docs()].reverse().find((d) => d.label === DocLabel.Inference)?.id;
  if (!docId) return apiError("no inference document in the store", 400);

  const billingKey = await billingKeyForProject(ctx.auth.userId, project);
  try {
    await assertCanStartRun(billingKey);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    throw err;
  }

  try {
    await ensureModelOptionsFresh();
    apiLog.info(`benchmark starting`, { projectId, docId });
    const result = await runBenchmark(project, store, docId as DocId);
    if (result.totalCostCents > 0) {
      try {
        await billRunUsage(billingKey, result.totalCostCents);
      } catch (billErr) {
        apiLog.warn(`benchmark billing failed`, { projectId, error: (billErr as Error).message });
      }
    }
    store.saveProject({ ...project, strategies: mergeBenchmarkStrategies(project, result.results) });
    await store.flush();
    apiLog.info(`benchmark complete`, { projectId, docId, totalCostCents: result.totalCostCents });
    return NextResponse.json(result);
  } catch (err) {
    apiLog.error(`benchmark failed`, { projectId, error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

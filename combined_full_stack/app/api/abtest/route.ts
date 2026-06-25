import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { assertCanStartRun, billRunUsage, getBillingUserKey } from "@/lib/server/billing_account";
import { mergeBenchmarkStrategies, runBenchmark } from "@/lib/server/strategies";
import { logger } from "@/lib/server/server_logger";
import type { DocId, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:abtest");

// AI : real A/B benchmark (replaces the setTimeout jitter) — all enabled environments run
// AI : on the cheap model, the LLM judge scores them. Takes ~1-2 min; the client awaits.
// AI : keep in sync with ROUTE_MAX_DURATION_RUNS in lib/server/route-config.ts.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const { projectId, inputDocId } = (await req.json()) as { projectId: ProjectId; inputDocId?: DocId };
  apiLog.info(`POST /api/abtest`, { projectId, inputDocId });
  const project = store.project(projectId);
  if (!project) {
    apiLog.warn(`unknown project`, { projectId });
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND);
  }

  // AI : default task input = the oldest inference doc (the seeded source document).
  const docId = inputDocId ?? [...store.docs()].reverse().find((d) => d.label === "inference")?.id;
  if (!docId) return apiError("no inference document in the store", 400);

  const billingKey = await getBillingUserKey();
  try {
    await assertCanStartRun(billingKey);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    throw err;
  }

  try {
    apiLog.info(`benchmark starting`, { projectId, docId });
    const result = await runBenchmark(project, store, docId);
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

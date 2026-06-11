import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/app_store";
import { BillingError, chargeForRun, getBillingUserKey } from "@/lib/server/billing_account";
import { runBenchmark } from "@/lib/server/strategies";
import { logger } from "@/lib/server/server_logger";
import type { DocId, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:abtest");

// AI : real A/B benchmark (replaces the setTimeout jitter) — all enabled environments run
// AI : on the cheap model, the LLM judge scores them. Takes ~1-2 min; the client awaits.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { projectId, inputDocId } = (await req.json()) as { projectId: ProjectId; inputDocId?: DocId };
  apiLog.info(`POST /api/abtest`, { projectId, inputDocId });
  const store = await getStore();
  const project = store.project(projectId);
  if (!project) {
    apiLog.warn(`unknown project`, { projectId });
    return NextResponse.json({ error: `unknown project ${projectId}` }, { status: 404 });
  }

  // AI : default task input = the oldest inference doc (the seeded source document).
  const docId = inputDocId ?? [...store.docs()].reverse().find((d) => d.label === "inference")?.id;
  if (!docId) return NextResponse.json({ error: "no inference document in the store" }, { status: 400 });

  try {
    await chargeForRun(await getBillingUserKey());
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    throw err;
  }

  try {
    apiLog.info(`benchmark starting`, { projectId, docId });
    const result = await runBenchmark(project, store, docId);
    apiLog.info(`benchmark complete`, { projectId, docId });
    return NextResponse.json(result);
  } catch (err) {
    apiLog.error(`benchmark failed`, { projectId, error: (err as Error).message });
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}

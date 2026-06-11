import { NextResponse, type NextRequest, after } from "next/server";
import { getStore } from "@/lib/server/app_store";
import { BillingError, chargeForRun, getBillingUserKey } from "@/lib/server/billing_account";
import { runPipeline } from "@/lib/server/run_engine";
import { createJob, finishJob, jobProgress, openJobDb } from "@/lib/server/run_jobs";
import type { DocId, ModelId, ProjectId } from "@/lib/server/types";

// AI : todo §8 — after() keeps the pipeline alive once the response is sent (Vercel
// AI : freezes plain dangling promises); maxDuration is the Fluid-compute ceiling.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RunRequest {
  projectId: ProjectId;
  inputDocId: DocId;
  model?: ModelId;
}

export async function POST(req: NextRequest) {
  const { projectId, inputDocId, model } = (await req.json()) as RunRequest;
  const store = await getStore();
  if (!store.project(projectId)) return NextResponse.json({ error: `unknown project ${projectId}` }, { status: 404 });
  if (store.docContent(inputDocId) === undefined)
    return NextResponse.json({ error: `unknown doc ${inputDocId}` }, { status: 404 });

  try {
    await chargeForRun(await getBillingUserKey());
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    throw err;
  }

  const jobDb = await openJobDb();
  const jobId = await createJob(jobDb);
  after(async () => {
    try {
      const run = await runPipeline(store, projectId, inputDocId, {
        model,
        onStep: (p) => jobProgress(jobId, p, jobDb),
      });
      await store.flush(); // AI : SupabaseStore queues addRun — persist before the job reports done
      await finishJob(jobId, { run }, jobDb);
    } catch (err) {
      await finishJob(jobId, { error: (err as Error).message }, jobDb);
    }
  });
  return NextResponse.json({ jobId });
}

import { NextResponse, type NextRequest, after } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { chargeForRun, getBillingUserKey } from "@/lib/server/billing_account";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { runPipeline } from "@/lib/server/run_engine";
import {
  createJob,
  finishJob,
  jobProgress,
  openJobDb,
  pauseJob,
  withJobLogging,
} from "@/lib/server/run_jobs";
import { logger } from "@/lib/server/server_logger";
import type { DocId, ModelId, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:runs");

// AI : todo §8 — after() keeps the pipeline alive once the response is sent (Vercel
// AI : freezes plain dangling promises); maxDuration is the Fluid-compute ceiling.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RunRequest {
  projectId: ProjectId;
  inputDocId: DocId;
  inputDocIds?: DocId[];
  model?: ModelId;
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { auth, store } = ctx;

  const { projectId, inputDocId, inputDocIds, model } = (await req.json()) as RunRequest;
  apiLog.info(`POST /api/runs`, { projectId, inputDocId, inputDocIds, model, ownerId: auth.userId });

  if (!store.project(projectId)) {
    apiLog.warn(`unknown project`, { projectId });
    return apiError(`unknown project ${projectId}`, 404);
  }
  if (store.docContent(inputDocId) === undefined) {
    apiLog.warn(`unknown doc`, { inputDocId });
    return apiError(`unknown doc ${inputDocId}`, 404);
  }

  try {
    const billingKey = await getBillingUserKey();
    apiLog.info(`charging for run`, { billingKey });
    await chargeForRun(billingKey);
    apiLog.info(`billing charge ok`);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) {
      apiLog.warn(`billing rejected`, { code: (err as { code?: string }).code, message: (err as Error).message });
      return billed;
    }
    apiLog.error(`billing error`, { error: (err as Error).message });
    throw err;
  }

  const jobDb = await openJobDb();
  const jobId = await createJob(auth.userId, jobDb);
  apiLog.info(`job created — scheduling pipeline via after()`, { jobId, ownerId: auth.userId });

  after(async () => {
    await withJobLogging(auth.userId, jobId, jobDb, async () => {
      apiLog.info(`after() pipeline starting`, { jobId, projectId, inputDocId, model });
      try {
        const run = await runPipeline(store, projectId, inputDocId, {
          model,
          inputDocIds,
          // AI : never block the pipeline on Supabase job upserts — progress is memory-hot during the run.
          onStep: (p) => {
            void jobProgress(auth.userId, jobId, p, jobDb).catch((err) =>
              apiLog.error(`jobProgress failed`, { jobId, moduleId: p.moduleId, error: (err as Error).message }),
            );
          },
        });
        apiLog.info(`pipeline finished — flushing store`, { jobId, runId: run.id, status: run.status });
        await store.flush(); // AI : SupabaseStore queues addRun — persist before the job reports done
        await finishJob(auth.userId, jobId, { run }, jobDb);
        apiLog.info(`job finished ok`, { jobId, runId: run.id });
      } catch (err) {
        if (err instanceof PipelinePausedError) {
          await pauseJob(auth.userId, jobId, err.checkpoint, jobDb);
          apiLog.info(`pipeline paused for client code`, { jobId, moduleId: err.checkpoint.clientStep.moduleId });
          return;
        }
        apiLog.error(`pipeline threw`, { jobId, error: (err as Error).message, stack: (err as Error).stack });
        await finishJob(auth.userId, jobId, { error: (err as Error).message }, jobDb);
      }
    });
  });
  return NextResponse.json({ jobId });
}

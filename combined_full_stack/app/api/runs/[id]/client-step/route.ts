import { NextResponse, after, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { resumeRunPipeline } from "@/lib/server/run_engine";
import {
  claimJobResume,
  finishJob,
  getJob,
  jobProgress,
  openJobDb,
  pauseJob,
  withJobLogging,
  type RunJobId,
} from "@/lib/server/run_jobs";
import { logger } from "@/lib/server/server_logger";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const apiLog = logger("api:runs:client-step");

// AI : browser ran user-authored transform/custom code — resume the server pipeline from the checkpoint.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { auth, store } = authCtx;

  const { id } = await ctx.params;
  const { output } = (await req.json()) as { output?: unknown };
  if (output === undefined) return apiError("output required", 400);

  const jobId = id as RunJobId;
  const jobDb = await openJobDb();
  const checkpoint = await claimJobResume(auth.userId, jobId, jobDb);
  if (!checkpoint) {
    const job = await getJob(auth.userId, jobId, jobDb);
    if (!job) return apiError(`unknown job ${id}`, 404);
    return apiError(`job ${id} is not waiting for client code`, 409);
  }

  apiLog.info(`POST client-step — scheduling resume`, {
    jobId,
    ownerId: auth.userId,
    moduleId: checkpoint.clientStep.moduleId,
  });

  after(async () => {
    await withJobLogging(auth.userId, jobId, jobDb, async () => {
      try {
        const run = await resumeRunPipeline(store, checkpoint, output, {
          onStep: (p) => {
            void jobProgress(auth.userId, jobId, p, jobDb).catch((err) =>
              apiLog.error(`jobProgress failed`, { jobId, error: (err as Error).message }),
            );
          },
        });
        await store.flush();
        await finishJob(auth.userId, jobId, { run }, jobDb);
        apiLog.info(`resume finished`, { jobId, runId: run.id, status: run.status });
      } catch (err) {
        if (err instanceof PipelinePausedError) {
          await pauseJob(auth.userId, jobId, err.checkpoint, jobDb);
          apiLog.info(`resume paused again for client code`, {
            jobId,
            moduleId: err.checkpoint.clientStep.moduleId,
          });
          return;
        }
        apiLog.error(`resume threw`, { jobId, error: (err as Error).message });
        await finishJob(auth.userId, jobId, { error: (err as Error).message }, jobDb);
      }
    });
  });

  return NextResponse.json({ ok: true });
}

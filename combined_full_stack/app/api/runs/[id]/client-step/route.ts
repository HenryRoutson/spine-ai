import { invariant } from "@/lib/assert";
import { NextResponse, after, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownJob } from "@/lib/server/api-errors";
import { clientStepBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { billRunUsage } from "@/lib/server/billing_account";
import { billingKeyForProject } from "@/lib/server/team_billing";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { resumeRunPipeline } from "@/lib/server/run_engine";
import {
  appendJobLogs,
  claimJobResume,
  finishJob,
  getJobForProgress,
  isJobResuming,
  jobProgress,
  openJobDb,
  pauseJob,
  withJobLogging,
  type RunJobId,
} from "@/lib/server/run_jobs";
import { logger } from "@/lib/server/server_logger";
import type { JobLogEntry } from "@/lib/run-types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const apiLog = logger("api:runs:client-step");

// AI : browser ran user-authored transform/custom code — resume the server pipeline from the checkpoint.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { auth, store } = authCtx;

  const { id } = await ctx.params;
  const body = await parseRequestJson(req, clientStepBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  const jobId = id as RunJobId;
  const jobDb = await openJobDb();
  const checkpoint = await claimJobResume(auth.userId, jobId, jobDb);
  if (!checkpoint) {
    const job = await getJobForProgress(auth.userId, jobId, jobDb);
    if (!job) return apiError(unknownJob(id), HTTP.NOT_FOUND);
    // AI : race fix — duplicate POST after another instance claimed; not an error, keep polling.
    if (isJobResuming(job)) return NextResponse.json({ ok: true, alreadyClaimed: true });
    return apiError(`job ${id} is not waiting for client code`, HTTP.CONFLICT);
  }
  invariant(checkpoint.clientStep, `checkpoint for job ${jobId} missing clientStep`);

  apiLog.info(`POST client-step — scheduling resume`, {
    jobId,
    ownerId: auth.userId,
    moduleId: checkpoint.clientStep.moduleId,
  });

  after(async () => {
    if (body.clientLogs?.length) await appendJobLogs(auth.userId, jobId, body.clientLogs as JobLogEntry[], jobDb);
    await withJobLogging(auth.userId, jobId, jobDb, async () => {
      try {
        const run = await resumeRunPipeline(
          store,
          checkpoint,
          { output: body.output, error: body.error },
          {
            cacheOwnerId: checkpoint.cacheOwnerId ?? auth.userId,
            clientLogs: body.clientLogs as JobLogEntry[] | undefined,
            onStep: (p) => {
            void jobProgress(auth.userId, jobId, p, jobDb).catch((err) =>
              apiLog.error(`jobProgress failed`, { jobId, error: (err as Error).message }),
            );
          },
        });
        await store.flush();
        if (run.billedCents > 0) {
          try {
            const project = store.project(checkpoint.projectId);
            const billingKey = await billingKeyForProject(auth.userId, project ?? {});
            await billRunUsage(billingKey, run.billedCents);
          } catch (billErr) {
            apiLog.warn(`resume billing failed`, { jobId, error: (billErr as Error).message });
          }
        }
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

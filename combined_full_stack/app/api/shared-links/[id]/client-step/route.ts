import { invariant } from "@/lib/assert";
import { NextResponse, after, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { apiError } from "@/lib/server/api_context";
import { HTTP, unknownJob } from "@/lib/server/api-errors";
import { parseRequestJson, sharedLinkClientStepBodySchema } from "@/lib/server/api_schemas";
import { billRunUsage, billingKeyForUser } from "@/lib/server/billing_account";
import { orderedInputModules } from "@/lib/inference-input";
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
import {
  getSharedLink,
  openStoreForUser,
  verifySharedProgressToken,
} from "@/lib/server/shared_links";
import { overlayStoreForSharedRun } from "@/lib/server/shared-link-session";
import { logger } from "@/lib/server/server_logger";
import type { JobLogEntry } from "@/lib/run-types";
import type { SharedLinkId } from "@/lib/server/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "shared_run_session";
const apiLog = logger("api:shared-links:client-step");

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: linkId } = await ctx.params;
  const parsed = await parseRequestJson(req, sharedLinkClientStepBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const body = parsed;

  const entry = verifySharedProgressToken(linkId as SharedLinkId, body.jobId, body.token);
  if (!entry) return apiError("invalid progress token", 403);

  const link = await getSharedLink(linkId as SharedLinkId);
  if (!link) return apiError("link not found", 404);

  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return apiError("session required", 400);

  const jobId = body.jobId as RunJobId;
  const jobDb = await openJobDb();
  const checkpoint = await claimJobResume(entry.ownerId, jobId, jobDb);
  if (!checkpoint) {
    const job = await getJobForProgress(entry.ownerId, jobId, jobDb);
    if (!job) return apiError(unknownJob(body.jobId), HTTP.NOT_FOUND);
    if (isJobResuming(job)) return NextResponse.json({ ok: true, alreadyClaimed: true });
    return apiError(`job ${body.jobId} is not waiting for client code`, HTTP.CONFLICT);
  }
  invariant(checkpoint.clientStep, `checkpoint for job ${jobId} missing clientStep`);

  const sharerStore = await openStoreForUser(link.ownerId);
  const overlay = overlayStoreForSharedRun(
    sharerStore,
    link.id,
    sessionId,
    link.defaultDocs,
    orderedInputModules(link.snapshot.modules),
  );

  apiLog.info(`POST client-step — scheduling resume`, {
    jobId,
    ownerId: entry.ownerId,
    moduleId: checkpoint.clientStep.moduleId,
  });

  after(async () => {
    if (body.clientLogs?.length) await appendJobLogs(entry.ownerId, jobId, body.clientLogs as JobLogEntry[], jobDb);
    await withJobLogging(entry.ownerId, jobId, jobDb, async () => {
      try {
        const run = await resumeRunPipeline(
          overlay,
          checkpoint,
          { output: body.output, error: body.error },
          {
            cacheOwnerId: checkpoint.cacheOwnerId ?? link.ownerId,
            clientLogs: body.clientLogs as JobLogEntry[] | undefined,
            onStep: (p) => {
              void jobProgress(entry.ownerId, jobId, p, jobDb).catch((err) =>
                apiLog.error(`jobProgress failed`, { jobId, error: (err as Error).message }),
              );
            },
          },
        );
        await sharerStore.flush();
        if (run.billedCents > 0 && link.fundingMode === "sharer_pays") {
          try {
            await billRunUsage(billingKeyForUser(link.ownerId), run.billedCents);
          } catch (billErr) {
            apiLog.warn(`resume billing failed`, { jobId, error: (billErr as Error).message });
          }
        }
        await finishJob(entry.ownerId, jobId, { run }, jobDb);
        apiLog.info(`resume finished`, { jobId, runId: run.id, status: run.status });
      } catch (err) {
        if (err instanceof PipelinePausedError) {
          await pauseJob(entry.ownerId, jobId, err.checkpoint, jobDb);
          apiLog.info(`resume paused again for client code`, {
            jobId,
            moduleId: err.checkpoint.clientStep.moduleId,
          });
          return;
        }
        apiLog.error(`resume threw`, { jobId, error: (err as Error).message });
        await finishJob(entry.ownerId, jobId, { error: (err as Error).message }, jobDb);
      }
    });
  });

  return NextResponse.json({ ok: true });
}

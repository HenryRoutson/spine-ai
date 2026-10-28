import { invariant } from "@/lib/assert";
import { NextResponse, after, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import { apiError } from "@/lib/server/api_context";
import { HTTP, unknownJob } from "@/lib/server/api-errors";
import { parseRequestJson, parseSharedLinkId, sharedLinkClientStepBodySchema } from "@/lib/server/api_schemas";
import { PUBLIC_RUN_SPEND_RESERVE_CENTS } from "@/lib/billing_config";
import { billSharedLinkRun, sharedLinkBillingKey, viewerFundsSharedRun } from "@/lib/server/shared_link_billing";
import { sharedLinkRequiresSignIn } from "@/lib/shared-link-funding";
import { isAuthSession, requireAuth, type user_id_string } from "@/lib/server/require_auth";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { resumeRunPipeline } from "@/lib/server/run_engine";
import {
  appendJobLogs,
  claimJobResume,
  finishJob,
  getJobForProgress,
  isJobResuming,
  jobProgress,
  openCrossUserJobDb,
  pauseJob,
  withJobLogging,
  type RunJobId,
} from "@/lib/server/run_jobs";
import {
  adjustSharedLinkSpend,
  getSharedLink,
  openStoreForUser,
  recordSharedLinkSpend,
  revokeSharedLink,
  verifySharedProgressToken,
} from "@/lib/server/shared_links";
import { overlayStoreForSharedRun, parseSharedSessionId, SHARED_RUN_SESSION_COOKIE } from "@/lib/server/shared-link-session";
import { logger } from "@/lib/server/server_logger";
import type { JobLogEntry } from "@/lib/run-types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const apiLog = logger("api:shared-links:client-step");

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);

  // AI : SECURITY — per-link + IP cap (same tier as /run) so resume cannot bypass shared_run limits.
  // AI : TODO security — same IP-rotation drain risk as /run when fundingMode is sharer_pays.
  const ip = clientIpFromHeaders(req.headers);
  const stepLimitKey = `shared-run:${linkId}:${ip}` as RateLimitKey;
  const stepLimited = await checkRateLimit(stepLimitKey, "shared_run");
  if (!stepLimited.ok) {
    return apiError("Too many runs on this link — try again later.", HTTP.TOO_MANY_REQUESTS, "rate_limited");
  }

  const parsed = await parseRequestJson(req, sharedLinkClientStepBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const body = parsed;

  const entry = await verifySharedProgressToken(linkId, body.jobId, body.token);
  if (!entry) return apiError("invalid progress token", 403);

  const link = await getSharedLink(linkId);
  if (!link) return apiError("link not found", 404);

  let viewerUserId: user_id_string | undefined;
  if (sharedLinkRequiresSignIn(link.fundingMode)) {
    const auth = await requireAuth();
    if (!isAuthSession(auth)) return apiError("sign in required", 401);
    if (viewerFundsSharedRun(link.fundingMode)) viewerUserId = auth.userId;
  }
  const billingKey = sharedLinkBillingKey(link.ownerId, link.fundingMode, viewerUserId);
  const reserveCents = link.spendLimitCents != null ? PUBLIC_RUN_SPEND_RESERVE_CENTS : 0;

  const jar = await cookies();
  const sessionId = parseSharedSessionId(jar.get(SHARED_RUN_SESSION_COOKIE)?.value);
  if (!sessionId) return apiError("session required", 400);

  const jobId = body.jobId as RunJobId;
  const jobDb = await openCrossUserJobDb();
  const checkpoint = await claimJobResume(entry.ownerId, jobId, jobDb);
  if (!checkpoint) {
    const job = await getJobForProgress(entry.ownerId, jobId, jobDb);
    if (!job) return apiError(unknownJob(body.jobId), HTTP.NOT_FOUND);
    if (isJobResuming(job)) return NextResponse.json({ ok: true, alreadyClaimed: true });
    return apiError(`job ${body.jobId} is not waiting for client code`, HTTP.CONFLICT);
  }
  invariant(checkpoint.clientStep, `checkpoint for job ${jobId} missing clientStep`);

  const sharerStore = await openStoreForUser(link.ownerId);
  const overlay = await overlayStoreForSharedRun(
    sharerStore,
    link.id,
    sessionId,
    link.defaultDocs,
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
            codeProfile: body.codeProfile,
            onStep: (p) => {
              void jobProgress(entry.ownerId, jobId, p, jobDb).catch((err) =>
                apiLog.error(`jobProgress failed`, { jobId, error: (err as Error).message }),
              );
            },
          },
        );
        await sharerStore.flush();
        if (run.billedCents > 0) {
          try {
            const bill = await billSharedLinkRun(billingKey, link.ownerId, link, run.billedCents);
            if (reserveCents > 0) {
              const settled = await adjustSharedLinkSpend(link.id, bill.totalCents - reserveCents);
              if (!settled) {
                apiLog.warn(`spend limit exceeded after resume — revoking link`, {
                  linkId: link.id,
                  billed: bill.totalCents,
                  reserveCents,
                });
                await revokeSharedLink(link.ownerId, link.id);
              }
            } else {
              await recordSharedLinkSpend(link.id, bill.totalCents);
            }
          } catch (billErr) {
            apiLog.warn(`resume billing failed — revoking link`, {
              linkId: link.id,
              jobId,
              billed: run.billedCents,
              error: (billErr as Error).message,
            });
            await revokeSharedLink(link.ownerId, link.id);
          }
        } else if (reserveCents > 0) {
          await adjustSharedLinkSpend(link.id, -reserveCents).catch(() => {});
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

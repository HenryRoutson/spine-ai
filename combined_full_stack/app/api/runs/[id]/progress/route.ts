import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import {
  getJobForProgress,
  jobMissingDetail,
  openJobDb,
  toProgressResponse,
  type RunJobId,
} from "@/lib/server/run_jobs";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import { logger } from "@/lib/server/server_logger";

export const dynamic = "force-dynamic";

const apiLog = logger("api:runs:progress");

// AI : polled by the Inference progress animation (~700ms) until run/error appears.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) return auth;

  const { id } = await ctx.params;
  const jobDb = await openJobDb();
  // AI : race fix — use getJobForProgress (Supabase-synced) not getJob, so polls don't flash stale clientStep.
  const job = await getJobForProgress(auth.userId, id as RunJobId, jobDb);
  if (!job) {
    const detail = await jobMissingDetail(auth.userId, id as RunJobId, jobDb);
    apiLog.warn(`GET progress 404`, { jobId: id, ownerId: auth.userId, detail });
    return apiError(`unknown job ${id}`, 404);
  }
  apiLog.debug(`GET progress`, {
    jobId: id,
    ownerId: auth.userId,
    stepCount: job.steps.length,
    done: !!(job.run || job.error),
    lastStep: job.steps.at(-1)?.status,
  });
  return NextResponse.json(toProgressResponse(job));
}

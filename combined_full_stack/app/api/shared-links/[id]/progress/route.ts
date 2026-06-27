import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP, unknownJob } from "@/lib/server/api-errors";
import {
  getJobForProgress,
  jobMissingDetail,
  openJobDb,
  toProgressResponse,
  type RunJobId,
} from "@/lib/server/run_jobs";
import { verifySharedProgressToken } from "@/lib/server/shared_links";
import { logger } from "@/lib/server/server_logger";
import type { SharedLinkId } from "@/lib/server/types";

export const dynamic = "force-dynamic";

const apiLog = logger("api:shared-links:progress");

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: linkId } = await ctx.params;
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const token = url.searchParams.get("token");
  if (!jobId || !token) return apiError("jobId and token required", 400);

  const entry = verifySharedProgressToken(linkId as SharedLinkId, jobId, token);
  if (!entry) return apiError("invalid progress token", 403);

  const jobDb = await openJobDb();
  const job = await getJobForProgress(entry.ownerId, jobId as RunJobId, jobDb);
  if (!job) {
    const detail = await jobMissingDetail(entry.ownerId, jobId as RunJobId, jobDb);
    apiLog.warn(`shared progress 404`, { jobId, detail });
    return apiError(unknownJob(jobId), HTTP.NOT_FOUND);
  }
  return NextResponse.json(toProgressResponse(job));
}

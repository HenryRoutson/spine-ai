import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP, unknownJob } from "@/lib/server/api-errors";
import { formatZodError, parseHostedApiId, sharedProgressQuerySchema } from "@/lib/server/api_schemas";
import {
  getJobForProgress,
  jobMissingDetail,
  openCrossUserJobDb,
  toProgressResponse,
  type RunJobId,
} from "@/lib/server/run_jobs";
import { verifySharedProgressToken } from "@/lib/server/shared_links";
import { logger } from "@/lib/server/server_logger";
import type { SharedLinkId } from "@/lib/server/types";

export const dynamic = "force-dynamic";

const apiLog = logger("api:hosted-apis:progress");

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const apiId = parseHostedApiId(id);
  if (!apiId) return apiError("api not found", 404);

  const url = new URL(req.url);
  const parsed = sharedProgressQuerySchema.safeParse({
    jobId: url.searchParams.get("jobId"),
    token: url.searchParams.get("token"),
  });
  if (!parsed.success) return apiError(formatZodError(parsed.error), HTTP.BAD_REQUEST);
  const { jobId, token } = parsed.data;

  const entry = await verifySharedProgressToken(apiId as unknown as SharedLinkId, jobId, token);
  if (!entry) return apiError("invalid progress token", 403);

  const jobDb = await openCrossUserJobDb();
  const job = await getJobForProgress(entry.ownerId, jobId as RunJobId, jobDb);
  if (!job) {
    const detail = await jobMissingDetail(entry.ownerId, jobId as RunJobId, jobDb);
    apiLog.warn(`hosted api progress 404`, { jobId, detail });
    return apiError(unknownJob(jobId), HTTP.NOT_FOUND);
  }
  return NextResponse.json(toProgressResponse(job));
}

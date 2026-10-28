import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parsePipelineScheduleId } from "@/lib/server/api_schemas";
import { getSchedule } from "@/lib/server/pipeline_schedules";
import { queueScheduledRun } from "@/lib/server/pipeline_schedule_run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("llm");
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const scheduleId = parsePipelineScheduleId(id);
  if (!scheduleId) return apiError("schedule not found", HTTP.NOT_FOUND);
  const row = await getSchedule(authCtx.auth.userId, scheduleId);
  if (!row) return apiError("schedule not found", HTTP.NOT_FOUND);
  const result = await queueScheduledRun({ ...row, lastClaimedAt: Date.now() });
  if (!result.ok) return apiError(result.message, result.status, result.code);
  return NextResponse.json({ jobId: result.jobId });
}

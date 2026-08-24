import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import {
  parsePipelineScheduleId,
  parseRequestJson,
  patchPipelineScheduleBodySchema,
} from "@/lib/server/api_schemas";
import { UnknownModelError, parseOptionalRequestModel } from "@/lib/server/model_catalog";
import {
  ScheduleValidationError,
  ensureScheduleRuntime,
  getSchedule,
  patchSchedule,
  revokeSchedule,
  toPublicRecord,
} from "@/lib/server/pipeline_schedules";
import { scheduleDocsFromByModule } from "@/lib/schedule-types";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("read");
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const scheduleId = parsePipelineScheduleId(id);
  if (!scheduleId) return apiError("schedule not found", HTTP.NOT_FOUND);
  const row = await getSchedule(authCtx.auth.userId, scheduleId);
  if (!row) return apiError("schedule not found", HTTP.NOT_FOUND);
  return NextResponse.json({ schedule: toPublicRecord(row) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const scheduleId = parsePipelineScheduleId(id);
  if (!scheduleId) return apiError("schedule not found", HTTP.NOT_FOUND);
  const parsed = await parseRequestJson(req, patchPipelineScheduleBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);

  let defaultModel: ReturnType<typeof parseOptionalRequestModel> | null | undefined;
  try {
    if (parsed.defaultModel === null) defaultModel = null;
    else if (parsed.defaultModel !== undefined) defaultModel = parseOptionalRequestModel(parsed.defaultModel);
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }

  try {
    if (parsed.tickUrl) await ensureScheduleRuntime(parsed.tickUrl);
    const updated = await patchSchedule(authCtx.auth.userId, scheduleId, {
      name: parsed.name,
      cron: parsed.cron,
      timezone: parsed.timezone,
      enabled: parsed.enabled,
      defaultModel,
      defaultDocs: parsed.defaultDocsByModule
        ? scheduleDocsFromByModule(parsed.defaultDocsByModule)
        : undefined,
    });
    if (!updated) return apiError("schedule not found", HTTP.NOT_FOUND);
    return NextResponse.json({ schedule: updated });
  } catch (err) {
    if (err instanceof ScheduleValidationError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const scheduleId = parsePipelineScheduleId(id);
  if (!scheduleId) return apiError("schedule not found", HTTP.NOT_FOUND);
  const ok = await revokeSchedule(authCtx.auth.userId, scheduleId);
  if (!ok) return apiError("schedule not found", HTTP.NOT_FOUND);
  return NextResponse.json({ ok: true });
}

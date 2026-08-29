import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { createPipelineScheduleBodySchema, parseRequestJson, pipelineScheduleRuntimeBodySchema } from "@/lib/server/api_schemas";
import { UnknownModelError, parseOptionalRequestModel } from "@/lib/server/model_catalog";
import {
  ScheduleValidationError,
  createSchedule,
  ensureScheduleRuntime,
  getScheduleRuntime,
  listSchedulesForOwner,
} from "@/lib/server/pipeline_schedules";
import { scheduleDocsFromByModule } from "@/lib/schedule-types";
import type { ProjectId, pipeline_function_id } from "@/lib/server/types";
import { logger } from "@/lib/server/server_logger";
import { activeFunctionId, functionsOnProject } from "@/lib/pipeline-functions";

const apiLog = logger("api:schedules");
// AI : DONE (connect-L-triggers) — Vibe Schedule tab + Inference hint call this API; no node canvas.

export async function GET(req: NextRequest) {
  const ctx = await requireAuthStore("read");
  if (ctx instanceof NextResponse) return ctx;
  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null;
  const [schedules, runtime] = await Promise.all([
    listSchedulesForOwner(ctx.auth.userId, projectId ?? undefined),
    getScheduleRuntime(),
  ]);
  return NextResponse.json({ schedules, runtime });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = await parseRequestJson(req, createPipelineScheduleBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const project = ctx.store.project(parsed.projectId as ProjectId);
  if (!project) return apiError(`unknown project ${parsed.projectId}`, HTTP.NOT_FOUND);
  let defaultModel;
  try {
    defaultModel = parseOptionalRequestModel(parsed.defaultModel);
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }
  try {
    const functionId =
      (parsed.functionId as pipeline_function_id | undefined) ?? activeFunctionId(project);
    if (!functionsOnProject(project).some((fn) => fn.id === functionId)) {
      return apiError("unknown function", HTTP.BAD_REQUEST);
    }
    const created = await createSchedule({
      ownerId: ctx.auth.userId,
      projectId: parsed.projectId as ProjectId,
      name: parsed.name,
      cron: parsed.cron,
      timezone: parsed.timezone,
      defaultModel,
      defaultDocs: scheduleDocsFromByModule(parsed.defaultDocsByModule),
      enabled: parsed.enabled,
      tickUrl: parsed.tickUrl,
      functionId,
    });
    const runtime = await getScheduleRuntime();
    apiLog.info(`created schedule`, { id: created.id, projectId: parsed.projectId });
    return NextResponse.json({ schedule: created, runtime });
  } catch (err) {
    if (err instanceof ScheduleValidationError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = await parseRequestJson(req, pipelineScheduleRuntimeBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  try {
    const runtime = await ensureScheduleRuntime(parsed.tickUrl);
    return NextResponse.json({ runtime });
  } catch (err) {
    if (err instanceof ScheduleValidationError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }
}

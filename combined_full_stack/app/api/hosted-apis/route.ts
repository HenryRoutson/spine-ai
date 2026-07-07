import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { createHostedApiBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { UnknownModelError, parseOptionalRequestModel } from "@/lib/server/model_catalog";
import {
  hostedApiInvokePath,
  hostedApiProgressPath,
  listHostedApisForOwner,
  publishHostedApi,
} from "@/lib/server/hosted_apis";
import { migrateProjectModules } from "@/lib/server/validity";
import { logger } from "@/lib/server/server_logger";
import type { DocId, HostedApiFundingMode, ModelId, ModuleId, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:hosted-apis");

export async function GET() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const apis = await listHostedApisForOwner(ctx.auth.userId);
  return NextResponse.json({ apis });
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthStore();
    if (ctx instanceof NextResponse) return ctx;
    const parsed = await parseRequestJson(req, createHostedApiBodySchema);
    if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
    const body = parsed;
    const project = ctx.store.project(body.projectId as ProjectId);
    if (!project) return apiError(`unknown project ${body.projectId}`, 404);

    let defaultModel: ModelId | undefined;
    try {
      defaultModel = parseOptionalRequestModel(body.defaultModel);
    } catch (err) {
      if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST);
      throw err;
    }

    const created = await publishHostedApi({
      ownerId: ctx.auth.userId,
      project: migrateProjectModules(project),
      defaultModel,
      fundingMode: body.fundingMode as HostedApiFundingMode | undefined,
      billingMultiple: body.billingMultiple,
      flatFeeCents: body.flatFeeCents,
      spendLimitCents: body.spendLimitCents,
      defaultDocsByModule: (body.defaultDocsByModule ?? {}) as Partial<Record<ModuleId, DocId[]>>,
      store: ctx.store,
    });
    apiLog.info(`published hosted api`, { apiId: created.id, projectId: body.projectId });
    return NextResponse.json({
      api: created,
      apiKey: created.apiKey,
      invokeUrl: hostedApiInvokePath(created.id),
      progressUrl: hostedApiProgressPath(created.id),
    });
  } catch (err) {
    apiLog.error(`POST failed`, { error: (err as Error).message });
    return apiError((err as Error).message || "failed to create hosted API", 500);
  }
}

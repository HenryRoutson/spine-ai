import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { createSharedLinkBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { UnknownModelError, parseOptionalRequestModel } from "@/lib/server/model_catalog";
import { listSharedLinksForOwner, publishSharedLink } from "@/lib/server/shared_links";
import { migrateProjectModules } from "@/lib/server/validity";
import { logger } from "@/lib/server/server_logger";
import type { DocId, ModelId, ModuleId, ProjectId, SharedLinkFundingMode } from "@/lib/server/types";

const apiLog = logger("api:shared-links");

export async function GET() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const links = await listSharedLinksForOwner(ctx.auth.userId);
  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthStore();
    if (ctx instanceof NextResponse) return ctx;
    const parsed = await parseRequestJson(req, createSharedLinkBodySchema);
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

    const link = await publishSharedLink({
      ownerId: ctx.auth.userId,
      project: migrateProjectModules(project),
      defaultModel,
      fundingMode: body.fundingMode as SharedLinkFundingMode | undefined,
      viewerNameRequired: body.viewerNameRequired,
      spendLimitCents: body.spendLimitCents,
      defaultDocsByModule: (body.defaultDocsByModule ?? {}) as Partial<Record<ModuleId, DocId[]>>,
      store: ctx.store,
    });
    apiLog.info(`published shared link`, { linkId: link.id, projectId: body.projectId });
    return NextResponse.json({ link, url: `/run/${link.id}` });
  } catch (err) {
    apiLog.error(`POST failed`, { error: (err as Error).message });
    return apiError((err as Error).message || "failed to create link", 500);
  }
}

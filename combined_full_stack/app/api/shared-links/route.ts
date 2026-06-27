import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { listSharedLinksForOwner, publishSharedLink } from "@/lib/server/shared_links";
import { migrateProjectModules } from "@/lib/server/validity";
import { logger } from "@/lib/server/server_logger";
import type { DocId, ModelId, ModuleId, ProjectId, SharedLinkFundingMode } from "@/lib/server/types";

const apiLog = logger("api:shared-links");

type CreateBody = {
  projectId: ProjectId;
  defaultModel?: ModelId;
  fundingMode?: SharedLinkFundingMode;
  viewerNameRequired?: boolean;
  defaultDocsByModule?: Partial<Record<ModuleId, DocId[]>>;
};

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
    const body = (await req.json().catch(() => ({}))) as CreateBody;
    const project = ctx.store.project(body.projectId);
    if (!project) return apiError(`unknown project ${body.projectId}`, 404);

    const link = await publishSharedLink({
      ownerId: ctx.auth.userId,
      project: migrateProjectModules(project),
      defaultModel: body.defaultModel,
      fundingMode: body.fundingMode,
      viewerNameRequired: body.viewerNameRequired,
      defaultDocsByModule: body.defaultDocsByModule ?? {},
      store: ctx.store,
    });
    apiLog.info(`published shared link`, { linkId: link.id, projectId: body.projectId });
    return NextResponse.json({ link, url: `/run/${link.id}` });
  } catch (err) {
    apiLog.error(`POST failed`, { error: (err as Error).message });
    return apiError((err as Error).message || "failed to create link", 500);
  }
}

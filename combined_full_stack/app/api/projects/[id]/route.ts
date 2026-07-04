import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, projectPatchSchema } from "@/lib/server/api_schemas";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { logger } from "@/lib/server/server_logger";
import { sanitizeModuleModels } from "@/lib/server/model_catalog";
import { mergeStrategyConfigPatch } from "@/lib/server/strategies";
import type { Project, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:projects");

// AI : persistence for the structure / pipeline / A/B builders — the client sends a
// AI : partial {models | modules | strategies | name} and the store flushes to disk.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  const project = store.project(id as ProjectId);
  if (!project) {
    apiLog.warn(`PUT /api/projects — unknown`, { projectId: id });
    return apiError(unknownProject(id), HTTP.NOT_FOUND);
  }
  const patchBody = await parseRequestJson(req, projectPatchSchema);
  if ("validationError" in patchBody) return apiError(patchBody.validationError, HTTP.BAD_REQUEST);
  const patch = patchBody as Partial<Project>;
  const sanitized: Partial<Project> = {
    ...patch,
    ...(patch.modules ? { modules: sanitizeModuleModels(patch.modules) } : {}),
    ...(patch.strategies
      ? { strategies: mergeStrategyConfigPatch(project.strategies, patch.strategies) }
      : {}),
  };
  apiLog.info(`PUT /api/projects`, {
    projectId: id,
    patchKeys: Object.keys(sanitized),
    moduleCount: sanitized.modules?.length ?? project.modules.length,
    modelCount: sanitized.models?.length ?? project.models.length,
  });
  store.saveProject({ ...project, ...sanitized, id: project.id });
  await store.flush();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  if (!store.project(id as ProjectId)) {
    apiLog.warn(`DELETE /api/projects — unknown`, { projectId: id });
    return apiError(unknownProject(id), HTTP.NOT_FOUND);
  }
  store.deleteProject(id as ProjectId);
  apiLog.info(`DELETE /api/projects`, { projectId: id });
  await store.flush();
  return NextResponse.json({ ok: true });
}

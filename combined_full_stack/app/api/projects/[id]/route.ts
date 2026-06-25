import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { logger } from "@/lib/server/server_logger";
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
  const patch = (await req.json()) as Partial<Project>;
  apiLog.info(`PUT /api/projects`, {
    projectId: id,
    patchKeys: Object.keys(patch),
    moduleCount: patch.modules?.length ?? project.modules.length,
    modelCount: patch.models?.length ?? project.models.length,
  });
  store.saveProject({ ...project, ...patch, id: project.id });
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
  if (!store.deleteProject(id as ProjectId)) {
    apiLog.warn(`DELETE /api/projects — blocked (last project)`, { projectId: id });
    return apiError("cannot delete the last project", 400);
  }
  apiLog.info(`DELETE /api/projects`, { projectId: id });
  await store.flush();
  return NextResponse.json({ ok: true });
}

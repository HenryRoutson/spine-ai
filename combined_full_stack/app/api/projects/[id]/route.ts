import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/app_store";
import { logger } from "@/lib/server/server_logger";
import type { Project, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:projects");

// AI : persistence for the structure / pipeline / A/B builders — the client sends a
// AI : partial {models | modules | strategies | name} and the store flushes to disk.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = await getStore();
  const project = store.project(id as ProjectId);
  if (!project) {
    apiLog.warn(`PUT /api/projects — unknown`, { projectId: id });
    return NextResponse.json({ error: `unknown project ${id}` }, { status: 404 });
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

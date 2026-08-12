import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore, storeAuthError } from "@/lib/server/api_context";
import { parseProjectId, parseRequestJson, projectPatchSchema } from "@/lib/server/api_schemas";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { logger } from "@/lib/server/server_logger";
import { sanitizeModuleModels } from "@/lib/server/model_catalog";
import { mergeStrategyConfigPatch } from "@/lib/server/strategies";
import { normalizeStructureModels } from "@/lib/server/type_expr";
import { recordActivityEvents } from "@/lib/server/user_activity";
import { teamProjectWriteError } from "@/lib/server/teams";
import type { user_id_string } from "@/lib/server/require_auth";
import type { PipelineModule, Project } from "@/lib/server/types";

const apiLog = logger("api:projects");

function moduleStepEvents(
  userId: string,
  projectId: string,
  before: PipelineModule[],
  after: PipelineModule[],
) {
  const beforeIds = new Set(before.map((m) => m.id));
  const afterIds = new Set(after.map((m) => m.id));
  const events = [];

  for (const m of after) {
    if (!beforeIds.has(m.id)) {
      events.push({
        userId: userId as user_id_string,
        category: "step_create" as const,
        action: `Created step "${m.label}"`,
        projectId,
        detail: { moduleId: m.id, kind: m.kind, label: m.label },
      });
    }
  }
  for (const m of before) {
    if (!afterIds.has(m.id)) {
      events.push({
        userId: userId as user_id_string,
        category: "step_delete" as const,
        action: `Deleted step "${m.label}"`,
        projectId,
        detail: { moduleId: m.id, kind: m.kind, label: m.label },
      });
    }
  }
  for (const m of after) {
    const prev = before.find((x) => x.id === m.id);
    if (!prev) continue;
    if (JSON.stringify(prev) !== JSON.stringify(m)) {
      events.push({
        userId: userId as user_id_string,
        category: "step_modify" as const,
        action: `Modified step "${m.label}"`,
        projectId,
        detail: { moduleId: m.id, kind: m.kind, label: m.label },
      });
    }
  }
  return events;
}

// AI : persistence for the structure / pipeline / A/B builders — the client sends a
// AI : partial {models | modules | strategies | name} and the store flushes to disk.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("write");
  if (authCtx instanceof NextResponse) return authCtx;
  const { store, auth } = authCtx;

  const { id: rawId } = await ctx.params;
  const projectId = parseProjectId(rawId);
  if (!projectId) return apiError(unknownProject(rawId), HTTP.NOT_FOUND, "unknown_project", {
    resource: `project:${rawId}`,
    detail: "Invalid or missing project id in URL.",
  });
  const project = store.project(projectId);
  if (!project) {
    apiLog.warn(`PUT /api/projects — unknown`, { projectId });
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND, "unknown_project", {
      resource: `project:${projectId}`,
      detail: "Project missing from store (deleted, never created, or not visible to this user/team).",
    });
  }
  const writeErr = teamProjectWriteError(project);
  if (writeErr) return apiError(writeErr, HTTP.FORBIDDEN);
  const patchBody = await parseRequestJson(req, projectPatchSchema);
  if ("validationError" in patchBody) return apiError(patchBody.validationError, HTTP.BAD_REQUEST);
  const patch = patchBody as Partial<Project>;
  const sanitized: Partial<Project> = {
    ...patch,
    ...(patch.models ? { models: normalizeStructureModels(patch.models) } : {}),
    ...(patch.modules ? { modules: sanitizeModuleModels(patch.modules) } : {}),
    ...(patch.strategies
      ? { strategies: mergeStrategyConfigPatch(project.strategies, patch.strategies) }
      : {}),
  };
  apiLog.info(`PUT /api/projects`, {
    projectId,
    patchKeys: Object.keys(sanitized),
    moduleCount: sanitized.modules?.length ?? project.modules.length,
    modelCount: sanitized.models?.length ?? project.models.length,
  });
  store.saveProject({ ...project, ...sanitized, id: project.id });
  if (sanitized.modules) {
    void recordActivityEvents(
      moduleStepEvents(auth.userId, projectId, project.modules, sanitized.modules),
    );
  }
  try {
    await store.flush();
  } catch (err) {
    return storeAuthError(err);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("write");
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id: rawId } = await ctx.params;
  const projectId = parseProjectId(rawId);
  if (!projectId) return apiError(unknownProject(rawId), HTTP.NOT_FOUND, "unknown_project", {
    resource: `project:${rawId}`,
    detail: "Invalid or missing project id in URL.",
  });
  if (!store.project(projectId)) {
    apiLog.warn(`DELETE /api/projects — unknown`, { projectId });
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND, "unknown_project", {
      resource: `project:${projectId}`,
      detail: "Project missing from store (deleted, never created, or not visible to this user/team).",
    });
  }
  const project = store.project(projectId)!;
  const writeErr = teamProjectWriteError(project);
  if (writeErr) return apiError(writeErr, HTTP.FORBIDDEN);
  store.deleteProject(projectId);
  apiLog.info(`DELETE /api/projects`, { projectId });
  try {
    await store.flush();
  } catch (err) {
    return storeAuthError(err);
  }
  return NextResponse.json({ ok: true });
}

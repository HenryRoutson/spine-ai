import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc, unknownProject } from "@/lib/server/api-errors";
import { docProjectsPatchSchema, parseRequestJson } from "@/lib/server/api_schemas";
import { deleteDocForProject, projectsForDocName, setDocProjectAvailability } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";
import type { DocId, ProjectId } from "@/lib/server/types";

const apiLog = logger("api:docs");

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  const docId = id as DocId;
  const doc = store.docs().find((d) => d.id === docId);
  if (!doc) {
    apiLog.warn(`PATCH /api/docs — unknown`, { docId: id });
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }

  const parsed = await parseRequestJson(req, docProjectsPatchSchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  for (const projectId of parsed.projectIds) {
    if (!store.project(projectId as ProjectId)) {
      apiLog.warn(`PATCH /api/docs — unknown project`, { docId: id, projectId });
      return apiError(unknownProject(projectId), HTTP.NOT_FOUND);
    }
  }

  if (!setDocProjectAvailability(store, docId, parsed.projectIds as ProjectId[])) {
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }

  await store.flush();
  apiLog.info(`PATCH /api/docs projects`, { docId: id, projectIds: parsed.projectIds });
  return NextResponse.json({ projectIds: projectsForDocName(store, doc.name) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id } = await ctx.params;
  const docId = id as DocId;
  if (!store.docs().some((d) => d.id === docId)) {
    apiLog.warn(`DELETE /api/docs — unknown`, { docId: id });
    return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  }

  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null;
  if (!projectId) return apiError("projectId is required", HTTP.BAD_REQUEST);
  if (!store.project(projectId)) {
    apiLog.warn(`DELETE /api/docs — unknown project`, { docId: id, projectId });
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND);
  }

  if (!deleteDocForProject(store, projectId, docId)) {
    apiLog.warn(`DELETE /api/docs — not linked to project`, { docId: id, projectId });
    return apiError("document is not in this pipeline", HTTP.BAD_REQUEST);
  }

  await store.flush();
  apiLog.info(`DELETE /api/docs`, { docId: id, projectId });
  return NextResponse.json({ ok: true });
}

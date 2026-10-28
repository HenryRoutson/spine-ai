import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { listStepCacheEntries } from "@/lib/server/step_cache";
import type { Project, ProjectId } from "@/lib/server/types";

const MAX_CACHE_QUERY_CHARS = 500;

export async function GET(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { auth, store } = ctx;

  const rawQ = req.nextUrl.searchParams.get("q") ?? undefined;
  if (rawQ && rawQ.length > MAX_CACHE_QUERY_CHARS) {
    return apiError(`query too long (max ${MAX_CACHE_QUERY_CHARS} chars)`, HTTP.BAD_REQUEST);
  }
  const q = rawQ;
  const projectIdRaw = req.nextUrl.searchParams.get("projectId");
  if (projectIdRaw && (projectIdRaw.length < 1 || projectIdRaw.length > 128)) {
    return apiError("invalid projectId", HTTP.BAD_REQUEST);
  }
  const projectId = (projectIdRaw as ProjectId | null) ?? undefined;
  if (projectId && !store.project(projectId)) {
    return apiError("invalid projectId", HTTP.BAD_REQUEST);
  }
  const searchStep = req.nextUrl.searchParams.get("searchStep") === "1";
  const searchInput = req.nextUrl.searchParams.get("searchInput") === "1";
  const searchOutput = req.nextUrl.searchParams.get("searchOutput") === "1";
  const projects: Project[] = store.projects();

  const entries = listStepCacheEntries({
    cacheOwnerId: auth.userId,
    projects,
    query: q,
    projectId,
    searchFields: { step: searchStep, input: searchInput, output: searchOutput },
  }).map((e) => {
    const project = projects.find((p) => p.id === e.projectId);
    const moduleLabel = project?.modules.find((m) => m.id === e.moduleId)?.label;
    return {
      ...e,
      projectName: project?.name,
      moduleLabel,
    };
  });

  return NextResponse.json({ entries });
}

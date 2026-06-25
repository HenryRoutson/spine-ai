import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { listStepCacheEntries } from "@/lib/server/step_cache";
import type { Project, ProjectId } from "@/lib/server/types";

export async function GET(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { auth, store } = ctx;

  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const projectId = (req.nextUrl.searchParams.get("projectId") as ProjectId | null) ?? undefined;
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

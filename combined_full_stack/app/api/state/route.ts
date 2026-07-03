import { NextResponse, type NextRequest } from "next/server";
import { requireAuthStore } from "@/lib/server/api_context";
import { resolveActiveProject } from "@/lib/project-active";
import { userProjectsFrom } from "@/lib/server/store";
import { migrateProjectModules } from "@/lib/server/validity";
import { getModelOptions, toPublicModelOptions } from "@/lib/server/openrouter_models";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:state");

// AI : ONE read endpoint — the client store hydrates everything from here on mount,
// AI : after mutations, and on project switch (runs are scoped to the active project).
export async function GET(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null;
  const projects = userProjectsFrom(store.projects()).map(migrateProjectModules);
  const project = resolveActiveProject(projects, projectId);
  apiLog.debug(`GET /api/state`, {
    projectId,
    activeProject: project?.id,
    projectCount: projects.length,
    docCount: store.docs().length,
    runCount: store.runs(project?.id).length,
    allRunCount: store.runs().length,
  });
  const modelOptions = toPublicModelOptions(await getModelOptions());
  return NextResponse.json({
    projects,
    docs: store.docs(),
    runs: store.runs(project?.id),
    // AI : account-wide run history — Billing tab aggregates spend across every project.
    allRuns: store.runs(),
    // AI : live OpenRouter pricing — fetched server-side, not from the client.
    modelOptions,
  });
}

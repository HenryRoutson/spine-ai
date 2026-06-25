import { NextResponse, type NextRequest } from "next/server";
import { requireAuthStore } from "@/lib/server/api_context";
import { userProjectsFrom } from "@/lib/server/store";
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
  const projects = userProjectsFrom(store.projects());
  const project =
    (projectId && projects.find((p) => p.id === projectId)) || projects[0];
  apiLog.debug(`GET /api/state`, {
    projectId,
    activeProject: project?.id,
    projectCount: projects.length,
    docCount: store.docs().length,
    runCount: store.runs(project?.id).length,
  });
  return NextResponse.json({
    projects,
    docs: store.docs(),
    runs: store.runs(project?.id),
  });
}

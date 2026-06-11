import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/app_store";
import type { ProjectId } from "@/lib/server/types";

// AI : ONE read endpoint — the client store hydrates everything from here on mount,
// AI : after mutations, and on project switch (runs are scoped to the active project).
export async function GET(req: NextRequest) {
  const store = await getStore();
  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null;
  const projects = store.projects();
  const project = (projectId && store.project(projectId)) || projects[0];
  return NextResponse.json({
    projects,
    docs: store.docs(),
    runs: store.runs(project?.id),
  });
}

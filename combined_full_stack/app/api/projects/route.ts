import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/app_store";
import { blankProject } from "@/lib/server/seed";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:projects");

// AI : "New project" — persist a fresh blank pipeline and hand it back to the client store.
export async function POST() {
  const store = await getStore();
  const project = blankProject(("p_" + Math.random().toString(36).slice(2, 9)) as ProjectId);
  apiLog.info(`POST /api/projects — new project`, { projectId: project.id });
  store.saveProject(project);
  await store.flush();
  return NextResponse.json(project);
}

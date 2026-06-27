import { NextResponse, type NextRequest } from "next/server";
import { uid } from "@/lib/id";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { allProjectSeeds, blankProject, cloneProject } from "@/lib/server/seed";
import { migrateProjectModules } from "@/lib/server/validity";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:projects");

type CreateProjectBody = {
  templateId?: ProjectId;
  cloneFrom?: ProjectId;
};

// AI : blank project, numbered clone of a template, or numbered clone of an existing project.
export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const body = (await req.json().catch(() => ({}))) as CreateProjectBody;
  const existing = store.projects();

  let project;
  if (body.templateId) {
    const seed = allProjectSeeds().find((s) => s.project.id === body.templateId);
    if (!seed) return apiError(`unknown template ${body.templateId}`, 404);
    project = migrateProjectModules(cloneProject(seed.project, existing));
    apiLog.info(`POST /api/projects — clone template`, { templateId: body.templateId, projectId: project.id });
  } else if (body.cloneFrom) {
    const source = store.project(body.cloneFrom);
    if (!source) return apiError(unknownProject(body.cloneFrom), HTTP.NOT_FOUND);
    project = migrateProjectModules(cloneProject(source, existing));
    apiLog.info(`POST /api/projects — clone project`, { cloneFrom: body.cloneFrom, projectId: project.id });
  } else {
    project = migrateProjectModules(blankProject(uid<ProjectId>("p_")));
    apiLog.info(`POST /api/projects — blank project`, { projectId: project.id });
  }

  store.saveProject(project);
  await store.flush();
  return NextResponse.json(migrateProjectModules(project));
}

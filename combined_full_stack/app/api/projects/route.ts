import { NextResponse, type NextRequest } from "next/server";
import { uid } from "@/lib/id";
import { apiError, requireAuthStore, storeAuthError } from "@/lib/server/api_context";
import { createProjectBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { allProjectSeeds, blankProject, cloneProject } from "@/lib/server/seed";
import { ensureSeedDocs } from "@/lib/server/store";
import { migrateProjectModules } from "@/lib/server/validity";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:projects");

// AI : blank project, numbered clone of a template, or numbered clone of an existing project.
export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("write");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const body = await parseRequestJson(req, createProjectBodySchema, {});
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);
  const existing = store.projects();

  let project;
  if (body.templateId) {
    const seed = allProjectSeeds().find((s) => s.project.id === (body.templateId as ProjectId));
    if (!seed) return apiError(`unknown template ${body.templateId}`, 404);
    project = migrateProjectModules(cloneProject(seed.project, existing));
    apiLog.info(`POST /api/projects — clone template`, { templateId: body.templateId, projectId: project.id });
  } else if (body.cloneFrom) {
    const source = store.project(body.cloneFrom as ProjectId);
    if (!source) return apiError(unknownProject(body.cloneFrom), HTTP.NOT_FOUND);
    project = migrateProjectModules(cloneProject(source, existing));
    apiLog.info(`POST /api/projects — clone project`, { cloneFrom: body.cloneFrom, projectId: project.id });
  } else {
    project = migrateProjectModules(blankProject(uid<ProjectId>("p_")));
    apiLog.info(`POST /api/projects — blank project`, { projectId: project.id });
  }

  try {
    if (body.templateId) await ensureSeedDocs(store);
    store.saveProject(project);
    await store.flush();
  } catch (err) {
    return storeAuthError(err);
  }
  return NextResponse.json(migrateProjectModules(project));
}

import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { parseProjectId } from "@/lib/server/api_schemas";
import { logger } from "@/lib/server/server_logger";
import { generatePipelineTypes } from "@/lib/server/type_codegen";
import { migrateProjectModules } from "@/lib/server/validity";
import type { ProjectTypesResponse } from "@/lib/project-types";

const apiLog = logger("api:project-types");

export type { ProjectTypesResponse, GeneratedTypeFile } from "@/lib/project-types";

// AI : generate lintable TS/Python type stubs for the live project — shown in Structure → Code → Lint stubs.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore();
  if (authCtx instanceof NextResponse) return authCtx;
  const { store } = authCtx;

  const { id: rawId } = await ctx.params;
  const projectId = parseProjectId(rawId);
  if (!projectId) {
    apiLog.warn(`GET /api/projects/:id/types — invalid id`, { projectId: rawId });
    return apiError(unknownProject(rawId), HTTP.NOT_FOUND);
  }
  const raw = store.project(projectId);
  if (!raw) {
    apiLog.warn(`GET /api/projects/:id/types — unknown`, { projectId });
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND);
  }

  const project = migrateProjectModules(raw);
  const generated = generatePipelineTypes(project);
  const body: ProjectTypesResponse = {
    files: [
      { name: "models.d.ts", language: "typescript", content: generated.modelsDts },
      { name: "pipeline_types.d.ts", language: "typescript", content: generated.pipelineDts },
      { name: "models.py", language: "python", content: generated.modelsPy },
      { name: "pipeline_types.py", language: "python", content: generated.pipelinePy },
    ],
  };
  return NextResponse.json(body);
}

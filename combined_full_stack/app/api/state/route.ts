import { NextResponse, type NextRequest } from "next/server";
import { requireAuthStore } from "@/lib/server/api_context";
import { resolveActiveProject } from "@/lib/project-active";
import { userProjectsFrom } from "@/lib/server/store";
import { migrateProjectModules } from "@/lib/server/validity";
import { getModelOptions, toPublicModelOptions } from "@/lib/server/openrouter_models";
import { logger } from "@/lib/server/server_logger";
import {
  docsForActiveProject,
  slimPipelineRuns,
  STATE_STREAM_EVENT,
} from "@/lib/server/state_payload";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:state");

// AI : progressive read — projects/docs/modelOptions stream first; runs are slim + project-scoped.
// AI : account-wide billing runs load lazily via GET /api/runs?scope=account.
export async function GET(req: NextRequest) {
  const ctx = await requireAuthStore("read");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null;
  const projects = userProjectsFrom(store.projects()).map(migrateProjectModules);
  const project = resolveActiveProject(projects, projectId);
  const docs = docsForActiveProject(projects, store.docs(), project?.id ?? null);
  const runs = slimPipelineRuns(store.runs(project?.id));
  const modelOptions = toPublicModelOptions(await getModelOptions());

  apiLog.debug(`GET /api/state`, {
    projectId,
    activeProject: project?.id,
    projectCount: projects.length,
    docCount: docs.length,
    runCount: runs.length,
  });

  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream({
    start(controller) {
      const push = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        push({ type: STATE_STREAM_EVENT.PROJECTS, projects });
        push({ type: STATE_STREAM_EVENT.MODEL_OPTIONS, modelOptions });
        push({ type: STATE_STREAM_EVENT.DOCS, docs });
        push({ type: STATE_STREAM_EVENT.RUNS, runs });
        push({ type: STATE_STREAM_EVENT.DONE });
      } catch (err) {
        push({ type: STATE_STREAM_EVENT.ERROR, error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(bodyStream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

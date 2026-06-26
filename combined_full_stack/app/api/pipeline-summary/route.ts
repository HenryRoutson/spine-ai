import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { requireProjectOr404 } from "@/lib/server/assistant-route";
import {
  PIPELINE_SUMMARY_STREAM_EVENT,
  summarizePipelineStream,
} from "@/lib/server/pipeline_summary";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL, type ModelId, type ProjectId } from "@/lib/server/types";

const apiLog = logger("api:pipeline-summary");

export const maxDuration = 120;

type SummaryRequestBody = {
  projectId: ProjectId;
  model?: ModelId;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SummaryRequestBody;
  const { projectId, model = DEFAULT_MODEL } = body;

  if (!projectId?.trim()) return apiError("projectId required", HTTP.BAD_REQUEST);

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const projectOrErr = requireProjectOr404(store, projectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;
  const project = projectOrErr;

  apiLog.info(`POST /api/pipeline-summary`, { projectId, model, stepCount: project.modules.length });

  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream({
    async start(controller) {
      const push = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        const text = await summarizePipelineStream(project, model, (delta) => {
          push({ type: PIPELINE_SUMMARY_STREAM_EVENT.DELTA, text: delta });
        });
        push({ type: PIPELINE_SUMMARY_STREAM_EVENT.DONE, text });
      } catch (err) {
        push({ type: PIPELINE_SUMMARY_STREAM_EVENT.ERROR, error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(bodyStream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

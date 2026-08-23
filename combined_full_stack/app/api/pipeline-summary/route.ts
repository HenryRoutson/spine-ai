import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, pipelineSummaryBodySchema } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { requireProjectOr404, parseAssistantRequestModel } from "@/lib/server/assistant-route";
import {
  gateAssistantBilling,
  PIPELINE_SUMMARY_BILLING_CHART_KEY,
  recordAssistantBilling,
} from "@/lib/server/assistant_billing";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import {
  PIPELINE_SUMMARY_STREAM_EVENT,
  summarizePipelineStream,
} from "@/lib/server/pipeline_summary";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:pipeline-summary");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await parseRequestJson(req, pipelineSummaryBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  const modelOrErr = parseAssistantRequestModel(body.model);
  if (modelOrErr instanceof NextResponse) return modelOrErr;
  const model = modelOrErr;

  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const projectOrErr = await requireProjectOr404(store, body.projectId as ProjectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;
  const project = projectOrErr;

  let billingKey;
  try {
    billingKey = await gateAssistantBilling();
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    throw err;
  }

  apiLog.info(`POST /api/pipeline-summary`, { projectId: body.projectId, model, stepCount: project.modules.length });

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const bodyStream = new ReadableStream({
    async start(controller) {
      const push = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        await ensureModelOptionsFresh();
        const { text, usageCents } = await summarizePipelineStream(project, model, (delta) => {
          push({ type: PIPELINE_SUMMARY_STREAM_EVENT.DELTA, text: delta });
        });
        if (usageCents > 0) {
          await recordAssistantBilling(billingKey, {
            store,
            projectId: project.id,
            model,
            message: `Pipeline summary: ${project.name}`,
            responseMessage: text.slice(0, 600),
            usageCents,
            startedAt,
            chartKey: PIPELINE_SUMMARY_BILLING_CHART_KEY,
          });
        }
        push({ type: PIPELINE_SUMMARY_STREAM_EVENT.DONE, text, usageCents });
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

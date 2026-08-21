import { NextResponse, type NextRequest } from "next/server";
// AI : TODO (arch-assistant-billing-http) — billing/auth/model parse duplicates assistant-route.runBilledProjectAssistant.
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, diagnosisAssistantBodySchema } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { requireProjectOr404 } from "@/lib/server/assistant-route";
import {
  DIAGNOSIS_ASSISTANT_BILLING_CHART_KEY,
  gateAssistantBilling,
  recordAssistantBilling,
} from "@/lib/server/assistant_billing";
import { UnknownModelError, parseRequestModel } from "@/lib/server/model_catalog";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import {
  DIAGNOSIS_STREAM_EVENT,
  diagnoseRunStream,
} from "@/lib/server/diagnosis_assistant";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL, type ModelId, type ProjectId, type RunId } from "@/lib/server/types";

const apiLog = logger("api:diagnosis-assistant");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await parseRequestJson(req, diagnosisAssistantBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  let model: ModelId;
  try {
    model = parseRequestModel(body.model, DEFAULT_MODEL);
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }

  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const projectOrErr = await requireProjectOr404(store, body.projectId as ProjectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;
  const project = projectOrErr;

  const run = store.runs(project.id).find((r) => r.id === body.runId);
  if (!run) return apiError(`unknown run ${body.runId}`, HTTP.NOT_FOUND);

  let billingKey;
  try {
    billingKey = await gateAssistantBilling();
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    throw err;
  }

  apiLog.info(`POST /api/diagnosis-assistant`, {
    projectId: body.projectId,
    runId: body.runId,
    model,
    messageChars: body.message.length,
  });

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const bodyStream = new ReadableStream({
    async start(controller) {
      const push = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        await ensureModelOptionsFresh();
        const { text, usageCents } = await diagnoseRunStream(
          project,
          run,
          body.message,
          model,
          (delta) => {
            push({ type: DIAGNOSIS_STREAM_EVENT.DELTA, text: delta });
          },
        );
        if (usageCents > 0) {
          await recordAssistantBilling(billingKey, {
            store,
            projectId: project.id,
            model,
            message: `Diagnosis: run ${body.runId as RunId}`,
            responseMessage: text.slice(0, 600),
            usageCents,
            startedAt,
            chartKey: DIAGNOSIS_ASSISTANT_BILLING_CHART_KEY,
          });
        }
        push({ type: DIAGNOSIS_STREAM_EVENT.DONE, text, usageCents });
      } catch (err) {
        push({ type: DIAGNOSIS_STREAM_EVENT.ERROR, error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(bodyStream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import {
  requireAssistantMessage,
  requireProjectOr404,
  trimAssistantHistory,
  type AssistantRequestBody,
} from "@/lib/server/assistant-route";
import { proposePipelineChange } from "@/lib/server/pipeline_assistant";
import { ASSISTANT_STREAM_EVENT } from "@/lib/assistant-chat-types";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL } from "@/lib/server/types";

const apiLog = logger("api:pipeline-assistant");

// AI : keep in sync with ROUTE_MAX_DURATION_ASSISTANT in lib/server/route-config.ts.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AssistantRequestBody;
  const { projectId, message, history = [], model = DEFAULT_MODEL, stream = false } = body;

  const messageErr = requireAssistantMessage(message);
  if (messageErr) return messageErr;

  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const projectOrErr = requireProjectOr404(store, projectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;
  const project = projectOrErr;

  apiLog.info(`POST /api/pipeline-assistant`, {
    projectId,
    messageChars: message.length,
    historyTurns: history.length,
    model,
    stream,
  });

  const trimmedHistory = trimAssistantHistory(history);

  try {
    if (!stream) {
      const result = await proposePipelineChange(project, message.trim(), trimmedHistory, model);
      return NextResponse.json(result);
    }

    const encoder = new TextEncoder();
    const bodyStream = new ReadableStream({
      async start(controller) {
        const push = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        try {
          const result = await proposePipelineChange(project, message.trim(), trimmedHistory, model, {
            onThinkingDelta: (text) =>
              push({ type: ASSISTANT_STREAM_EVENT.THINKING_DELTA, text }),
            onThinkingDone: (text) =>
              push({ type: ASSISTANT_STREAM_EVENT.THINKING_DONE, text }),
            onPhase: (phase) => push({ type: ASSISTANT_STREAM_EVENT.PHASE, phase }),
            onLlmResponse: (label, response) =>
              push({ type: ASSISTANT_STREAM_EVENT.LLM_RESPONSE, label, response }),
            onStructuredFailure: (detail) =>
              push({ type: ASSISTANT_STREAM_EVENT.STRUCTURED_FAILURE, ...detail }),
            onValidationFailed: (attempt, errors) =>
              push({ type: ASSISTANT_STREAM_EVENT.VALIDATION_FAILED, attempt, errors }),
          });
          push({
            type: ASSISTANT_STREAM_EVENT.DONE,
            message: result.message,
            proposal: result.proposal,
            invalidCount: result.invalidCount,
            retryCount: result.retryCount,
            validationErrors: result.validationErrors,
          });
        } catch (err) {
          push({ type: ASSISTANT_STREAM_EVENT.ERROR, error: (err as Error).message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(bodyStream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  } catch (err) {
    apiLog.error(`assistant failed`, { projectId, error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

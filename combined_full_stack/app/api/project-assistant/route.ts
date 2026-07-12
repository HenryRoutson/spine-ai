import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { assistantRequestBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  parseAssistantRequestModel,
  requireProjectOr404,
  runBilledProjectAssistant,
  trimAssistantHistory,
} from "@/lib/server/assistant-route";
import { ASSISTANT_STREAM_EVENT } from "@/lib/assistant-chat-types";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:project-assistant");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // AI : SECURITY — auth + rate limit before parsing large assistant bodies.
  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const parsed = await parseRequestJson(req, assistantRequestBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { projectId, message, history = [], stream = false } = parsed;

  const modelOrErr = parseAssistantRequestModel(parsed.model);
  if (modelOrErr instanceof NextResponse) return modelOrErr;
  const model = modelOrErr;

  const projectOrErr = requireProjectOr404(store, projectId as ProjectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;
  const project = projectOrErr;

  apiLog.info(`POST /api/project-assistant`, {
    projectId,
    messageChars: message.length,
    historyTurns: history.length,
    model,
    stream,
  });

  const trimmedHistory = trimAssistantHistory(history);

  try {
    if (!stream) {
      const result = await runBilledProjectAssistant(
        store,
        project,
        message,
        trimmedHistory,
        model,
      );
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    }

    const encoder = new TextEncoder();
    const bodyStream = new ReadableStream({
      async start(controller) {
        const push = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        try {
          const result = await runBilledProjectAssistant(
            store,
            project,
            message,
            trimmedHistory,
            model,
            {
              onThinkingDelta: (text) =>
                push({ type: ASSISTANT_STREAM_EVENT.THINKING_DELTA, text }),
              onThinkingDone: (text) =>
                push({ type: ASSISTANT_STREAM_EVENT.THINKING_DONE, text }),
              onMessageDelta: (text) =>
                push({ type: ASSISTANT_STREAM_EVENT.MESSAGE_DELTA, text }),
              onPhase: (phase) => push({ type: ASSISTANT_STREAM_EVENT.PHASE, phase }),
              onLlmResponse: (label, response) =>
                push({ type: ASSISTANT_STREAM_EVENT.LLM_RESPONSE, label, response }),
              onStructuredFailure: (detail) =>
                push({ type: ASSISTANT_STREAM_EVENT.STRUCTURED_FAILURE, ...detail }),
              onValidationFailed: (attempt, errors) =>
                push({ type: ASSISTANT_STREAM_EVENT.VALIDATION_FAILED, attempt, errors }),
            },
          );
          if (result instanceof NextResponse) {
            const errBody = await result.json().catch(() => ({ error: "Assistant billing failed" }));
            push({
              type: ASSISTANT_STREAM_EVENT.ERROR,
              error: typeof errBody.error === "string" ? errBody.error : "Assistant billing failed",
              status: result.status,
            });
            return;
          }
          push({
            type: ASSISTANT_STREAM_EVENT.DONE,
            message: result.message,
            proposal: result.proposal,
            invalidCount: result.invalidCount,
            retryCount: result.retryCount,
            validationErrors: result.validationErrors,
            billedCents: result.billedCents,
            usageCents: result.usageCents,
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

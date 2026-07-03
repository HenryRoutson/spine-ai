import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import {
  parseAssistantRequestModel,
  requireAssistantMessage,
  requireProjectOr404,
  runBilledProjectAssistant,
  trimAssistantHistory,
  type AssistantRequestBody,
} from "@/lib/server/assistant-route";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:structure-assistant");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AssistantRequestBody;
  const { projectId, message, history = [] } = body;

  const messageErr = requireAssistantMessage(message);
  if (messageErr) return messageErr;

  const modelOrErr = parseAssistantRequestModel(body.model);
  if (modelOrErr instanceof NextResponse) return modelOrErr;
  const model = modelOrErr;

  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const projectOrErr = requireProjectOr404(store, projectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;
  const project = projectOrErr;

  apiLog.info(`POST /api/structure-assistant`, {
    projectId,
    messageChars: message.length,
    historyTurns: history.length,
    model,
  });

  try {
    const result = await runBilledProjectAssistant(
      store,
      project,
      message,
      trimAssistantHistory(history),
      model,
    );
    if (result instanceof NextResponse) return result;
    return NextResponse.json({
      message: result.message,
      proposal: result.proposal ? { models: result.proposal.models } : null,
      billedCents: result.billedCents,
      usageCents: result.usageCents,
    });
  } catch (err) {
    apiLog.error(`assistant failed`, { projectId, error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

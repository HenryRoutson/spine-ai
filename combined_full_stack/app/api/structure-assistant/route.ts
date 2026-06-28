import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import {
  requireAssistantMessage,
  requireProjectOr404,
  trimAssistantHistory,
  type AssistantRequestBody,
} from "@/lib/server/assistant-route";
import { proposeStructureChange } from "@/lib/server/structure_assistant";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL } from "@/lib/server/types";

const apiLog = logger("api:structure-assistant");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AssistantRequestBody;
  const { projectId, message, history = [], model = DEFAULT_MODEL } = body;

  const messageErr = requireAssistantMessage(message);
  if (messageErr) return messageErr;

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
    const result = await proposeStructureChange(project, message.trim(), trimAssistantHistory(history), model);
    return NextResponse.json(result);
  } catch (err) {
    apiLog.error(`assistant failed`, { projectId, error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

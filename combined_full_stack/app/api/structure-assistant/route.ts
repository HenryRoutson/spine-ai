import { NextResponse, type NextRequest } from "next/server";
// AI : TODO (arch-structure-assistant) — HTTP calls runBilledProjectAssistant then strips to models;
// AI :   CLI still uses proposeStructureChange. One path.
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { assistantRequestBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  parseAssistantRequestModel,
  requireProjectOr404,
  runBilledProjectAssistant,
  trimAssistantHistory,
} from "@/lib/server/assistant-route";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:structure-assistant");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // AI : SECURITY — auth + rate limit before parsing large assistant bodies.
  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const parsed = await parseRequestJson(req, assistantRequestBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { projectId, message, history = [] } = parsed;

  const modelOrErr = parseAssistantRequestModel(parsed.model);
  if (modelOrErr instanceof NextResponse) return modelOrErr;
  const model = modelOrErr;

  const projectOrErr = requireProjectOr404(store, projectId as ProjectId, apiLog);
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

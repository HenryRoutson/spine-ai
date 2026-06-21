import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { proposePipelineChange, type ChatTurn } from "@/lib/server/pipeline_assistant";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL, type ModelId, type ProjectId } from "@/lib/server/types";

const apiLog = logger("api:pipeline-assistant");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    projectId: ProjectId;
    message: string;
    history?: ChatTurn[];
    model?: ModelId;
  };
  const { projectId, message, history = [], model = DEFAULT_MODEL } = body;

  if (!message?.trim()) return apiError("message required", 400);

  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const project = store.project(projectId);
  if (!project) {
    apiLog.warn(`unknown project`, { projectId });
    return apiError(`unknown project ${projectId}`, 404);
  }

  apiLog.info(`POST /api/pipeline-assistant`, {
    projectId,
    messageChars: message.length,
    historyTurns: history.length,
    model,
  });

  try {
    const result = await proposePipelineChange(project, message.trim(), history.slice(-8), model);
    return NextResponse.json(result);
  } catch (err) {
    apiLog.error(`assistant failed`, { projectId, error: (err as Error).message });
    return apiError((err as Error).message, 422);
  }
}

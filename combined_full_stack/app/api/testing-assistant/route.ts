import { NextResponse, type NextRequest } from "next/server";
import { docsForProject } from "@/lib/project-docs";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, MESSAGE_REQUIRED } from "@/lib/server/api-errors";
import { requireProjectOr404 } from "@/lib/server/assistant-route";
import { UnknownModelError, parseRequestModel } from "@/lib/server/model_catalog";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import { generateTestFile } from "@/lib/server/testing_assistant";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL, type ModelId, type ProjectId } from "@/lib/server/types";

const apiLog = logger("api:testing-assistant");

export const maxDuration = 120;

type TestingAssistantBody = {
  projectId: ProjectId;
  instruction: string;
  model?: ModelId;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as TestingAssistantBody;
  const { projectId, instruction } = body;

  if (!projectId?.trim()) return apiError("projectId required", HTTP.BAD_REQUEST);
  if (!instruction?.trim()) return apiError(MESSAGE_REQUIRED, HTTP.BAD_REQUEST);

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

  const projectOrErr = requireProjectOr404(store, projectId, apiLog);
  if (projectOrErr instanceof NextResponse) return projectOrErr;
  const project = projectOrErr;

  apiLog.info(`POST /api/testing-assistant`, {
    projectId,
    model,
    instructionChars: instruction.length,
  });

  try {
    await ensureModelOptionsFresh();
    const projectDocs = docsForProject(store.docs(), project);
    const generated = await generateTestFile(project, projectDocs, instruction.trim(), model);
    return NextResponse.json(generated);
  } catch (err) {
    apiLog.error(`testing assistant failed`, { projectId, error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

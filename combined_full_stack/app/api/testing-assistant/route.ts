import { NextResponse, type NextRequest } from "next/server";
import { docsForProject } from "@/lib/project-docs";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, testingAssistantBodySchema } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { requireProjectOr404 } from "@/lib/server/assistant-route";
import {
  gateAssistantBilling,
  recordAssistantBilling,
  TESTING_ASSISTANT_BILLING_CHART_KEY,
} from "@/lib/server/assistant_billing";
import { UnknownModelError, parseRequestModel } from "@/lib/server/model_catalog";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import { generateTestFile } from "@/lib/server/testing_assistant";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL, type ModelId, type ProjectId } from "@/lib/server/types";

const apiLog = logger("api:testing-assistant");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // AI : TODO security — requireAuthStore before parseRequestJson (see pipeline-assistant/route.ts).
  const body = await parseRequestJson(req, testingAssistantBodySchema);
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

  const projectOrErr = requireProjectOr404(store, body.projectId as ProjectId, apiLog);
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

  apiLog.info(`POST /api/testing-assistant`, {
    projectId: body.projectId,
    model,
    instructionChars: body.instruction.length,
  });

  const startedAt = Date.now();
  try {
    await ensureModelOptionsFresh();
    const projectDocs = docsForProject(store.docs(), project);
    const generated = await generateTestFile(project, projectDocs, body.instruction, model);
    let billedCents = 0;
    if (generated.usageCents > 0) {
      billedCents = await recordAssistantBilling(billingKey, {
        store,
        projectId: project.id,
        model,
        message: body.instruction,
        responseMessage: generated.name,
        usageCents: generated.usageCents,
        startedAt,
        chartKey: TESTING_ASSISTANT_BILLING_CHART_KEY,
      });
    }
    return NextResponse.json({ ...generated, billedCents });
  } catch (err) {
    apiLog.error(`testing assistant failed`, { projectId: body.projectId, error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

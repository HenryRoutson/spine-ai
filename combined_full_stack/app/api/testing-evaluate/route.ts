import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { UnknownModelError, parseRequestModel } from "@/lib/server/model_catalog";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import { logger } from "@/lib/server/server_logger";
import { evaluateProbabilisticFields } from "@/lib/server/test_evaluator";
import { DEFAULT_MODEL, type ModelId } from "@/lib/server/types";
import type { ProbabilisticEvalPayload } from "@/lib/testing-files";

const apiLog = logger("api:testing-evaluate");

export const maxDuration = 120;

type TestingEvaluateBody = {
  steps: ProbabilisticEvalPayload[];
  model?: ModelId;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as TestingEvaluateBody;
  const { steps } = body;

  if (!Array.isArray(steps) || !steps.length) {
    return apiError("steps array required", HTTP.BAD_REQUEST);
  }

  let model: ModelId;
  try {
    model = parseRequestModel(body.model, DEFAULT_MODEL);
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }

  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;

  apiLog.info(`POST /api/testing-evaluate`, { stepCount: steps.length, model });

  try {
    await ensureModelOptionsFresh();
    const { results, costCents } = await evaluateProbabilisticFields(steps, model);
    return NextResponse.json({ results, costCents });
  } catch (err) {
    apiLog.error(`testing evaluate failed`, { error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

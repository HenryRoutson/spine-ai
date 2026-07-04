import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, testingEvaluateBodySchema } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { assertCanStartRun, billRunUsage, getBillingUserKey } from "@/lib/server/billing_account";
import { UnknownModelError, parseRequestModel } from "@/lib/server/model_catalog";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import { logger } from "@/lib/server/server_logger";
import { evaluateProbabilisticFields } from "@/lib/server/test_evaluator";
import { DEFAULT_MODEL, type ModelId } from "@/lib/server/types";

const apiLog = logger("api:testing-evaluate");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await parseRequestJson(req, testingEvaluateBodySchema);
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

  const billingKey = await getBillingUserKey();
  try {
    await assertCanStartRun(billingKey);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    throw err;
  }

  apiLog.info(`POST /api/testing-evaluate`, { stepCount: body.steps.length, model });

  try {
    await ensureModelOptionsFresh();
    const { results, costCents } = await evaluateProbabilisticFields(body.steps, model);
    if (costCents > 0) {
      try {
        await billRunUsage(billingKey, costCents);
      } catch (billErr) {
        apiLog.warn(`testing evaluate billing failed`, { error: (billErr as Error).message });
      }
    }
    return NextResponse.json({ results, costCents });
  } catch (err) {
    apiLog.error(`testing evaluate failed`, { error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

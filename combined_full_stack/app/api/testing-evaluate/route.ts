import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, testingEvaluateBodySchema } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { parseAssistantRequestModel } from "@/lib/server/assistant-route";
import { assertCanStartRun, billRunUsage } from "@/lib/server/billing_account";
import { billingKeyForProject } from "@/lib/server/team_billing";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import { logger } from "@/lib/server/server_logger";
import { evaluateDeterministicDiffFields, evaluateProbabilisticFields } from "@/lib/server/test_evaluator";

const apiLog = logger("api:testing-evaluate");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await parseRequestJson(req, testingEvaluateBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  const modelOrErr = parseAssistantRequestModel(body.model);
  if (modelOrErr instanceof NextResponse) return modelOrErr;
  const model = modelOrErr;

  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;

  const project = body.projectId
    ? ctx.store.project(body.projectId as import("@/lib/server/types").ProjectId)
    : undefined;
  const billingKey = await billingKeyForProject(ctx.auth.userId, project ?? {});
  try {
    await assertCanStartRun(billingKey);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    throw err;
  }

  apiLog.info(`POST /api/testing-evaluate`, {
    probabilisticStepCount: body.steps?.length ?? 0,
    diffStepCount: body.diffSteps?.length ?? 0,
    model,
  });

  try {
    await ensureModelOptionsFresh();
    const probabilisticSteps = body.steps ?? [];
    const diffSteps = body.diffSteps ?? [];
    const [probabilistic, deterministic] = await Promise.all([
      probabilisticSteps.length
        ? evaluateProbabilisticFields(probabilisticSteps, model)
        : Promise.resolve({ results: [], costCents: 0 }),
      diffSteps.length
        ? evaluateDeterministicDiffFields(diffSteps, model)
        : Promise.resolve({ results: [], costCents: 0 }),
    ]);
    const costCents = +(probabilistic.costCents + deterministic.costCents).toFixed(4);
    if (costCents > 0) {
      try {
        await billRunUsage(billingKey, costCents);
      } catch (billErr) {
        apiLog.warn(`testing evaluate billing failed`, { error: (billErr as Error).message });
      }
    }
    return NextResponse.json({
      results: probabilistic.results,
      diffResults: deterministic.results,
      costCents,
    });
  } catch (err) {
    apiLog.error(`testing evaluate failed`, { error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

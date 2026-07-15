import { NextResponse, type NextRequest } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { parseRequestJson, retrievalQuestionsBodySchema } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { assertCanStartRun, billRunUsage } from "@/lib/server/billing_account";
import { billingKeyForProject } from "@/lib/server/team_billing";
import { UnknownModelError, parseRequestModel } from "@/lib/server/model_catalog";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";
import { answerRetrievalQuestion } from "@/lib/server/retrieval_questions";
import { logger } from "@/lib/server/server_logger";
import { DEFAULT_MODEL, type ModelId } from "@/lib/server/types";

const apiLog = logger("api:retrieval-questions");

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await parseRequestJson(req, retrievalQuestionsBodySchema);
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

  const project = ctx.store.project(body.projectId as import("@/lib/server/types").ProjectId);
  const billingKey = await billingKeyForProject(ctx.auth.userId, project ?? {});
  try {
    await assertCanStartRun(billingKey);
  } catch (err) {
    const billed = billingResponse(err);
    if (billed) return billed;
    throw err;
  }

  apiLog.info(`POST /api/retrieval-questions`, {
    projectId: body.projectId,
    stepLabel: body.stepLabel,
    questionChars: body.question.length,
    chunkCount: body.chunks.length,
    model,
  });

  try {
    await ensureModelOptionsFresh();
    const { answer, costCents } = await answerRetrievalQuestion(
      {
        stepLabel: body.stepLabel,
        question: body.question,
        query: body.query,
        chunks: body.chunks,
        quoteContext: body.quoteContext,
      },
      model,
    );
    if (costCents > 0) {
      try {
        await billRunUsage(billingKey, costCents);
      } catch (billErr) {
        apiLog.warn(`retrieval questions billing failed`, { error: (billErr as Error).message });
      }
    }
    return NextResponse.json({ answer, costCents });
  } catch (err) {
    apiLog.error(`retrieval questions failed`, { error: (err as Error).message });
    return apiError((err as Error).message, HTTP.UNPROCESSABLE);
  }
}

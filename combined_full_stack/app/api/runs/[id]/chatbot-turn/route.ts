import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownJob } from "@/lib/server/api-errors";
import { chatbotTurnBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { parseChatbotPrompt, type ChatbotTurn } from "@/lib/chatbot-step";
import { runChatbotAssistantTurn } from "@/lib/server/chatbot_turn";
import { getJob, openJobDb, type RunJobId } from "@/lib/server/run_jobs";
import { logger } from "@/lib/server/server_logger";
import type { ModelId } from "@/lib/server/types";
import { DEFAULT_MODEL } from "@/lib/server/types";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const apiLog = logger("api:runs:chatbot-turn");

// AI : one assistant reply while the run is paused on a chatbot client-step (does not resume).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("llm");
  if (authCtx instanceof NextResponse) return authCtx;
  const { auth, store } = authCtx;

  const { id } = await ctx.params;
  const body = await parseRequestJson(req, chatbotTurnBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  const jobId = id as RunJobId;
  const jobDb = await openJobDb();
  const job = await getJob(auth.userId, jobId, jobDb);
  if (!job) return apiError(unknownJob(id), HTTP.NOT_FOUND);
  if (!job.paused || !job.clientStep || job.clientStep.kind !== "chatbot") {
    return apiError(`job ${id} is not waiting for a chatbot session`, HTTP.CONFLICT);
  }

  let promptValue;
  try {
    promptValue = parseChatbotPrompt(job.clientStep.input);
  } catch (e) {
    return apiError((e as Error).message, HTTP.BAD_REQUEST);
  }

  const project = store.project(job.paused.projectId);
  if (!project) return apiError("project not found for paused job", HTTP.NOT_FOUND);
  const model = (job.clientStep.model ?? DEFAULT_MODEL) as ModelId;

  const transcript = body.transcript as ChatbotTurn[];
  apiLog.info(`POST chatbot-turn`, {
    jobId,
    turns: transcript.length,
    model,
  });

  try {
    const { reply, ledger } = await runChatbotAssistantTurn({
      sessionPrompt: promptValue.prompt,
      transcript,
      model,
    });
    return NextResponse.json({
      reply,
      usageCents: +ledger.totalCents().toFixed(4),
    });
  } catch (e) {
    apiLog.error(`chatbot-turn failed`, { jobId, error: (e as Error).message });
    return apiError((e as Error).message, HTTP.INTERNAL);
  }
}

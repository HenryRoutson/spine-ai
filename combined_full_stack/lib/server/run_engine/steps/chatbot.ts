import type { ModuleId, PipelineModule } from "@/lib/types"
import { requireLinearInput } from "../context"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"
import { ChatbotPendingError } from "../../run_checkpoint"
import { parseChatbotPrompt, resolveChatbotMode } from "@/lib/chatbot-step"

// AI : pause once — Inference runs turns while paused; Exit submits ChatbotResult via client-step.
export async function execChatbotStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const input = requireLinearInput(m, ctx)
  const prompt = parseChatbotPrompt(input)
  const mode = resolveChatbotMode(m.chatbotMode)
  log.info(`chatbot — deferring to inference tab`, {
    moduleId: m.id as ModuleId,
    mode,
    promptChars: prompt.prompt.length,
  })
  throw new ChatbotPendingError(input, mode, m.model, m.maxTurns)
}

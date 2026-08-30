import { NextResponse, type NextRequest } from "next/server"
import { apiError, requireAuthStore } from "@/lib/server/api_context"
import { HTTP } from "@/lib/server/api-errors"
import { assistantChatSdkRequestBodySchema, parseRequestJson } from "@/lib/server/api_schemas"
import {
  parseAssistantRequestModel,
  requireProjectOr404,
  runBilledProjectAssistant,
  trimAssistantHistory,
  MAX_ASSISTANT_MESSAGE_CHARS,
} from "@/lib/server/assistant-route"
import { assistantUiMessageStreamResponse } from "@/lib/server/assistant-ui-message-stream"
import {
  agentRequestFromUiMessages,
  type AgentUIMessage,
} from "@/lib/agent-chat-ui-messages"
import { logger } from "@/lib/server/server_logger"
import type { ProjectId } from "@/lib/server/types"
import type { ProjectProposal } from "@/lib/project-assistant-types"

const apiLog = logger("api:assistant-chat-sdk")

export const maxDuration = 120

function asUiMessages(raw: unknown[]): AgentUIMessage[] {
  return raw.filter((m): m is AgentUIMessage => {
    if (!m || typeof m !== "object") return false
    const role = (m as { role?: unknown }).role
    return role === "user" || role === "assistant" || role === "system"
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("llm")
  if (ctx instanceof NextResponse) return ctx
  const { store } = ctx

  const parsed = await parseRequestJson(req, assistantChatSdkRequestBodySchema)
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST)
  const {
    messages: rawMessages,
    projectId,
    humanSurface,
    message: extraMessage,
    uiContext,
    pendingProposal,
  } = parsed

  const modelOrErr = parseAssistantRequestModel(parsed.model)
  if (modelOrErr instanceof NextResponse) return modelOrErr
  const model = modelOrErr

  const projectOrErr = await requireProjectOr404(store, projectId as ProjectId, apiLog)
  if (projectOrErr instanceof NextResponse) return projectOrErr
  const project = projectOrErr

  const messages = asUiMessages(rawMessages)
  const extracted = agentRequestFromUiMessages(messages, {
    message: extraMessage,
    uiContext,
    pendingProposal: pendingProposal as ProjectProposal | undefined,
  })
  const trimmedHistory = trimAssistantHistory(extracted.history)

  if (extracted.message.length > MAX_ASSISTANT_MESSAGE_CHARS) {
    return apiError(`message too large (max ${MAX_ASSISTANT_MESSAGE_CHARS} chars)`, HTTP.BAD_REQUEST)
  }
  if (!extracted.message.trim() && !(extracted.uiContext?.length)) {
    return apiError("message or uiContext required", HTTP.BAD_REQUEST)
  }

  apiLog.info(`POST /api/assistant-chat-sdk`, {
    projectId,
    messageChars: extracted.message.length,
    historyTurns: trimmedHistory.length,
    uiContextCount: extracted.uiContext?.length ?? 0,
    humanSurface: humanSurface ?? "build",
    model,
  })

  const assistantOptsBase = {
    ...(extracted.uiContext?.length ? { uiContext: extracted.uiContext } : {}),
    ...(humanSurface ? { humanSurface } : {}),
    ...(extracted.pendingProposal ? { pendingProposal: extracted.pendingProposal } : {}),
  }

  return assistantUiMessageStreamResponse(messages, async (pusher) => {
    try {
      const result = await runBilledProjectAssistant(
        store,
        project,
        extracted.message,
        trimmedHistory,
        model,
        {
          ...assistantOptsBase,
          onThinkingDelta: pusher.onThinkingDelta,
          onMessageDelta: pusher.onMessageDelta,
          onPhase: pusher.onPhase,
        },
      )
      if (result instanceof NextResponse) {
        const errBody = await result.json().catch(() => ({ error: "Assistant billing failed" }))
        pusher.fail(typeof errBody.error === "string" ? errBody.error : "Assistant billing failed")
        return
      }
      pusher.finish(result)
    } catch (err) {
      apiLog.error(`assistant-chat-sdk failed`, { projectId, error: (err as Error).message })
      pusher.fail((err as Error).message)
    }
  })
}

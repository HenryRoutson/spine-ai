// AI : adapter only — does not replace proposeProjectChange / OpenRouter / billing.
// AI :
// AI : Current GUI POSTs { message, history } and reads NDJSON (thinking_delta, message_delta, done).
// AI : assistant-ui + Vercel AI SDK useChat need a UIMessage SSE stream (text-*, reasoning-*, data-*).
// AI : This file maps the existing billed agent onto that protocol so the kits are a chrome swap.
// AI :
// AI : What the kits do NOT replace (keep if you drop Current chrome):
// AI :   proposeProjectChange, structured proposal schema, validation retries, observe tools,
// AI :   vibe harness, usage ledger, client-side Approve applying the project graph,
// AI :   assistant-chats persistence, UI-context pins.
// AI :
// AI : What they could replace later:
// AI :   lib/server/llm/* OpenRouter fetch → streamText / generateObject,
// AI :   custom NDJSON in /api/project-assistant,
// AI :   AssistantChat's manual fetch + stream parser.

import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { UIMessageStreamWriter } from "ai"
import type { AgentProposalData, AgentUIMessage } from "@/lib/agent-chat-ui-messages"
import type { AssistantLoadingPhase } from "@/lib/assistant-chat-types"
import type { PipelineAssistantResult } from "@/lib/server/pipeline_assistant"
import type { ProjectProposal } from "@/lib/project-assistant-types"

export type AssistantSdkWriter = Pick<UIMessageStreamWriter<AgentUIMessage>, "write">

const REASONING_ID = "agent-reasoning"
const TEXT_ID = "agent-text"

export function createAssistantSdkStreamPusher(writer: AssistantSdkWriter) {
  let reasoningOpen = false
  let textOpen = false

  const closeReasoning = () => {
    if (!reasoningOpen) return
    writer.write({ type: "reasoning-end", id: REASONING_ID })
    reasoningOpen = false
  }

  const closeText = () => {
    if (!textOpen) return
    writer.write({ type: "text-end", id: TEXT_ID })
    textOpen = false
  }

  return {
    onThinkingDelta(delta: string) {
      if (!delta) return
      if (!reasoningOpen) {
        writer.write({ type: "reasoning-start", id: REASONING_ID })
        reasoningOpen = true
      }
      writer.write({ type: "reasoning-delta", id: REASONING_ID, delta })
    },
    onMessageDelta(delta: string) {
      if (!delta) return
      closeReasoning()
      if (!textOpen) {
        writer.write({ type: "text-start", id: TEXT_ID })
        textOpen = true
      }
      writer.write({ type: "text-delta", id: TEXT_ID, delta })
    },
    onPhase(phase: AssistantLoadingPhase) {
      writer.write({ type: "data-phase", data: { phase }, transient: true })
    },
    fail(errorText: string) {
      writer.write({ type: "error", errorText })
    },
    finish(result: Pick<
      PipelineAssistantResult,
      "message" | "proposal" | "invalidCount" | "retryCount" | "validationErrors"
    > & { billedCents?: number }) {
      closeReasoning()
      if (textOpen) {
        closeText()
      } else if (result.message) {
        writer.write({ type: "text-start", id: TEXT_ID })
        writer.write({ type: "text-delta", id: TEXT_ID, delta: result.message })
        writer.write({ type: "text-end", id: TEXT_ID })
      }
      const proposal = result.proposal as ProjectProposal | undefined
      if (proposal) {
        const data: AgentProposalData = {
          proposal,
          status: "pending",
          invalidCount: result.invalidCount,
          retryCount: result.retryCount,
          validationErrors: result.validationErrors,
        }
        writer.write({ type: "data-proposal", data })
      }
    },
  }
}

export function assistantUiMessageStreamResponse(
  originalMessages: AgentUIMessage[],
  run: (pusher: ReturnType<typeof createAssistantSdkStreamPusher>) => Promise<void>,
): Response {
  const stream = createUIMessageStream<AgentUIMessage>({
    originalMessages,
    execute: async ({ writer }) => {
      const pusher = createAssistantSdkStreamPusher(writer)
      await run(pusher)
    },
    onError: (err) => (err instanceof Error ? err.message : "Assistant request failed"),
  })
  return createUIMessageStreamResponse({ stream })
}

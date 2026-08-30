import { describe, expect, it } from "vitest"
import { createAssistantSdkStreamPusher } from "@/lib/server/assistant-ui-message-stream"
import type { AgentUIMessage } from "@/lib/agent-chat-ui-messages"
import type { InferUIMessageChunk } from "ai"

describe("assistant-ui-message-stream", () => {
  it("maps thinking then message then proposal onto UIMessage chunks", () => {
    const chunks: InferUIMessageChunk<AgentUIMessage>[] = []
    const pusher = createAssistantSdkStreamPusher({ write: (part) => chunks.push(part) })
    pusher.onPhase("thinking")
    pusher.onThinkingDelta("plan ")
    pusher.onThinkingDelta("steps")
    pusher.onMessageDelta("I'll add")
    pusher.onMessageDelta(" a parse step.")
    pusher.finish({
      message: "I'll add a parse step.",
      proposal: {
        modules: [],
        models: [],
        typeAliases: [],
        docs: [],
        documentation: "",
        changed: {
          modules: true,
          models: false,
          typeAliases: false,
          docs: false,
          documentation: false,
        },
      },
      invalidCount: 0,
      retryCount: 0,
      validationErrors: null,
    })
    expect(chunks.map((c) => c.type)).toEqual([
      "data-phase",
      "reasoning-start",
      "reasoning-delta",
      "reasoning-delta",
      "reasoning-end",
      "text-start",
      "text-delta",
      "text-delta",
      "text-end",
      "data-proposal",
    ])
    const proposal = chunks.find((c) => c.type === "data-proposal")
    expect(proposal?.type === "data-proposal" && proposal.data.status).toBe("pending")
  })

  it("emits a full text block when the agent returns without deltas", () => {
    const chunks: InferUIMessageChunk<AgentUIMessage>[] = []
    const pusher = createAssistantSdkStreamPusher({ write: (part) => chunks.push(part) })
    pusher.finish({
      message: "No pipeline change.",
      invalidCount: 0,
      retryCount: 0,
      validationErrors: null,
    })
    expect(chunks.map((c) => c.type)).toEqual(["text-start", "text-delta", "text-end"])
  })
})

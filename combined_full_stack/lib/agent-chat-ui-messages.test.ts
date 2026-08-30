import { describe, expect, it } from "vitest"
import {
  AGENT_CONTEXT_ONLY_PLACEHOLDER,
  agentRequestFromUiMessages,
  fromAgentUiMessages,
  lastPendingProposalFromStored,
  textFromUiParts,
  toAgentUiMessages,
  wireMessageFromUiText,
  withProposalStatus,
  type AgentUIMessage,
} from "@/lib/agent-chat-ui-messages"
import type { AssistantChatMessage } from "@/components/assistant-chat"
import { PROJECT_ASSISTANT_INITIAL_MESSAGE, type ProjectProposal } from "@/lib/project-assistant-types"
import { isAgentChatUiKit } from "@/lib/agent-chat-ui-settings"

function proposal(): ProjectProposal {
  return {
    modules: [],
    models: [],
    typeAliases: [],
    docs: [],
    documentation: "",
    changed: {
      modules: false,
      models: false,
      typeAliases: false,
      docs: false,
      documentation: false,
    },
  }
}

describe("agent-chat-ui-messages", () => {
  it("validates kit ids", () => {
    expect(isAgentChatUiKit("current")).toBe(true)
    expect(isAgentChatUiKit("assistant-ui")).toBe(true)
    expect(isAgentChatUiKit("ai-sdk")).toBe(true)
    expect(isAgentChatUiKit("other")).toBe(false)
  })

  it("drops canned welcome and round-trips proposal parts", () => {
    const p = proposal()
    const stored: AssistantChatMessage<ProjectProposal>[] = [
      { id: "c1-welcome", role: "assistant", content: PROJECT_ASSISTANT_INITIAL_MESSAGE },
      { id: "u1", role: "user", content: "build invoices", uiContext: [{ id: "s1", kind: "pipeline_step", label: "Parse" }] },
      {
        id: "a1",
        role: "assistant",
        content: "I'll add a parse step.",
        proposal: p,
        status: "pending",
        invalidCount: 0,
      },
    ]
    const ui = toAgentUiMessages(stored)
    expect(ui.map((m) => m.id)).toEqual(["u1", "a1"])
    expect(textFromUiParts(ui[1]?.parts)).toBe("I'll add a parse step.")
    const back = fromAgentUiMessages(ui)
    expect(back).toHaveLength(2)
    expect(back[1]?.proposal).toEqual(p)
    expect(back[1]?.status).toBe("pending")
    expect(back[0]?.uiContext?.[0]?.label).toBe("Parse")
  })

  it("extracts message + history + pending proposal for the billed route", () => {
    const p = proposal()
    const messages: AgentUIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "first" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "ok" },
          { type: "data-proposal", data: { proposal: p, status: "pending" } },
        ],
      },
      { id: "u2", role: "user", parts: [{ type: "text", text: "also add tests" }] },
    ]
    const req = agentRequestFromUiMessages(messages)
    expect(req.message).toBe("also add tests")
    expect(req.history).toHaveLength(2)
    expect(req.history[0]).toEqual({ role: "user", content: "first" })
    expect(req.pendingProposal).toEqual(p)
  })

  it("uses last user text when extras.message is empty (assistant-ui Composer)", () => {
    const req = agentRequestFromUiMessages(
      [{ id: "u1", role: "user", parts: [{ type: "text", text: "add a webhook step" }] }],
      { message: "" },
    )
    expect(req.message).toBe("add a webhook step")
  })

  it("treats the context-only placeholder as an empty wire message", () => {
    expect(wireMessageFromUiText(AGENT_CONTEXT_ONLY_PLACEHOLDER)).toBe("")
    expect(wireMessageFromUiText("  ")).toBe("")
    const req = agentRequestFromUiMessages(
      [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: AGENT_CONTEXT_ONLY_PLACEHOLDER }],
          metadata: { uiContext: [{ id: "x", kind: "generic", label: "Field" }] },
        },
      ],
      { message: "" },
    )
    expect(req.message).toBe("")
    expect(req.uiContext?.[0]?.label).toBe("Field")
  })

  it("updates proposal status in place", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "data-proposal", data: { proposal: proposal(), status: "pending" } }],
      },
    ]
    const next = withProposalStatus(messages, "a1", "approved")
    expect(proposalDataStatus(next[0]!)).toBe("approved")
    expect(lastPendingProposalFromStored([{ id: "a1", role: "assistant", content: "", proposal: proposal(), status: "pending" }])).toBeTruthy()
  })
})

function proposalDataStatus(message: AgentUIMessage): string | undefined {
  const part = message.parts.find((p) => p.type === "data-proposal")
  return part?.type === "data-proposal" ? part.data.status : undefined
}

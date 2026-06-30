import type { AssistantChatMessage } from "@/components/assistant-chat"
import { formatAssistantDebugTraceDisplay } from "@/lib/assistant-debug"
import type { AssistantStreamingDraft } from "@/lib/assistant-chat-types"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import { MODULE_META } from "@/lib/types"

function formatStreamingDraftForCopy(draft: AssistantStreamingDraft): string {
  const parts: string[] = []
  if (draft.content) parts.push(draft.content)

  const debugEntries = [...draft.debugTrace]
  const hasThinkingEntry = debugEntries.some((e) => e.kind === "thinking")
  if (draft.liveThinking && !hasThinkingEntry) {
    debugEntries.push({ kind: "thinking", text: draft.liveThinking })
  }
  if (debugEntries.length > 0) {
    parts.push(formatAssistantDebugTraceDisplay(debugEntries))
  }

  return parts.join("\n\n")
}

export function formatProjectProposalForCopy(
  msg: AssistantChatMessage<ProjectProposal>,
): string {
  const p = msg.proposal!
  const showModels = p.changed?.models ?? true
  const showModules = p.changed?.modules ?? true
  const showDocs = p.changed?.docs ?? (p.docs?.length ?? 0) > 0
  const showDocumentation = p.changed?.documentation ?? false
  const showName = p.changed?.name ?? !!p.projectName

  const lines: string[] = ["Proposed changes"]

  if (showName && p.projectName) lines.push(`rename → ${p.projectName}`)

  if (showModules) lines.push(`${p.modules.length} steps`)
  if (showModels) lines.push(`${p.models.length} models`)
  if (showDocs) lines.push(`${p.docs.length} docs`)
  if (showDocumentation) lines.push("docs tab")
  if (msg.retryCount != null && msg.retryCount > 0) lines.push(`retried ${msg.retryCount}×`)
  if (msg.invalidCount != null && msg.invalidCount > 0) lines.push(`${msg.invalidCount} invalid`)
  if (msg.status === "approved") lines.push("applied")
  if (msg.status === "rejected") lines.push("rejected")

  if (msg.validationErrors) {
    lines.push("", msg.validationErrors)
  }

  if (showModels) {
    lines.push("", "Structures", "")
    for (const model of p.models) {
      lines.push(`${model.name} · ${model.fields.length} fields`)
    }
  }

  if (showModules) {
    lines.push("", "Pipeline", "")
    for (let i = 0; i < p.modules.length; i++) {
      const step = p.modules[i]
      lines.push(`${String(i + 1).padStart(2, "0")} ${step.label} · ${MODULE_META[step.kind].label}`)
    }
  }

  if (showDocumentation) {
    lines.push("", "Project documentation", "", p.documentation.trim() || "(empty)")
  }

  if (showDocs && p.docs.length > 0) {
    lines.push("", "Test documents", "")
    for (const doc of p.docs) {
      lines.push(`${doc.name} · ${doc.label} · ${Math.round(doc.content.length / 1024)}kb`)
    }
  }

  return lines.join("\n")
}

export function formatProjectAssistantConversation(
  messages: AssistantChatMessage<ProjectProposal>[],
  streamingDraft?: AssistantStreamingDraft | null,
): string {
  const blocks: string[] = []

  for (const msg of messages) {
    if (msg.role === "user") {
      blocks.push(msg.content)
      continue
    }

    const parts = [msg.content]
    if (msg.proposal) parts.push(formatProjectProposalForCopy(msg))
    if (msg.debugTrace && msg.debugTrace.length > 0) {
      parts.push(formatAssistantDebugTraceDisplay(msg.debugTrace))
    }
    blocks.push(parts.join("\n\n"))
  }

  if (streamingDraft) {
    const draftText = formatStreamingDraftForCopy(streamingDraft)
    if (draftText) blocks.push(draftText)
  }

  return blocks.join("\n\n")
}

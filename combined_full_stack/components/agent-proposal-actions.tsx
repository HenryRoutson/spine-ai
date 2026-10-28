"use client"

import { useState, type ReactNode } from "react"
import { Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AssistantChatMessage } from "@/components/assistant-chat"
import type { ProjectProposal } from "@/lib/project-assistant-types"

export function AgentProposalCard({
  msg,
  renderProposal,
  onApprove,
  onReject,
  readOnly = false,
}: {
  msg: AssistantChatMessage<ProjectProposal>
  renderProposal: (msg: AssistantChatMessage<ProjectProposal>) => ReactNode
  onApprove: (msg: AssistantChatMessage<ProjectProposal>) => void | Promise<void>
  onReject: (msg: AssistantChatMessage<ProjectProposal>) => void | Promise<void>
  readOnly?: boolean
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null)
  if (!msg.proposal) return null
  return (
    <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      {renderProposal(msg)}
      {msg.status === "pending" && !readOnly ? (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="h-7 flex-1 gap-1.5 text-[11px]"
            disabled={busy !== null}
            onClick={() => {
              setBusy("approve")
              void Promise.resolve(onApprove(msg)).finally(() => setBusy(null))
            }}
            spineId="assistant.approve"
          >
            {busy === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 gap-1.5 text-[11px]"
            disabled={busy !== null}
            onClick={() => {
              setBusy("reject")
              void Promise.resolve(onReject(msg)).finally(() => setBusy(null))
            }}
            spineId="assistant.reject"
          >
            {busy === "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  )
}

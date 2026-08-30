"use client"

import { createContext, useContext, type ReactNode } from "react"
import {
  AuiIf,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react"
import { ArrowDown, Send, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentProposalCard } from "@/components/agent-proposal-actions"
import {
  assistantMessageFromProposal,
  textFromUiParts,
  type AgentProposalData,
} from "@/lib/agent-chat-ui-messages"
import type { AssistantChatMessage } from "@/components/assistant-chat"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import { cn } from "@/lib/utils"

type ProposalCtx = {
  renderProposal: (msg: AssistantChatMessage<ProjectProposal>) => ReactNode
  onApprove: (msg: AssistantChatMessage<ProjectProposal>) => void | Promise<void>
  onReject: (msg: AssistantChatMessage<ProjectProposal>) => void | Promise<void>
  readOnly: boolean
}

const ProposalCtx = createContext<ProposalCtx | null>(null)

function useProposalCtx(): ProposalCtx {
  const ctx = useContext(ProposalCtx)
  if (!ctx) throw new Error("ProposalCtx missing")
  return ctx
}

function ProposalDataPart({ data }: { data: AgentProposalData }) {
  const ctx = useProposalCtx()
  const messageId = useAuiState((s) => s.message.id)
  const msg = assistantMessageFromProposal(messageId, data)
  return (
    <AgentProposalCard
      msg={msg}
      renderProposal={ctx.renderProposal}
      onApprove={ctx.onApprove}
      onReject={ctx.onReject}
      readOnly={ctx.readOnly}
    />
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex w-full justify-end">
      <div className="max-w-[92%] rounded-lg border border-border/70 bg-muted/60 px-3 py-2">
        <MessagePrimitive.Parts
          components={{
            Text: () => (
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                <MessagePartPrimitive.Text />
              </p>
            ),
          }}
        />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex w-full justify-start">
      <div className="min-w-0 w-full rounded-lg border border-border/40 px-3 py-2">
        <MessagePrimitive.Parts
          components={{
            Text: () => (
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                <MessagePartPrimitive.Text />
              </p>
            ),
            Reasoning: ({ text }) =>
              text ? (
                <details className="mb-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                  <summary className="cursor-pointer font-mono text-[10px] text-muted-foreground">
                    thinking
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                    {text}
                  </p>
                </details>
              ) : null,
            data: {
              by_name: {
                proposal: ({ data }) => <ProposalDataPart data={data as AgentProposalData} />,
              },
            },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  )
}

function Composer({
  placeholder,
  disabled,
}: {
  placeholder: string
  disabled: boolean
}) {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-border bg-background px-3 py-2">
      <ComposerPrimitive.Input
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-10 max-h-40 flex-1 resize-none rounded-md border border-input bg-transparent px-2 py-2 text-xs outline-none placeholder:text-muted-foreground disabled:opacity-50"
        rows={2}
      />
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label="Stop">
            <Square className="h-4 w-4" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <Button size="icon" className="h-10 w-10 shrink-0" disabled={disabled} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </ComposerPrimitive.Send>
      </AuiIf>
    </ComposerPrimitive.Root>
  )
}

export function AssistantUiThread({
  placeholder,
  disabled,
  emptyHint,
  attachments,
  renderProposal,
  onApprove,
  onReject,
  readOnly,
}: {
  placeholder: string
  disabled: boolean
  emptyHint: string
  attachments?: ReactNode
  renderProposal: ProposalCtx["renderProposal"]
  onApprove: ProposalCtx["onApprove"]
  onReject: ProposalCtx["onReject"]
  readOnly: boolean
}) {
  return (
    <ProposalCtx.Provider value={{ renderProposal, onApprove, onReject, readOnly }}>
      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-background">
        <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
          <ThreadPrimitive.Empty>
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">{emptyHint}</p>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages>
            {({ message }) =>
              message.role === "user" ? <UserMessage /> : <AssistantMessage />
            }
          </ThreadPrimitive.Messages>
          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto">
            <ThreadPrimitive.ScrollToBottom asChild>
              <Button
                size="icon-sm"
                variant="outline"
                className="mx-auto mb-2 hidden data-[state=visible]:flex"
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
        {attachments}
        <Composer placeholder={placeholder} disabled={disabled} />
      </ThreadPrimitive.Root>
    </ProposalCtx.Provider>
  )
}

export function AiSdkMessageBubble({
  role,
  children,
  className,
}: {
  role: "user" | "assistant"
  children: ReactNode
  className?: string
}) {
  const isUser = role === "user"
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}>
      <div
        className={cn(
          "rounded-lg border px-3 py-2",
          isUser ? "max-w-[92%] border-border/70 bg-muted/60" : "min-w-0 w-full border-border/40 bg-transparent",
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function AiSdkReasoning({ text }: { text: string }) {
  if (!text) return null
  return (
    <details className="mb-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1">
      <summary className="cursor-pointer font-mono text-[10px] text-muted-foreground">thinking</summary>
      <p className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">{text}</p>
    </details>
  )
}

export { textFromUiParts }

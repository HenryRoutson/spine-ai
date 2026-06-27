"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bot, Check, Loader2, Send, Sparkles, User, X } from "lucide-react"
import { uid } from "@/lib/id"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_REQUEST_FAILED,
  type AssistantChatRole,
  type ProposalStatus,
} from "@/lib/assistant-chat-types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type AssistantChatMessage<TProposal> = {
  id: string
  role: AssistantChatRole
  content: string
  proposal?: TProposal
  status?: ProposalStatus
  invalidCount?: number
  retryCount?: number
}

type AssistantRequestResult<TProposal> = {
  message: string
  proposal?: TProposal
  invalidCount?: number
  retryCount?: number
}

type AssistantChatProps<TProposal> = {
  title: string
  subtitle: string
  initialMessage: string
  starters: string[]
  placeholder: string
  loadingLabel: string | ((phase: string) => string)
  renderProposal: (msg: AssistantChatMessage<TProposal>) => ReactNode
  onApprove: (msg: AssistantChatMessage<TProposal>) => void
  onReject: (msg: AssistantChatMessage<TProposal>) => void
  requestAssistant: (
    text: string,
    history: { role: AssistantChatRole; content: string }[],
    opts: { setLoadingPhase: (phase: string) => void },
  ) => Promise<AssistantRequestResult<TProposal>>
}

export function AssistantChat<TProposal>({
  title,
  subtitle,
  initialMessage,
  starters,
  placeholder,
  loadingLabel,
  renderProposal,
  onApprove,
  onReject,
  requestAssistant,
}: AssistantChatProps<TProposal>) {
  const [messages, setMessages] = useState<AssistantChatMessage<TProposal>[]>([
    { id: uid(), role: "assistant", content: initialMessage },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState("default")
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const pending = [...messages].reverse().find((m) => m.proposal && m.status === "pending")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, loadingPhase])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    if (pending) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pending.id && m.status === "pending" ? { ...m, status: "rejected" } : m,
        ),
      )
    }

    const userMsg: AssistantChatMessage<TProposal> = { id: uid(), role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setLoadingPhase("default")
    setError(null)

    const history = [...messages, userMsg]
      .filter((m) => m.role === "user" || (m.role === "assistant" && !m.proposal))
      .slice(-ASSISTANT_HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const data = await requestAssistant(trimmed, history, { setLoadingPhase })
      const assistantMsg: AssistantChatMessage<TProposal> = {
        id: uid(),
        role: "assistant",
        content: data.message,
        proposal: data.proposal,
        invalidCount: data.invalidCount,
        retryCount: data.retryCount,
        status: data.proposal ? "pending" : undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : ASSISTANT_REQUEST_FAILED)
    } finally {
      setLoading(false)
    }
  }

  function approve(msg: AssistantChatMessage<TProposal>) {
    if (!msg.proposal) return
    onApprove(msg)
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "approved" } : m)),
    )
  }

  function reject(msg: AssistantChatMessage<TProposal>) {
    onReject(msg)
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "rejected" } : m)),
    )
  }

  const loadingText =
    typeof loadingLabel === "function" ? loadingLabel(loadingPhase) : loadingLabel

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{subtitle}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  m.role === "user" ? "bg-secondary" : "bg-primary/10 border-primary/30",
                )}
              >
                {m.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <div
                className={cn(
                  "min-w-0 max-w-[92%] rounded-lg border px-3 py-2",
                  m.role === "user"
                    ? "border-border bg-secondary/60"
                    : "border-border bg-card",
                )}
              >
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>
                {m.proposal && (
                  <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                    {renderProposal(m)}
                    {m.status === "pending" && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 flex-1 gap-1.5 text-[11px]"
                          onClick={() => approve(m)}
                        >
                          <Check className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 gap-1.5 text-[11px]"
                          onClick={() => reject(m)}
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 px-2 font-mono text-[10px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {loadingText}
            </div>
          )}

          {error && (
            <p className="px-2 font-mono text-[10px] text-destructive">{error}</p>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {starters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder={placeholder}
            className="min-h-10 resize-none text-xs"
            rows={2}
            disabled={loading}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!input.trim() || loading}
            onClick={() => void send(input)}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

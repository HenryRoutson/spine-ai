"use client"

import { useEffect, useRef, useState } from "react"
import {
  Bot,
  Check,
  Loader2,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react"
import { uid } from "@/lib/id"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_REQUEST_FAILED,
  assistantRequestFailed,
  type AssistantChatRole,
  type ProposalStatus,
} from "@/lib/assistant-chat-types"
import { useStore } from "@/lib/store"
import type { StructureModel } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ChatRole = AssistantChatRole

type StructureProposal = {
  models: StructureModel[]
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  proposal?: StructureProposal
  status?: ProposalStatus
}

const STARTERS = [
  "Create structures for PDF legal analysis — source document, atomic rules, compliance assessment",
  "Add tuple[text,quote] fields for verbatim quotes on extracted rules",
  "Add an output model for a final compliance report with pass/fail per rule",
  "Simplify these models — merge redundant fields",
]

export function StructureAssistant() {
  const { project, models, model: globalModel, setModels } = useStore()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Describe the output structures you need — I'll propose pydantic models you can approve or reject.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const pending = [...messages].reverse().find((m) => m.proposal && m.status === "pending")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

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

    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setError(null)

    const history = [...messages, userMsg]
      .filter((m) => m.role === "user" || (m.role === "assistant" && !m.proposal))
      .slice(-ASSISTANT_HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(API_ROUTES.structureAssistant, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          message: trimmed,
          history,
          model: globalModel,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? assistantRequestFailed(res.status))

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data.message as string,
        proposal: data.proposal ?? undefined,
        status: data.proposal ? "pending" : undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : ASSISTANT_REQUEST_FAILED)
    } finally {
      setLoading(false)
    }
  }

  function approve(msg: ChatMessage) {
    if (!msg.proposal) return
    setModels(msg.proposal.models)
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "approved" } : m)),
    )
  }

  function reject(msg: ChatMessage) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "rejected" } : m)),
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Structure assistant</p>
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {models.length} models · propose → approve or reject
        </p>
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
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                        Proposed structures
                      </span>
                      <Badge variant="outline" className="font-mono text-[9px]">
                        {m.proposal.models.length} models
                      </Badge>
                      {m.status === "approved" && (
                        <Badge className="gap-1 font-mono text-[9px]">
                          <Check className="h-2.5 w-2.5" /> applied
                        </Badge>
                      )}
                      {m.status === "rejected" && (
                        <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                          rejected
                        </Badge>
                      )}
                    </div>

                    <ul className="mb-3 space-y-2">
                      {m.proposal.models.map((model) => (
                        <li key={model.id} className="rounded border border-border/60 bg-background/50 px-2.5 py-2">
                          <p className="font-mono text-[11px] text-foreground">{model.name}</p>
                          {model.description && (
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground line-clamp-2">
                              {model.description}
                            </p>
                          )}
                          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                            {model.fields.length} fields
                            {model.fields.length > 0 && (
                              <>
                                {" · "}
                                {model.fields
                                  .slice(0, 4)
                                  .map((f) => f.name)
                                  .join(", ")}
                                {model.fields.length > 4 ? "…" : ""}
                              </>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>

                    {m.status === "pending" && (
                      <div className="flex gap-2">
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
              designing structures…
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
          {STARTERS.map((s) => (
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
            placeholder="Describe the structures you want…"
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

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
  AlertTriangle,
} from "lucide-react"
import { uid } from "@/lib/id"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_REQUEST_FAILED,
  ASSISTANT_STREAM_EVENT,
  assistantRequestFailed,
  type AssistantChatRole,
  type ProposalStatus,
} from "@/lib/assistant-chat-types"
import { useStore } from "@/lib/store"
import type { PipelineModule, StructureModel } from "@/lib/types"
import { MODULE_META } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ChatRole = AssistantChatRole

type PipelineProposal = {
  modules: PipelineModule[]
  models: StructureModel[]
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  proposal?: PipelineProposal
  invalidCount?: number
  retryCount?: number
  status?: ProposalStatus
}

const STARTERS = [
  "Build a pipeline to take in GPS site locations, profile their locations, and evaluate similarities — e.g. Russian sites, research labs, cold locations",
  "Build a pipeline from scratch for PDF legal doc analysis",
  "Add a Link Quotes step after the LLM extraction",
  "Simplify this pipeline — remove unnecessary steps",
]

export function PipelineAssistant() {
  const { project, modules, models, model: globalModel, setModules, setModels } = useStore()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Describe the pipeline you want — I'll propose steps you can approve or reject. Reference your structure models by name.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<"designing" | "retrying">("designing")
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const pending = [...messages].reverse().find((m) => m.proposal && m.status === "pending")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, loadingPhase])

  async function readAssistantStream(res: Response): Promise<{
    message: string
    proposal?: PipelineProposal
    invalidCount: number
    retryCount: number
  }> {
    const reader = res.body?.getReader()
    if (!reader) throw new Error("empty response body")

    const decoder = new TextDecoder()
    let buffer = ""
    let result: {
      message: string
      proposal?: PipelineProposal
      invalidCount: number
      retryCount: number
    } | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        const evt = JSON.parse(line) as {
          type: string
          attempt?: number
          error?: string
          message?: string
          proposal?: PipelineProposal
          invalidCount?: number
          retryCount?: number
        }
        if (evt.type === ASSISTANT_STREAM_EVENT.RETRYING) setLoadingPhase("retrying")
        if (evt.type === ASSISTANT_STREAM_EVENT.ERROR) throw new Error(evt.error ?? ASSISTANT_REQUEST_FAILED)
        if (evt.type === ASSISTANT_STREAM_EVENT.DONE) {
          result = {
            message: evt.message ?? "",
            proposal: evt.proposal ?? undefined,
            invalidCount: evt.invalidCount ?? 0,
            retryCount: evt.retryCount ?? 0,
          }
        }
      }
    }

    if (!result) throw new Error("Assistant stream ended without a result")
    return result
  }

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
    setLoadingPhase("designing")
    setError(null)

    const history = [...messages, userMsg]
      .filter((m) => m.role === "user" || (m.role === "assistant" && !m.proposal))
      .slice(-ASSISTANT_HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(API_ROUTES.pipelineAssistant, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          message: trimmed,
          history,
          model: globalModel,
          stream: true,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? assistantRequestFailed(res.status))
      }

      const data = await readAssistantStream(res)

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data.message as string,
        proposal: data.proposal ?? undefined,
        invalidCount: data.invalidCount ?? 0,
        retryCount: data.retryCount ?? 0,
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
    setModules(msg.proposal.modules)
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
          <p className="text-sm font-medium">Pipeline assistant</p>
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {modules.length} steps · {models.length} models · propose → approve or reject
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
                        Proposed pipeline
                      </span>
                      <Badge variant="outline" className="font-mono text-[9px]">
                        {m.proposal.modules.length} steps
                      </Badge>
                      {m.retryCount != null && m.retryCount > 0 && (
                        <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                          retried {m.retryCount}×
                        </Badge>
                      )}
                      {m.invalidCount != null && m.invalidCount > 0 && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-destructive/50 font-mono text-[9px] text-destructive"
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {m.invalidCount} invalid
                        </Badge>
                      )}
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

                    <ol className="mb-3 space-y-1">
                      {m.proposal.modules.map((step, i) => (
                        <li
                          key={step.id}
                          className="flex items-baseline gap-2 font-mono text-[10px] text-muted-foreground"
                        >
                          <span className="text-foreground/50">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-foreground">{step.label}</span>
                          <span>· {MODULE_META[step.kind].label}</span>
                        </li>
                      ))}
                    </ol>

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
              {loadingPhase === "retrying" ? "retrying…" : "designing pipeline…"}
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
            placeholder="Describe the pipeline you want…"
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

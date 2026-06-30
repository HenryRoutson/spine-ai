"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bot, Check, Loader2, Send, Sparkles, User, X } from "lucide-react"
import { uid } from "@/lib/id"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_REQUEST_FAILED,
  type AssistantChatRole,
  type AssistantDebugEntry,
  type AssistantLoadingPhase,
  type ProposalStatus,
} from "@/lib/assistant-chat-types"
import { appendAssistantDebugEntry } from "@/lib/assistant-debug"
import { buildAssistantHistory } from "@/lib/assistant-history"
import { AssistantDebugPanel } from "@/components/assistant-debug-panel"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// AI : shared chat bubble styling so live streaming matches completed messages.
const USER_AVATAR_CLASS = "border-border bg-secondary"
const ASSISTANT_AVATAR_CLASS = "border-sky-400/40 bg-sky-500/25"
const USER_BUBBLE_CLASS = "border-border bg-secondary/70"
const ASSISTANT_BUBBLE_CLASS = "border-sky-500/35 bg-sky-500/20"

export type AssistantChatMessage<TProposal> = {
  id: string
  role: AssistantChatRole
  content: string
  proposal?: TProposal
  status?: ProposalStatus
  invalidCount?: number
  retryCount?: number
  validationErrors?: string | null
  debugTrace?: AssistantDebugEntry[]
}

type AssistantRequestResult<TProposal> = {
  message: string
  proposal?: TProposal
  invalidCount?: number
  retryCount?: number
  validationErrors?: string | null
  debugTrace?: AssistantDebugEntry[]
}

type AssistantChatProps<TProposal> = {
  title: string
  subtitle: string
  initialMessage: string
  starters: string[]
  placeholder: string
  loadingLabel: string | ((phase: AssistantLoadingPhase) => string)
  showDebug?: boolean
  renderProposal: (msg: AssistantChatMessage<TProposal>) => ReactNode
  onApprove: (msg: AssistantChatMessage<TProposal>) => void | Promise<void>
  onReject: (msg: AssistantChatMessage<TProposal>) => void
  requestAssistant: (
    text: string,
    history: { role: AssistantChatRole; content: string }[],
    opts: {
      setLoadingPhase: (phase: AssistantLoadingPhase) => void
      onThinkingDelta: (delta: string) => void
      onMessageDelta: (delta: string) => void
      onDebugEntry: (entry: AssistantDebugEntry) => void
    },
  ) => Promise<AssistantRequestResult<TProposal>>
  /** AI : shared session — when set, chat history persists across tab mounts */
  messages?: AssistantChatMessage<TProposal>[]
  onMessagesChange?: React.Dispatch<React.SetStateAction<AssistantChatMessage<TProposal>[]>>
}

export function AssistantChat<TProposal>({
  title,
  subtitle,
  initialMessage,
  starters,
  placeholder,
  loadingLabel,
  showDebug = false,
  renderProposal,
  onApprove,
  onReject,
  requestAssistant,
  messages: controlledMessages,
  onMessagesChange,
}: AssistantChatProps<TProposal>) {
  const [internalMessages, setInternalMessages] = useState<AssistantChatMessage<TProposal>[]>([
    { id: uid(), role: "assistant", content: initialMessage },
  ])
  const messages = controlledMessages ?? internalMessages
  const setMessages = onMessagesChange ?? setInternalMessages
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<AssistantLoadingPhase>("thinking")
  const [liveThinking, setLiveThinking] = useState("")
  const [liveResponse, setLiveResponse] = useState("")
  const [debugTrace, setDebugTrace] = useState<AssistantDebugEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [errorDebugTrace, setErrorDebugTrace] = useState<AssistantDebugEntry[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const pending = [...messages].reverse().find((m) => m.proposal && m.status === "pending")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, loadingPhase, liveThinking, debugTrace])

  function handleDebugEntry(entry: AssistantDebugEntry) {
    setDebugTrace((prev) => appendAssistantDebugEntry(prev, entry))
    if (entry.kind === "thinking") setLiveThinking("")
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

    const userMsg: AssistantChatMessage<TProposal> = { id: uid(), role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setLoadingPhase("thinking")
    setLiveThinking("")
    setLiveResponse("")
    setDebugTrace([])
    setError(null)
    setErrorDebugTrace([])

    const history = buildAssistantHistory([...messages, userMsg], ASSISTANT_HISTORY_LIMIT)

    try {
      const data = await requestAssistant(trimmed, history, {
        setLoadingPhase,
        onThinkingDelta: (delta) => setLiveThinking((prev) => prev + delta),
        onMessageDelta: (delta) => setLiveResponse((prev) => prev + delta),
        onDebugEntry: handleDebugEntry,
      })
      const assistantMsg: AssistantChatMessage<TProposal> = {
        id: uid(),
        role: "assistant",
        content: data.message,
        proposal: data.proposal,
        invalidCount: data.invalidCount,
        retryCount: data.retryCount,
        validationErrors: data.validationErrors,
        debugTrace: data.debugTrace,
        status: data.proposal ? "pending" : undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const msg = err instanceof Error ? err.message : ASSISTANT_REQUEST_FAILED
      setError(msg)
      setDebugTrace((trace) => {
        const next = appendAssistantDebugEntry(trace, { kind: "error", error: msg })
        setErrorDebugTrace(next)
        return next
      })
    } finally {
      setLoading(false)
      setLiveThinking("")
      setLiveResponse("")
    }
  }

  async function approve(msg: AssistantChatMessage<TProposal>) {
    if (!msg.proposal || approvingId) return
    setApprovingId(msg.id)
    try {
      await onApprove(msg)
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "approved" } : m)),
      )
    } catch (err) {
      const approveErr = err instanceof Error ? err.message : "Failed to apply proposal"
      setError(approveErr)
    } finally {
      setApprovingId(null)
    }
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
                  m.role === "user" ? USER_AVATAR_CLASS : ASSISTANT_AVATAR_CLASS,
                )}
              >
                {m.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-sky-300" />
                )}
              </div>
              <div
                className={cn(
                  "min-w-0 max-w-[92%] rounded-lg border px-3 py-2",
                  m.role === "user" ? USER_BUBBLE_CLASS : ASSISTANT_BUBBLE_CLASS,
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
                          disabled={approvingId === m.id}
                          onClick={() => void approve(m)}
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
                {showDebug && m.debugTrace && m.debugTrace.length > 0 && (
                  <AssistantDebugPanel
                    entries={m.debugTrace}
                    className="mt-3 border-sky-400/25 bg-sky-950/35"
                  />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 flex-row">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  ASSISTANT_AVATAR_CLASS,
                )}
              >
                <Bot className="h-3.5 w-3.5 text-sky-300" />
              </div>
              <div
                className={cn(
                  "min-w-0 max-w-[92%] space-y-3 rounded-lg border px-3 py-2",
                  ASSISTANT_BUBBLE_CLASS,
                )}
              >
                {showDebug && (debugTrace.length > 0 || liveThinking) ? (
                  <AssistantDebugPanel
                    entries={debugTrace}
                    liveThinking={liveThinking}
                    thinkingActive={loadingPhase === "thinking"}
                    className="border-sky-400/25 bg-sky-950/35"
                  />
                ) : liveThinking ? (
                  <div>
                    <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-sky-200/70">
                      Thinking
                    </p>
                    <p className="max-h-40 overflow-y-auto font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground/80">
                      {liveThinking}
                      {loadingPhase === "thinking" && (
                        <span className="inline-block animate-pulse text-sky-300">▍</span>
                      )}
                    </p>
                  </div>
                ) : null}
                {liveResponse && (
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    {liveResponse}
                    <span className="inline-block animate-pulse text-sky-300">▍</span>
                  </p>
                )}
                <div className="flex items-center gap-2 font-mono text-[10px] text-sky-200/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {loadingText}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-2 px-2">
              <p className="font-mono text-[10px] text-destructive">{error}</p>
              {showDebug && errorDebugTrace.length > 0 && (
                <AssistantDebugPanel entries={errorDebugTrace} />
              )}
            </div>
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

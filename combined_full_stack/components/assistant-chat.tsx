"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bot, Check, Loader2, MessageSquarePlus, Mic, Send, Sparkles, User, X } from "lucide-react"
import { uid } from "@/lib/id"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_REQUEST_FAILED,
  type AssistantChatMessageExtras,
  type AssistantChatRole,
  type AssistantDebugEntry,
  type AssistantLoadingPhase,
  type AssistantStreamingDraft,
  type FeedbackInputMode,
  type ProposalStatus,
  type UserFeedbackPayload,
} from "@/lib/assistant-chat-types"
import { FEEDBACK_INPUT_MODES, feedbackModeAllowsVoice } from "@/lib/feedback-types"
import { useChatInputMode, writeChatInputMode } from "@/lib/chat-settings"
import { useVoiceInput } from "@/lib/use-voice-input"
import { FeedbackInput } from "@/components/feedback-input"
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
} & AssistantChatMessageExtras

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
  onReject: (msg: AssistantChatMessage<TProposal>) => void | Promise<void>
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
  /** AI : mirrors in-flight stream for conversation copy while loading */
  onStreamingDraftChange?: React.Dispatch<React.SetStateAction<AssistantStreamingDraft | null>>
  /** AI : actions tied to the active agent instance (e.g. copy conversation) */
  headerActions?: ReactNode
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
  onStreamingDraftChange,
  headerActions,
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
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [responseFeedbackForId, setResponseFeedbackForId] = useState<string | null>(null)
  const [responseFeedbackDraft, setResponseFeedbackDraft] = useState<UserFeedbackPayload | undefined>()
  const [composeMode, setComposeMode] = useState<FeedbackInputMode>("text")
  const savedChatInputMode = useChatInputMode()
  const voiceCompose = useVoiceInput()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setComposeMode(savedChatInputMode)
  }, [savedChatInputMode])

  const pending = [...messages].reverse().find((m) => m.proposal && m.status === "pending")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, loadingPhase, liveThinking, debugTrace])

  const emptyStreamingDraft = (): AssistantStreamingDraft => ({
    content: "",
    liveThinking: "",
    debugTrace: [],
  })

  function handleDebugEntry(entry: AssistantDebugEntry) {
    setDebugTrace((prev) => appendAssistantDebugEntry(prev, entry))
    if (entry.kind === "thinking") setLiveThinking("")
    onStreamingDraftChange?.((draft) => {
      const base = draft ?? emptyStreamingDraft()
      const debugTrace = appendAssistantDebugEntry(base.debugTrace, entry)
      return {
        ...base,
        debugTrace,
        liveThinking: entry.kind === "thinking" ? "" : base.liveThinking,
      }
    })
  }

  async function send(text: string, opts?: { inputMode?: FeedbackInputMode }) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    if (pending) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pending.id && m.status === "pending" ? { ...m, status: "rejected" } : m,
        ),
      )
    }

    const userMsg: AssistantChatMessage<TProposal> = {
      id: uid(),
      role: "user",
      content: trimmed,
      inputMode: opts?.inputMode,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    voiceCompose.reset()
    setLoading(true)
    setLoadingPhase("thinking")
    setLiveThinking("")
    setLiveResponse("")
    setDebugTrace([])
    setError(null)
    setErrorDebugTrace([])
    onStreamingDraftChange?.(emptyStreamingDraft())

    const history = buildAssistantHistory([...messages, userMsg], ASSISTANT_HISTORY_LIMIT)

    try {
      const data = await requestAssistant(trimmed, history, {
        setLoadingPhase,
        onThinkingDelta: (delta) => {
          setLiveThinking((prev) => prev + delta)
          onStreamingDraftChange?.((draft) => ({
            ...(draft ?? emptyStreamingDraft()),
            liveThinking: (draft?.liveThinking ?? "") + delta,
          }))
        },
        onMessageDelta: (delta) => {
          setLiveResponse((prev) => prev + delta)
          onStreamingDraftChange?.((draft) => ({
            ...(draft ?? emptyStreamingDraft()),
            content: (draft?.content ?? "") + delta,
          }))
        },
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
      onStreamingDraftChange?.(null)
    }
  }

  async function approve(msg: AssistantChatMessage<TProposal>) {
    if (!msg.proposal || approvingId || rejectingId) return
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

  async function reject(msg: AssistantChatMessage<TProposal>) {
    if (!msg.proposal || approvingId || rejectingId) return
    setRejectingId(msg.id)
    try {
      await Promise.resolve(onReject(msg))
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "rejected" } : m)),
      )
    } finally {
      setRejectingId(null)
    }
  }

  function saveResponseFeedback(messageId: string, feedback: UserFeedbackPayload) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, responseFeedback: feedback } : m)),
    )
    setResponseFeedbackForId(null)
    setResponseFeedbackDraft(undefined)
  }

  const composeUsesVoice = composeMode === "voice" || composeMode === "both"
  const composeUsesText = composeMode === "text" || composeMode === "both"
  const voiceDraft = voiceCompose.transcript.trim()
  const canSend =
    (composeUsesText && input.trim()) || (composeUsesVoice && voiceDraft.length > 0)

  function handleSendCompose() {
    const body = composeUsesVoice && !input.trim() ? voiceDraft : input
    const mode: FeedbackInputMode =
      composeMode === "both"
        ? voiceDraft && !input.trim()
          ? "voice"
          : "text"
        : composeMode
    void send(body, { inputMode: mode })
  }

  const loadingText =
    typeof loadingLabel === "function" ? loadingLabel(loadingPhase) : loadingLabel

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <p className="truncate text-sm font-medium">{title}</p>
          </div>
          {headerActions}
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
                {m.role === "user" && m.inputMode && m.inputMode !== "text" && (
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                    via {m.inputMode === "voice" ? "voice" : "text or voice"}
                  </p>
                )}
                {m.role === "assistant" && m.responseFeedback && (
                  <p className="mt-2 rounded border border-border/60 bg-background/40 px-2 py-1 font-mono text-[9px] text-muted-foreground">
                    Feedback ({m.responseFeedback.mode}): {m.responseFeedback.text}
                  </p>
                )}
                {m.role === "assistant" && !loading && (
                  <div className="mt-2">
                    {responseFeedbackForId === m.id ? (
                      <div className="rounded-md border border-border/70 bg-background/30 p-2">
                        <FeedbackInput
                          mode="both"
                          prompt="Optional feedback on this response"
                          onChange={setResponseFeedbackDraft}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-[10px]"
                            disabled={!responseFeedbackDraft?.text.trim()}
                            onClick={() => {
                              if (responseFeedbackDraft) saveResponseFeedback(m.id, responseFeedbackDraft)
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px]"
                            onClick={() => {
                              setResponseFeedbackForId(null)
                              setResponseFeedbackDraft(undefined)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-1.5 text-[10px] text-muted-foreground"
                        onClick={() => {
                          setResponseFeedbackForId(m.id)
                          setResponseFeedbackDraft(m.responseFeedback)
                        }}
                      >
                        <MessageSquarePlus className="h-3 w-3" />
                        {m.responseFeedback ? "Edit feedback" : "Feedback"}
                      </Button>
                    )}
                  </div>
                )}
                {m.proposal && (
                  <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                    {renderProposal(m)}
                    {m.status === "pending" && (
                      // AI : todo — approve/reject settle animations (checkmark flash, slide-out)
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 flex-1 gap-1.5 text-[11px]"
                          disabled={approvingId === m.id || rejectingId === m.id}
                          onClick={() => void approve(m)}
                        >
                          {approvingId === m.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 gap-1.5 text-[11px]"
                          disabled={approvingId === m.id || rejectingId === m.id}
                          onClick={() => void reject(m)}
                        >
                          {rejectingId === m.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
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

      <div className="border-t border-border p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {FEEDBACK_INPUT_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={loading}
              onClick={() => {
                setComposeMode(m.value)
                writeChatInputMode(m.value)
              }}
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[9px] transition-colors",
                composeMode === m.value
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {composeUsesText && (
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendCompose()
                }
              }}
              placeholder={placeholder}
              className="min-h-10 resize-none text-xs"
              rows={2}
              disabled={loading}
            />
          )}
          {composeUsesVoice && feedbackModeAllowsVoice(composeMode) && (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {!composeUsesText && (
                <div className="min-h-10 rounded-md border border-input bg-background px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap">
                  {voiceDraft || "Tap record and speak…"}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant={voiceCompose.listening ? "destructive" : "outline"}
                className="h-8 w-fit gap-1.5 text-[10px]"
                disabled={loading || !voiceCompose.supported}
                onClick={voiceCompose.toggle}
              >
                {voiceCompose.listening ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                {voiceCompose.listening ? "Stop" : "Record"}
              </Button>
            </div>
          )}
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!canSend || loading}
            onClick={handleSendCompose}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

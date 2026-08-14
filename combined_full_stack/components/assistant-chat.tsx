"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Check, Loader2, Sparkles, X } from "lucide-react"
import { uid } from "@/lib/id"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_REQUEST_FAILED,
  type AssistantChatRole,
  type AssistantDebugEntry,
  type AssistantLoadingPhase,
  type AssistantStreamingDraft,
  type ProposalStatus,
} from "@/lib/assistant-chat-types"
import { appendAssistantDebugEntry } from "@/lib/assistant-debug"
import { buildAssistantHistory } from "@/lib/assistant-history"
import {
  composeMessageWithPastes,
  typedTextFromComposedMessage,
  type PastedAttachment,
} from "@/lib/pasted-attachment"
import type { AssistantMentionOption } from "@/lib/assistant-mentions"
import type { UiContextRef } from "@/lib/ui-context-types"
import { AssistantDebugPanel } from "@/components/assistant-debug-panel"
import { ChatQuoteSelection } from "@/components/chat-quote-selection"
import { UiContextChip } from "@/components/ui-context-chip"
import { Button } from "@/components/ui/button"
import {
  Chat,
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleContent,
  ChatHeader,
  ChatInput,
  ChatList,
  ChatMessage,
  ChatTypingIndicator,
  PastedChip,
} from "@/components/ui/chat"

// AI : pastes: Cursor-style chips via @assistant-ui/react SimpleTextAttachmentAdapter; wire form uses <pasted>.
export type AssistantChatMessage<TProposal> = {
  id: string
  role: AssistantChatRole
  content: string
  /** AI : paste chips for bubble UI; content already includes <pasted> for the LLM / history. */
  pastes?: PastedAttachment[]
  /** AI : UI picks pinned at send — shown as chips in the bubble (also sent as uiContext[]). */
  uiContext?: UiContextRef[]
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
  onReject: (msg: AssistantChatMessage<TProposal>) => void | Promise<void>
  requestAssistant: (
    text: string,
    history: { role: AssistantChatRole; content: string }[],
    opts: {
      setLoadingPhase: (phase: AssistantLoadingPhase) => void
      onThinkingDelta: (delta: string) => void
      onMessageDelta: (delta: string) => void
      onDebugEntry: (entry: AssistantDebugEntry) => void
      /** AI : snapshot of pins at send — avoid racing clearUiContextPins */
      uiContext?: UiContextRef[]
    },
  ) => Promise<AssistantRequestResult<TProposal>>
  /** AI : shared session — when set, chat history persists across tab mounts */
  messages?: AssistantChatMessage<TProposal>[]
  onMessagesChange?: React.Dispatch<React.SetStateAction<AssistantChatMessage<TProposal>[]>>
  /** AI : mirrors in-flight stream for conversation copy while loading */
  onStreamingDraftChange?: React.Dispatch<React.SetStateAction<AssistantStreamingDraft | null>>
  /** AI : resume loading UI after remount (e.g. local→server chat id migrate). */
  resumeBusy?: boolean
  resumeStreamingDraft?: AssistantStreamingDraft | null
  /** AI : survives panel close — parent can track busy state for header affordance */
  onLoadingChange?: (loading: boolean) => void
  /** AI : actions tied to the active agent instance (e.g. copy conversation) */
  headerActions?: ReactNode
  /** AI : ui-context / paste chips row above the textarea */
  composerAttachments?: ReactNode
  /** AI : live pins from select mode — snapshotted onto the user message at send */
  uiContextPins?: UiContextRef[]
  /** AI : true when chips alone are enough to send */
  canSendWithoutText?: boolean
  /** AI : clear pins after a successful turn */
  onComposerAttachmentsConsumed?: () => void
  /** AI : @ mention menu (steps / models / files / Select UI). */
  mentionOptions?: AssistantMentionOption[]
  onMentionPick?: (option: AssistantMentionOption) => void
  /** AI : paperclip upload — project docs + pin as project_doc. */
  onFilesSelected?: (files: File[]) => void
  filesUploading?: boolean
  /** AI : highlight chat → Quote chip (same pin path as Select UI). */
  onPinUiContext?: (ref: UiContextRef) => void
  /** AI : teammate chats on shared projects — view only */
  readOnly?: boolean
  readOnlyHint?: string
  /** AI : Vibe trims chrome — hide bubble avatars */
  showAvatars?: boolean
  /** AI : Vibe hides Agent title / stats — Copy lives on the dock header */
  showHeaderMeta?: boolean
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
  resumeBusy = false,
  resumeStreamingDraft = null,
  onLoadingChange,
  headerActions,
  composerAttachments,
  uiContextPins = [],
  canSendWithoutText = false,
  onComposerAttachmentsConsumed,
  mentionOptions,
  onMentionPick,
  onFilesSelected,
  filesUploading = false,
  onPinUiContext,
  readOnly = false,
  readOnlyHint,
  showAvatars = true,
  showHeaderMeta = true,
}: AssistantChatProps<TProposal>) {
  const [internalMessages, setInternalMessages] = useState<AssistantChatMessage<TProposal>[]>([
    { id: uid(), role: "assistant", content: initialMessage },
  ])
  const messages = controlledMessages ?? internalMessages
  const setMessages = onMessagesChange ?? setInternalMessages
  const [input, setInput] = useState("")
  const [pastes, setPastes] = useState<PastedAttachment[]>([])
  // AI : hydrate from session when remounting a still-streaming agent tab.
  const [loading, setLoadingState] = useState(resumeBusy)
  const setLoading = (value: boolean) => {
    setLoadingState(value)
    onLoadingChange?.(value)
  }
  const [loadingPhase, setLoadingPhase] = useState<AssistantLoadingPhase>("thinking")
  const [liveThinking, setLiveThinking] = useState(resumeStreamingDraft?.liveThinking ?? "")
  const [liveResponse, setLiveResponse] = useState(resumeStreamingDraft?.content ?? "")
  const [debugTrace, setDebugTrace] = useState<AssistantDebugEntry[]>(
    resumeStreamingDraft?.debugTrace ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [errorDebugTrace, setErrorDebugTrace] = useState<AssistantDebugEntry[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const quoteRootRef = useRef<HTMLDivElement>(null)

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

  async function send(text: string, sendPastes: PastedAttachment[] = pastes) {
    if (readOnly) return
    const composed = composeMessageWithPastes(text, sendPastes)
    if (loading) return
    if (!composed.trim() && !canSendWithoutText) return

    if (pending) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pending.id && m.status === "pending" ? { ...m, status: "rejected" } : m,
        ),
      )
    }

    // AI : snapshot pins at send so clearUiContextPins / race can't drop them from the request.
    const pinsAtSend = uiContextPins
    // AI : chips-only + ui-context can send with empty typed text; keep a visible bubble label.
    const displayContent =
      composed.trim() ||
      (pinsAtSend.length > 0 || canSendWithoutText ? "(selected UI context)" : "")
    if (!displayContent) return

    const userMsg: AssistantChatMessage<TProposal> = {
      id: uid(),
      role: "user",
      content: displayContent,
      pastes: sendPastes.length > 0 ? sendPastes : undefined,
      uiContext: pinsAtSend.length > 0 ? pinsAtSend : undefined,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setPastes([])
    setLoading(true)
    setLoadingPhase("thinking")
    setLiveThinking("")
    setLiveResponse("")
    setDebugTrace([])
    setError(null)
    setErrorDebugTrace([])
    onStreamingDraftChange?.(emptyStreamingDraft())

    const history = buildAssistantHistory(messages, ASSISTANT_HISTORY_LIMIT)
    // AI : API message is wire form (includes <pasted>); empty typed + ui-context still sends "".
    const apiMessage = composed.trim() ? composed : text.trim()

    try {
      const data = await requestAssistant(apiMessage, history, {
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
        uiContext: pinsAtSend,
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
      onComposerAttachmentsConsumed?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ASSISTANT_REQUEST_FAILED
      setError(msg)
      // AI : drop optimistic bubble + restore composer so retry isn't a duplicate send.
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setPastes(sendPastes)
      setInput(text)
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

  const loadingText =
    typeof loadingLabel === "function" ? loadingLabel(loadingPhase) : loadingLabel

  const starterFooter =
    messages.length <= 1 && !loading ? (
      <div className="flex flex-wrap gap-1.5 px-3 pt-2">
        {starters.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s, [])}
            className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    ) : null

  const quoteEnabled = Boolean(onPinUiContext) && !readOnly

  return (
    <Chat className="h-full">
      {showHeaderMeta || headerActions ? (
        <ChatHeader>
          {showHeaderMeta ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <p className="truncate text-sm font-medium">{title}</p>
                </div>
                {headerActions}
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{subtitle}</p>
            </>
          ) : (
            <div className="flex items-center justify-end gap-2">{headerActions}</div>
          )}
        </ChatHeader>
      ) : null}

      <ChatQuoteSelection
        enabled={quoteEnabled}
        containerRef={quoteRootRef}
        onQuote={(ref) => onPinUiContext?.(ref)}
      >
          <ChatList>
            {messages.map((m) => {
              const variant = m.role === "user" ? "user" : "assistant"
              const typed =
                m.role === "user" && m.pastes?.length
                  ? typedTextFromComposedMessage(m.content, m.pastes)
                  : m.content
              return (
                <ChatMessage key={m.id} variant={variant}>
                  {showAvatars ? <ChatBubbleAvatar variant={variant} /> : null}
                  <ChatBubble variant={variant}>
                    {m.role === "user" &&
                    ((m.pastes && m.pastes.length > 0) ||
                      (m.uiContext && m.uiContext.length > 0)) ? (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {m.uiContext?.map((pin) => (
                          <UiContextChip key={pin.id} pin={pin} />
                        ))}
                        {m.pastes?.map((p) => (
                          <PastedChip key={p.id} attachment={p} />
                        ))}
                      </div>
                    ) : null}
                    {typed ? <ChatBubbleContent>{typed}</ChatBubbleContent> : null}
                    {m.proposal && (
                      <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                        {renderProposal(m)}
                        {m.status === "pending" && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 flex-1 gap-1.5 text-[11px]"
                              disabled={approvingId === m.id || rejectingId === m.id}
                              onClick={() => void approve(m)}
                              spineId="assistant.approve"
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
                              spineId="assistant.reject"
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
                        className="mt-3 border-border/50 bg-muted/30"
                        showCopyButton={false}
                      />
                    )}
                  </ChatBubble>
                </ChatMessage>
              )
            })}

            {loading && (
              <ChatMessage variant="assistant">
                {showAvatars ? <ChatBubbleAvatar variant="assistant" /> : null}
                <ChatBubble variant="assistant" className="space-y-3">
                  {showDebug && (debugTrace.length > 0 || liveThinking) ? (
                    <AssistantDebugPanel
                      entries={debugTrace}
                      liveThinking={liveThinking}
                      thinkingActive={loadingPhase === "thinking"}
                      className="border-border/50 bg-muted/30"
                      showCopyButton={false}
                    />
                  ) : liveThinking ? (
                    <p className="max-h-40 overflow-y-auto font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground/80">
                      {liveThinking}
                      {loadingPhase === "thinking" && (
                        <span className="inline-block animate-pulse text-muted-foreground">▍</span>
                      )}
                    </p>
                  ) : null}
                  {liveResponse && (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">
                      {liveResponse}
                      <span className="inline-block animate-pulse text-muted-foreground">▍</span>
                    </p>
                  )}
                  {/* AI : skip "thinking…" spinner when the stream itself is already visible. */}
                  {!(liveThinking && loadingPhase === "thinking") && (
                    <ChatTypingIndicator label={loadingText} />
                  )}
                </ChatBubble>
              </ChatMessage>
            )}

            {error && (
              <div className="space-y-2 px-2">
                <p className="font-mono text-[10px] text-destructive">{error}</p>
                {showDebug && errorDebugTrace.length > 0 && (
                  <AssistantDebugPanel entries={errorDebugTrace} showCopyButton={false} />
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </ChatList>
      </ChatQuoteSelection>

      <ChatInput
        value={input}
        onChange={setInput}
        pastes={pastes}
        onPastesChange={setPastes}
        onSend={() => void send(input, pastes)}
        placeholder={readOnly ? (readOnlyHint ?? "View only — this is a teammate's chat") : placeholder}
        disabled={loading || readOnly}
        footer={readOnly ? undefined : starterFooter}
        attachments={readOnly ? undefined : composerAttachments}
        canSend={
          !readOnly && (Boolean(input.trim()) || pastes.length > 0 || canSendWithoutText)
        }
        mentionOptions={readOnly ? undefined : mentionOptions}
        onMentionPick={readOnly ? undefined : onMentionPick}
        onFilesSelected={readOnly ? undefined : onFilesSelected}
        filesUploading={filesUploading}
      />
    </Chat>
  )
}

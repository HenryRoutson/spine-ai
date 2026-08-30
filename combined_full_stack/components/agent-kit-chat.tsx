"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { AssistantRuntimeProvider } from "@assistant-ui/react"
import { useAISDKRuntime } from "@assistant-ui/ai-sdk"
import type { AssistantChatMessage } from "@/components/assistant-chat"
import {
  Chat,
  ChatInput,
  ChatTypingIndicator,
} from "@/components/ui/chat"
import { AgentProposalCard } from "@/components/agent-proposal-actions"
import {
  AiSdkMessageBubble,
  AiSdkReasoning,
  AssistantUiThread,
} from "@/components/assistant-ui/thread"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import {
  AGENT_CONTEXT_ONLY_PLACEHOLDER,
  assistantMessageFromProposal,
  fromAgentUiMessages,
  lastPendingProposalFromStored,
  proposalDataFromUiParts,
  reasoningFromUiParts,
  textFromUiParts,
  toAgentUiMessages,
  withProposalStatus,
  type AgentUIMessage,
} from "@/lib/agent-chat-ui-messages"
import type { AgentChatUiKit } from "@/lib/agent-chat-ui-settings"
import type { AssistantLoadingPhase, AssistantStreamingDraft } from "@/lib/assistant-chat-types"
import type { AssistantMentionOption } from "@/lib/assistant-mentions"
import { composeMessageWithPastes, type PastedAttachment } from "@/lib/pasted-attachment"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type { UiContextRef } from "@/lib/ui-context-types"
import { withProposalReviewFrom, liveProposalReviewFrom } from "@/lib/project-assistant-proposal"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export type AgentKitChatProps = {
  kit: Exclude<AgentChatUiKit, "current">
  chatId: string
  projectId: string
  model: string
  humanSurface: "vibe" | "build"
  simple?: boolean
  readOnly?: boolean
  readOnlyHint?: string
  placeholder: string
  initialMessage: string
  loadingLabel: string | ((phase: AssistantLoadingPhase) => string)
  messages: AssistantChatMessage<ProjectProposal>[]
  onMessagesChange: React.Dispatch<React.SetStateAction<AssistantChatMessage<ProjectProposal>[]>>
  onStreamingDraftChange?: React.Dispatch<React.SetStateAction<AssistantStreamingDraft | null>>
  onLoadingChange?: (loading: boolean) => void
  uiContextPins?: UiContextRef[]
  canSendWithoutText?: boolean
  onComposerAttachmentsConsumed?: () => void
  mentionOptions?: AssistantMentionOption[]
  onMentionPick?: (option: AssistantMentionOption) => void
  onFilesSelected?: (files: File[]) => void
  filesUploading?: boolean
  composerAttachments?: ReactNode
  onApprove: (msg: AssistantChatMessage<ProjectProposal>) => void | Promise<void>
  onReject: (msg: AssistantChatMessage<ProjectProposal>) => void | Promise<void>
  renderProposal: (msg: AssistantChatMessage<ProjectProposal>) => ReactNode
}

type SdkExtras = {
  message: string
  uiContext?: UiContextRef[]
  pendingProposal?: ProjectProposal | null
}

export function AgentKitChat(props: AgentKitChatProps) {
  const extrasRef = useRef<SdkExtras>({ message: "" })
  const { models, modules, typeAliases } = useStore()
  const reviewFrom = liveProposalReviewFrom({ models, modules, typeAliases })

  const initialUi = useMemo(
    () => toAgentUiMessages(props.messages),
    // AI : seed once per agent tab — live updates come from useChat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chatId],
  )
  const hydratedChatIdRef = useRef<string | null>(null)

  extrasRef.current = {
    message: extrasRef.current.message,
    uiContext: props.uiContextPins,
    pendingProposal: lastPendingProposalFromStored(props.messages) ?? null,
  }

  const chat = useChat<AgentUIMessage>({
    id: props.chatId,
    messages: initialUi,
    transport: new DefaultChatTransport<AgentUIMessage>({
      api: API_ROUTES.assistantChatSdk,
      credentials: "same-origin",
      headers: JSON_HEADERS,
      prepareSendMessagesRequest: ({ messages, body }) => {
        const extras = extrasRef.current
        return {
          body: {
            id: props.chatId,
            messages,
            projectId: props.projectId,
            model: props.model,
            humanSurface: props.humanSurface,
            ...(extras.message ? { message: extras.message } : {}),
            ...(extras.uiContext?.length ? { uiContext: extras.uiContext } : {}),
            ...(extras.pendingProposal ? { pendingProposal: extras.pendingProposal } : {}),
            ...body,
          },
        }
      },
    }),
    onFinish: ({ messages }) => {
      const next = fromAgentUiMessages(messages).map((m) =>
        m.proposal ? { ...m, proposal: withProposalReviewFrom(m.proposal, reviewFrom) } : m,
      )
      props.onMessagesChange(next)
      props.onComposerAttachmentsConsumed?.()
    },
  })

  const [phase, setPhase] = useState<AssistantLoadingPhase>("thinking")
  const [input, setInput] = useState("")
  const [pastes, setPastes] = useState<PastedAttachment[]>([])

  // AI : Persist hydrate can land after first paint; seed the kit once per chat.
  useEffect(() => {
    if (hydratedChatIdRef.current === props.chatId) return
    if (props.messages.length === 0) return
    if (chat.messages.length > 0) {
      hydratedChatIdRef.current = props.chatId
      return
    }
    chat.setMessages(toAgentUiMessages(props.messages))
    hydratedChatIdRef.current = props.chatId
  }, [chat.messages.length, chat.setMessages, props.chatId, props.messages])

  const busy = chat.status === "submitted" || chat.status === "streaming"
  const onLoadingChangeRef = useRef(props.onLoadingChange)
  onLoadingChangeRef.current = props.onLoadingChange
  const lastBusyRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (lastBusyRef.current === busy) return
    lastBusyRef.current = busy
    onLoadingChangeRef.current?.(busy)
  }, [busy])

  useEffect(() => {
    if (!busy) {
      props.onStreamingDraftChange?.(null)
      return
    }
    const last = chat.messages.at(-1)
    if (last?.role !== "assistant") return
    props.onStreamingDraftChange?.({
      content: textFromUiParts(last.parts),
      liveThinking: reasoningFromUiParts(last.parts),
      debugTrace: [],
    })
  }, [busy, chat.messages, props.onStreamingDraftChange])

  useEffect(() => {
    const last = chat.messages.at(-1)
    if (!last) return
    for (const p of last.parts) {
      if (p.type === "data-phase") setPhase(p.data.phase)
    }
  }, [chat.messages])

  async function sendFromComposer(text: string, sendPastes: PastedAttachment[]) {
    if (props.readOnly || busy) return
    const composed = composeMessageWithPastes(text, sendPastes)
    const pins = props.uiContextPins ?? []
    if (!composed.trim() && !pins.length && !props.canSendWithoutText) return
    const wire = composed.trim()
    extrasRef.current = {
      message: wire,
      uiContext: pins,
      pendingProposal: lastPendingProposalFromStored(props.messages) ?? null,
    }
    setInput("")
    setPastes([])
    await chat.sendMessage({
      text: wire || AGENT_CONTEXT_ONLY_PLACEHOLDER,
      metadata: {
        ...(sendPastes.length ? { pastes: sendPastes } : {}),
        ...(pins.length ? { uiContext: pins } : {}),
      },
    })
  }

  async function approve(msg: AssistantChatMessage<ProjectProposal>) {
    const next = msg.proposal
      ? { ...msg, proposal: withProposalReviewFrom(msg.proposal, reviewFrom) }
      : msg
    await props.onApprove(next)
    chat.setMessages((prev) => withProposalStatus(prev, msg.id, "approved"))
    props.onMessagesChange((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "approved" as const, proposal: next.proposal } : m)),
    )
  }

  async function reject(msg: AssistantChatMessage<ProjectProposal>) {
    await Promise.resolve(props.onReject(msg))
    chat.setMessages((prev) => withProposalStatus(prev, msg.id, "rejected"))
    props.onMessagesChange((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "rejected" as const } : m)),
    )
  }

  const loadingText =
    typeof props.loadingLabel === "function" ? props.loadingLabel(phase) : props.loadingLabel
  const placeholder = props.readOnly
    ? (props.readOnlyHint ?? "View only — this is a teammate's chat")
    : props.placeholder
  const composer = props.readOnly ? undefined : props.composerAttachments

  if (props.kit === "assistant-ui") {
    return (
      <AssistantUiAgentChat
        chat={chat}
        placeholder={placeholder}
        disabled={props.readOnly === true}
        emptyHint={props.initialMessage}
        attachments={composer}
        renderProposal={props.renderProposal}
        onApprove={(m) => void approve(m)}
        onReject={(m) => void reject(m)}
        readOnly={props.readOnly === true}
        error={chat.error?.message}
      />
    )
  }

  return (
    <Chat className="h-full">
      <div className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {chat.messages.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">{props.initialMessage}</p>
        ) : null}
        {chat.messages.map((m) => {
          if (m.role !== "user" && m.role !== "assistant") return null
          const text = textFromUiParts(m.parts)
          const reasoning = reasoningFromUiParts(m.parts)
          const proposal = proposalDataFromUiParts(m.parts)
          return (
            <AiSdkMessageBubble key={m.id} role={m.role}>
              {m.role === "assistant" ? <AiSdkReasoning text={reasoning} /> : null}
              {text ? (
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{text}</p>
              ) : null}
              {proposal ? (
                <AgentProposalCard
                  msg={assistantMessageFromProposal(m.id, proposal, text)}
                  renderProposal={props.renderProposal}
                  onApprove={(msg) => void approve(msg)}
                  onReject={(msg) => void reject(msg)}
                  readOnly={props.readOnly}
                />
              ) : null}
            </AiSdkMessageBubble>
          )
        })}
        {busy ? <ChatTypingIndicator label={loadingText} /> : null}
        {chat.error ? (
          <p className="font-mono text-[10px] text-destructive">{chat.error.message}</p>
        ) : null}
      </div>
      <ChatInput
        value={input}
        onChange={setInput}
        pastes={pastes}
        onPastesChange={setPastes}
        onSend={() => void sendFromComposer(input, pastes)}
        placeholder={placeholder}
        disabled={props.readOnly}
        sendBusy={busy}
        attachments={composer}
        canSend={
          !props.readOnly &&
          (Boolean(input.trim()) || pastes.length > 0 || Boolean(props.canSendWithoutText))
        }
        mentionOptions={props.readOnly ? undefined : props.mentionOptions}
        onMentionPick={props.readOnly ? undefined : props.onMentionPick}
        onFilesSelected={props.readOnly ? undefined : props.onFilesSelected}
        filesUploading={props.filesUploading}
        submitOnEnter={false}
      />
    </Chat>
  )
}

function AssistantUiAgentChat({
  chat,
  placeholder,
  disabled,
  emptyHint,
  attachments,
  renderProposal,
  onApprove,
  onReject,
  readOnly,
  error,
}: {
  chat: ReturnType<typeof useChat<AgentUIMessage>>
  placeholder: string
  disabled: boolean
  emptyHint: string
  attachments?: ReactNode
  renderProposal: AgentKitChatProps["renderProposal"]
  onApprove: AgentKitChatProps["onApprove"]
  onReject: AgentKitChatProps["onReject"]
  readOnly: boolean
  error?: string
}) {
  const runtime = useAISDKRuntime(chat)
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={cn("flex h-full min-h-0 flex-col")}>
        {error ? <p className="px-3 py-1 font-mono text-[10px] text-destructive">{error}</p> : null}
        <AssistantUiThread
          placeholder={placeholder}
          disabled={disabled}
          emptyHint={emptyHint}
          attachments={attachments}
          renderProposal={renderProposal}
          onApprove={onApprove}
          onReject={onReject}
          readOnly={readOnly}
        />
      </div>
    </AssistantRuntimeProvider>
  )
}

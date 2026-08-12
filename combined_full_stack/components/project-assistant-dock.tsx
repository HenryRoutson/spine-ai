"use client"

import { useMemo, useRef, useState } from "react"
import { Check, Copy, Crosshair, History, Loader2, Plus, Sparkles, X } from "lucide-react"
import { ProjectAssistant } from "@/components/project-assistant"
import { Button } from "@/components/ui/button"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
import { DeleteButton } from "@/components/delete-button"
import { copyTextToClipboard } from "@/lib/clipboard"
import { formatProjectAssistantConversation } from "@/lib/format-project-assistant-copy"
import {
  chatOwnerLabel,
  formatChatDate,
  groupChatsByMonth,
  useProjectAssistant,
  useProjectAssistantSession,
  type AssistantChatSummary,
} from "@/lib/project-assistant-context"
import { PROJECT_ASSISTANT_INITIAL_MESSAGE } from "@/lib/project-assistant-types"
import { useStore } from "@/lib/store"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import { UI_CONTEXT_ATTR } from "@/lib/ui-context-dom"
import { cn } from "@/lib/utils"

export function ProjectAssistantDockToggle() {
  const { open, toggle } = useProjectAssistant()
  const { project } = useStore()
  const { anyAssistantBusy } = useProjectAssistantSession(project.id, PROJECT_ASSISTANT_INITIAL_MESSAGE)

  return (
    <Button
      type="button"
      size="sm"
      variant={open ? "secondary" : "outline"}
      onClick={toggle}
      aria-label="Agent"
      title={anyAssistantBusy && !open ? "Agent (running in background)" : "Agent"}
      className="relative shrink-0 font-mono text-[11px]"
    >
      {anyAssistantBusy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      Agent
    </Button>
  )
}

type ProjectAssistantDockPanelProps = {
  // AI : Vibe embeds agent full-pane — no dock chrome / close / Select UI.
  embedded?: boolean
}

export function ProjectAssistantDockPanel({ embedded = false }: ProjectAssistantDockPanelProps) {
  const { toggle, setSelectMode, selectMode, toggleSelectMode, uiContextPins } =
    useProjectAssistant()
  const { project } = useStore()
  const {
    chats,
    openChatIds,
    activeChatId,
    chatsLoading,
    selectChat,
    newChat,
    closeOpenChat,
    deleteChat,
    activeChatIsMine,
    messages,
    streamingDraft,
    getChatBindings,
  } = useProjectAssistantSession(project.id, PROJECT_ASSISTANT_INITIAL_MESSAGE)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversationCopied, setConversationCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<AssistantChatSummary>()
  const displayChats = mergeWithGhosts(chats)
  const activeChat =
    chats.find((c) => c.id === activeChatId) ??
    (activeChatId ? chats.find((c) => c.id === getChatBindings(activeChatId).chatId) : undefined)
  const ownerSubtitle =
    activeChat && !activeChatIsMine ? `${chatOwnerLabel(activeChat)}'s chat` : null
  const conversationCopyText = useMemo(
    () => formatProjectAssistantConversation(messages, streamingDraft),
    [messages, streamingDraft],
  )

  async function copyConversation() {
    await copyTextToClipboard(conversationCopyText)
    setConversationCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setConversationCopied(false), COPY_FEEDBACK_MS)
  }

  function tabTitle(tabId: string): string {
    const bindings = getChatBindings(tabId)
    const summary =
      chats.find((c) => c.id === bindings.chatId) ?? chats.find((c) => c.id === tabId)
    return summary?.title?.trim() || "New agent"
  }

  function tabBusy(tabId: string): boolean {
    return getChatBindings(tabId).assistantBusy
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-background",
        !embedded && "border-l border-border shadow-xl",
      )}
      {...{ [UI_CONTEXT_ATTR.ignore]: "" }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Agent</p>
          {ownerSubtitle ? (
            <p className="truncate font-mono text-[9px] text-muted-foreground">{ownerSubtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {/* AI : Vibe has sparse Select UI targets — keep Select on dock/build only. */}
          {!embedded ? (
            <Button
              type="button"
              size="sm"
              variant={selectMode ? "secondary" : "outline"}
              className="h-7 gap-1 px-2 font-mono text-[10px]"
              onClick={toggleSelectMode}
              aria-label={selectMode ? "Exit select UI mode" : "Select UI for agent"}
              title={selectMode ? "Exit select UI mode (Esc)" : "Select UI for agent"}
            >
              <Crosshair className="h-3.5 w-3.5" />
              {selectMode ? "Selecting…" : "Select"}
              {uiContextPins.length > 0 ? (
                <span className="rounded bg-primary/20 px-1 text-[9px]">{uiContextPins.length}</span>
              ) : null}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 font-mono text-[9px]"
            onClick={() => void copyConversation()}
            title="Copy full conversation (human + agent + debug)"
          >
            {conversationCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {conversationCopied ? "Copied" : "Copy"}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={historyOpen ? "secondary" : "ghost"}
            onClick={() => setHistoryOpen((v) => !v)}
            aria-label="Chat history"
            title="Chat history"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              newChat()
              setHistoryOpen(false)
            }}
            aria-label="New agent"
            title="New agent"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {!embedded ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setSelectMode(false)
                toggle()
              }}
              aria-label="Close assistant"
              title="Close assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* AI : horizontal open-agent tabs — multiple agents can stream at once. */}
      <div className="flex items-stretch border-b border-border">
        <div className="app-scrollbar flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto px-1 py-1">
          {openChatIds.length === 0 ? (
            <p className="px-2 py-1 font-mono text-[10px] text-muted-foreground">No open agents</p>
          ) : (
            openChatIds.map((tabId) => {
              const active = tabId === activeChatId
              const busy = tabBusy(tabId)
              return (
                <div
                  key={tabId}
                  className={cn(
                    "group flex max-w-[11rem] shrink-0 items-center rounded-md border",
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:border-border hover:bg-secondary/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      selectChat(tabId)
                      setHistoryOpen(false)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left"
                    title={tabTitle(tabId)}
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-mono text-[10px] text-foreground">
                      {tabTitle(tabId)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mr-0.5 rounded p-1 text-muted-foreground opacity-70 hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                    aria-label={`Close ${tabTitle(tabId)}`}
                    title="Close tab"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeOpenChat(tabId)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })
          )}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="m-1 shrink-0"
          onClick={() => {
            newChat()
            setHistoryOpen(false)
          }}
          aria-label="New agent tab"
          title="New agent tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {historyOpen && (
        <div className="app-scrollbar max-h-56 overflow-y-auto border-b border-border bg-secondary/20 px-2 py-2">
          <p className="mb-2 px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            History
          </p>
          {chatsLoading && chats.length === 0 ? (
            <p className="px-1 font-mono text-[10px] text-muted-foreground">Loading…</p>
          ) : chats.length === 0 ? (
            <p className="px-1 font-mono text-[10px] text-muted-foreground">No saved chats yet.</p>
          ) : (
            <div className="space-y-3">
              {groupChatsByMonth(displayChats).map((group) => (
                <div key={group.monthKey}>
                  <p className="sticky top-0 z-10 mb-1.5 border-b border-border/60 bg-secondary/20 px-1 pb-1 font-mono text-[9px] tracking-wider text-muted-foreground">
                    {group.monthLabel}
                  </p>
                  <ul className="space-y-1">
                    {group.chats.map((chat) => {
                      const deleting = isDeleting(chat.id)
                      const exiting = isExiting(chat.id)
                      const open = openChatIds.some(
                        (id) => id === chat.id || getChatBindings(id).chatId === chat.id,
                      )
                      return (
                        <AnimatedRemovalItem
                          key={chat.id}
                          itemId={chat.id}
                          isExiting={exiting}
                          className={cn("flex items-stretch gap-1", deleting && "opacity-60")}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              selectChat(chat.id)
                              setHistoryOpen(false)
                            }}
                            className={cn(
                              "min-w-0 flex-1 rounded-md border px-2 py-1.5 text-left transition-colors",
                              open && activeChatId && getChatBindings(activeChatId).chatId === chat.id
                                ? "border-primary/40 bg-primary/5"
                                : open
                                  ? "border-border bg-background/60"
                                  : "border-transparent hover:border-border hover:bg-background/80",
                            )}
                          >
                            <p className="truncate font-mono text-[10px] text-foreground">{chat.title}</p>
                            <p className="font-mono text-[9px] text-muted-foreground">
                              {chatOwnerLabel(chat)} · {formatChatDate(chat.updatedAt)} ·{" "}
                              {chat.messageCount} msgs
                              {open ? " · open" : ""}
                            </p>
                          </button>
                          {chat.isMine ? (
                            <DeleteButton
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              deleting={deleting}
                              label={`Delete chat ${chat.title}`}
                              title="Delete chat"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                void runDelete(chat, displayChats, () => deleteChat(chat.id))
                              }}
                            />
                          ) : null}
                        </AnimatedRemovalItem>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {/* AI : keep each open agent mounted (hidden) so parallel streams keep running. */}
        {openChatIds.map((tabId) => (
          <div
            key={tabId}
            className={cn(
              "absolute inset-0 min-h-0",
              tabId === activeChatId ? "z-10" : "pointer-events-none z-0 invisible",
            )}
            aria-hidden={tabId !== activeChatId}
          >
            <ProjectAssistant chatId={tabId} />
          </div>
        ))}
      </div>
    </div>
  )
}

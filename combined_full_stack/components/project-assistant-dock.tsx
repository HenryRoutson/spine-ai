"use client"

import { useState } from "react"
import { Crosshair, History, Loader2, Plus, Sparkles, X } from "lucide-react"
import { ProjectAssistant } from "@/components/project-assistant"
import { Button } from "@/components/ui/button"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
import { DeleteButton } from "@/components/delete-button"
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
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import { UI_CONTEXT_ATTR } from "@/lib/ui-context-dom"
import { cn } from "@/lib/utils"

export function ProjectAssistantDockToggle() {
  const { open, toggle } = useProjectAssistant()
  const { project } = useStore()
  const { assistantBusy } = useProjectAssistantSession(project.id, PROJECT_ASSISTANT_INITIAL_MESSAGE)

  return (
    <Button
      type="button"
      size="sm"
      variant={open ? "secondary" : "outline"}
      onClick={toggle}
      aria-label="Agent"
      title={assistantBusy && !open ? "Agent (running in background)" : "Agent"}
      className="relative shrink-0 font-mono text-[11px]"
    >
      {assistantBusy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      Agent
    </Button>
  )
}

export function ProjectAssistantDockPanel() {
  const { toggle, setSelectMode, selectMode, toggleSelectMode, uiContextPins } =
    useProjectAssistant()
  const { project } = useStore()
  const { chats, activeChatId, chatsLoading, selectChat, newChat, deleteChat, activeChatIsMine } =
    useProjectAssistantSession(project.id, PROJECT_ASSISTANT_INITIAL_MESSAGE)
  const [historyOpen, setHistoryOpen] = useState(false)
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<AssistantChatSummary>()
  const displayChats = mergeWithGhosts(chats)
  const activeChat = chats.find((c) => c.id === activeChatId)
  const ownerSubtitle =
    activeChat && !activeChatIsMine ? `${chatOwnerLabel(activeChat)}'s chat` : null

  return (
    <div
      className="flex h-full min-h-0 flex-col border-l border-border bg-background shadow-xl"
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
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
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
        </div>
      </div>

      {historyOpen && (
        <div className="app-scrollbar max-h-48 overflow-y-auto border-b border-border bg-secondary/20 px-2 py-2">
          <p className="mb-2 px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Previous chats
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
                              chat.id === activeChatId
                                ? "border-primary/40 bg-primary/5"
                                : "border-transparent hover:border-border hover:bg-background/80",
                            )}
                          >
                            <p className="truncate font-mono text-[10px] text-foreground">{chat.title}</p>
                            <p className="font-mono text-[9px] text-muted-foreground">
                              {chatOwnerLabel(chat)} · {formatChatDate(chat.updatedAt)} ·{" "}
                              {chat.messageCount} msgs
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

      <div className="min-h-0 flex-1">
        <ProjectAssistant />
      </div>
    </div>
  )
}
"use client"

import { useState } from "react"
import { Check, Copy, History, Plus, Sparkles, Trash2, X } from "lucide-react"
import { ProjectAssistant } from "@/components/project-assistant"
import { Button } from "@/components/ui/button"
import {
  formatChatDate,
  useProjectAssistant,
  useProjectAssistantSession,
} from "@/lib/project-assistant-context"
import { PROJECT_ASSISTANT_INITIAL_MESSAGE } from "@/lib/project-assistant-types"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function ProjectAssistantDock() {
  const { open, toggle } = useProjectAssistant()
  const { project } = useStore()
  const { messages, chats, activeChatId, chatsLoading, selectChat, newChat, deleteChat } =
    useProjectAssistantSession(project.id, PROJECT_ASSISTANT_INITIAL_MESSAGE)
  const [copied, setCopied] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function copyConversation() {
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`)
      .join("\n\n")
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant={open ? "secondary" : "outline"}
        onClick={toggle}
        aria-label="Project assistant"
        title="Project assistant"
        className="shrink-0"
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full sm:max-w-md flex-col border-l border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              project assistant
            </p>
            <div className="flex items-center gap-1">
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
                onClick={copyConversation}
                aria-label="Copy conversation"
                title="Copy conversation"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={toggle}
                aria-label="Close assistant"
                title="Close assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {historyOpen && (
            <div className="max-h-48 overflow-y-auto border-b border-border bg-secondary/20 px-2 py-2">
              <p className="mb-2 px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Previous chats
              </p>
              {chatsLoading && chats.length === 0 ? (
                <p className="px-1 font-mono text-[10px] text-muted-foreground">Loading…</p>
              ) : chats.length === 0 ? (
                <p className="px-1 font-mono text-[10px] text-muted-foreground">No saved chats yet.</p>
              ) : (
                <ul className="space-y-1">
                  {chats.map((chat) => (
                    <li key={chat.id} className="flex items-stretch gap-1">
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
                          {formatChatDate(chat.updatedAt)} · {chat.messageCount} msgs
                        </p>
                      </button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === chat.id}
                        aria-label={`Delete chat ${chat.title}`}
                        title="Delete chat"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingId(chat.id)
                          void deleteChat(chat.id).finally(() => setDeletingId(null))
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className={cn("min-h-0 flex-1")}>
            <ProjectAssistant />
          </div>
        </div>
      )}
    </>
  )
}

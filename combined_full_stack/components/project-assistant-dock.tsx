"use client"

import { useState } from "react"
import { Check, Copy, Sparkles } from "lucide-react"
import { ProjectAssistant } from "@/components/project-assistant"
import { Button } from "@/components/ui/button"
import { useProjectAssistant } from "@/lib/project-assistant-context"
import { PROJECT_ASSISTANT_INITIAL_MESSAGE } from "@/lib/project-assistant-types"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function ProjectAssistantDock() {
  const { open, toggle, getSession } = useProjectAssistant()
  const { project } = useStore()
  const { messages } = getSession(project.id, PROJECT_ASSISTANT_INITIAL_MESSAGE)
  const [copied, setCopied] = useState(false)

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
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              project assistant
            </p>
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
          </div>
          <div className={cn("min-h-0 flex-1")}>
            <ProjectAssistant />
          </div>
        </div>
      )}
    </>
  )
}

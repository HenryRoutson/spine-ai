"use client"

import { Sparkles, X } from "lucide-react"
import { ProjectAssistant } from "@/components/project-assistant"
import { Button } from "@/components/ui/button"
import { useProjectAssistant } from "@/lib/project-assistant-context"
import { cn } from "@/lib/utils"

export function ProjectAssistantDock() {
  const { open, setOpen, toggle } = useProjectAssistant()

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
              onClick={() => setOpen(false)}
              aria-label="Close project assistant"
            >
              <X className="h-4 w-4" />
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

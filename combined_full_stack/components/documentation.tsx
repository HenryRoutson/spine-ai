"use client"

// AI : project-level documentation panel — content is prepended to every assistant/agent prompt
// AI : so the model always sees the rules/constraints before proposing changes.

import { useCallback, useRef, useState } from "react"
import { Save, Eye, Pencil, Columns2 } from "lucide-react"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { MarkdownView } from "@/components/highlight"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type TabId = "edit" | "preview" | "split"

const PLACEHOLDER = `# Project rules

Write anything the agent must always respect — these constraints are injected at the top of every assistant call.

## Examples

- Output structure names must stay in PascalCase
- Never remove the \`confidence\` field from any model
- The pipeline must always end with a single Output step
- Don't add new input steps without asking first
`

export function Documentation() {
  const { documentation, setDocumentation } = useStore()

  // AI : local draft — only persisted on explicit save (avoids a PUT on every keystroke)
  const [draft, setDraft] = useState(documentation)
  const [tab, setTab] = useState<TabId>("edit")
  const [saved, setSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = draft !== documentation

  const handleSave = useCallback(() => {
    setDocumentation(draft)
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
  }, [draft, setDocumentation])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="· / Docs"
        title="Documentation"
        description="Project rules and context — prepended to every agent prompt to prevent regressions."
        actions={
          <Button
            size="sm"
            variant={isDirty ? "default" : "outline"}
            onClick={handleSave}
            disabled={!isDirty && !saved}
            className="gap-1.5 font-mono text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            {saved && !isDirty ? "saved" : "save"}
          </Button>
        }
      />

      {/* tab bar */}
      <div className="flex items-center gap-1 border-b border-border px-4">
        {([
          { id: "edit", icon: <Pencil className="h-3 w-3" />, label: "edit" },
          { id: "preview", icon: <Eye className="h-3 w-3" />, label: "preview" },
          { id: "split", icon: <Columns2 className="h-3 w-3" />, label: "split" },
        ] as { id: TabId; icon: React.ReactNode; label: string }[]).map(({ id, icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 font-mono text-xs capitalize transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {icon}
            {label}
          </button>
        ))}
        {isDirty && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">unsaved</span>
        )}
      </div>

      {/* panels */}
      <div className="flex flex-1 overflow-hidden">
        {tab !== "preview" && (
          <textarea
            className={cn(
              "resize-none bg-background p-5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none",
              tab === "split" ? "w-1/2 border-r border-border" : "flex-1",
            )}
            placeholder={PLACEHOLDER}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck
          />
        )}
        {tab !== "edit" && (
          <div className={cn("overflow-auto p-5", tab === "split" ? "w-1/2" : "flex-1")}>
            {draft.trim() ? (
              <MarkdownView md={draft} />
            ) : (
              <p className="font-mono text-xs text-muted-foreground/50">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

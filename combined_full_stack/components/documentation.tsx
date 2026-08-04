"use client"

// AI : project-level documentation panel — content is prepended to every assistant/agent prompt
// AI : so the model always sees the rules/constraints before proposing changes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Save, Eye, Pencil, Columns2, Maximize2, X } from "lucide-react"
import { WindowHeader } from "@/components/window-header"
import { windowPanelHeader } from "@/lib/window-panel-meta"
import { Button } from "@/components/ui/button"
import { MarkdownView } from "@/components/highlight"
import { PanelLoading } from "@/components/panel-loading"
import { useStore } from "@/lib/store"
import { derivePipelineMermaid } from "@/lib/pipeline-mermaid"
import { ResizableSplit } from "@/components/resizable-split"
import { docsEditorSplit } from "@/lib/layout-split-settings"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { cn } from "@/lib/utils"

const NOTES_EDITOR_CLASS =
  "h-full min-h-0 w-full resize-none bg-black p-5 font-mono text-xs leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none"
const NOTES_PREVIEW_CLASS = "min-h-0 flex-1 overflow-auto bg-black p-5 text-white"
const NOTES_EMPTY_CLASS = "font-mono text-xs text-neutral-500"

const MermaidView = dynamic(
  () => import("@/components/mermaid-view").then((m) => ({ default: m.MermaidView })),
  { ssr: false, loading: () => <PanelLoading label="loading pipeline graph…" /> },
)

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
  const { documentation, setDocumentation, modules, models } = useStore()
  const pipelineMermaid = useMemo(() => derivePipelineMermaid(modules, models, "dark"), [modules, models])

  // AI : local draft — only persisted on explicit save (avoids a PUT on every keystroke)
  const [draft, setDraft] = useState(documentation)
  const [tab, setTab] = useState<TabId>("edit")
  const [saved, setSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = draft !== documentation
  const { width: editorWidth, setWidth: setEditorWidth, commitWidth: commitEditorWidth } =
    usePersistedLeadingWidth(docsEditorSplit)

  const handleSave = useCallback(() => {
    setDocumentation(draft)
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
  }, [draft, setDocumentation])

  const [graphFullscreen, setGraphFullscreen] = useState(false)
  const closeGraphFullscreen = useCallback(() => setGraphFullscreen(false), [])

  useEffect(() => {
    if (!graphFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeGraphFullscreen()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [graphFullscreen, closeGraphFullscreen])

  useEffect(() => {
    if (!graphFullscreen) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [graphFullscreen])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        {...windowPanelHeader("docs")}
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

      {modules.length > 0 && (
        <div className="shrink-0 border-b border-neutral-800 bg-black px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <h2 className="font-mono text-xs font-medium text-white">Pipeline structure</h2>
              <span className="font-mono text-[10px] text-neutral-500">derived · mermaid</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 border-neutral-700 bg-black font-mono text-[10px] text-white hover:bg-neutral-900 hover:text-white"
              onClick={() => setGraphFullscreen(true)}
              title="View pipeline graph full screen"
            >
              <Maximize2 className="h-3 w-3" />
              full screen
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-black p-4">
            <MermaidView chart={pipelineMermaid} />
          </div>
        </div>
      )}

      {graphFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-white">Pipeline structure</p>
              <p className="font-mono text-[10px] text-neutral-500">derived · mermaid · Esc to close</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 text-neutral-400 hover:bg-neutral-900 hover:text-white"
              onClick={closeGraphFullscreen}
              title="Close full screen"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
            <MermaidView chart={pipelineMermaid} className="w-full max-w-[min(100%,1400px)]" />
          </div>
        </div>
      )}

      {/* panels */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {tab === "split" ? (
          <ResizableSplit
            className="min-h-0 flex-1"
            leadingWidth={editorWidth}
            onLeadingWidthChange={setEditorWidth}
            onLeadingWidthCommit={commitEditorWidth}
            minLeading={docsEditorSplit.min}
            maxLeading={docsEditorSplit.max}
            leading={
              <textarea
                className={NOTES_EDITOR_CLASS}
                placeholder={PLACEHOLDER}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck
              />
            }
            trailing={
              <div className={NOTES_PREVIEW_CLASS}>
                {draft.trim() ? (
                  <MarkdownView md={draft} inverted />
                ) : (
                  <p className={NOTES_EMPTY_CLASS}>Nothing to preview yet.</p>
                )}
              </div>
            }
          />
        ) : (
          <>
            {tab === "edit" && (
              <textarea
                className={cn(NOTES_EDITOR_CLASS, "min-h-0 flex-1")}
                placeholder={PLACEHOLDER}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck
              />
            )}
            {tab === "preview" && (
              <div className={cn(NOTES_PREVIEW_CLASS, "flex-1")}>
                {draft.trim() ? (
                  <MarkdownView md={draft} inverted />
                ) : (
                  <p className={NOTES_EMPTY_CLASS}>Nothing to preview yet.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

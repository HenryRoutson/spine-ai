"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { Maximize2, X } from "lucide-react"
import type { editor } from "monaco-editor"
import { Button } from "@/components/ui/button"
import type { CustomCodeLanguage } from "@/lib/types"
import { cn } from "@/lib/utils"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-24 items-center justify-center font-mono text-[10px] text-muted-foreground">
      Loading editor…
    </div>
  ),
})

function monacoLanguage(language: CustomCodeLanguage): string {
  return language === "python" ? "python" : "typescript"
}

function baseEditorOptions(compact: boolean): editor.IStandaloneEditorConstructionOptions {
  return {
    fontSize: compact ? 11 : 13,
    fontFamily: "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace",
    lineNumbers: "on",
    minimap: { enabled: !compact },
    scrollBeyondLastLine: false,
    wordWrap: "on",
    automaticLayout: true,
    padding: compact ? { top: 8, bottom: 8 } : { top: 12, bottom: 12 },
    overviewRulerLanes: compact ? 0 : 3,
    hideCursorInOverviewRuler: compact,
    scrollbar: {
      verticalScrollbarSize: compact ? 8 : 10,
      horizontalScrollbarSize: compact ? 8 : 10,
    },
    tabSize: 2,
    renderLineHighlight: compact ? "none" : "line",
    folding: true,
    bracketPairColorization: { enabled: true },
  }
}

type MonacoPaneProps = {
  value: string
  onChange?: (value: string) => void
  language: CustomCodeLanguage
  readOnly: boolean
  compact: boolean
}

function MonacoPane({ value, onChange, language, readOnly, compact }: MonacoPaneProps) {
  return (
    <MonacoEditor
      height={compact ? "96px" : "100%"}
      language={monacoLanguage(language)}
      theme="vs-dark"
      value={value}
      onChange={readOnly ? undefined : (v) => onChange?.(v ?? "")}
      options={{
        ...baseEditorOptions(compact),
        readOnly,
      }}
    />
  )
}

type CustomCodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  language: CustomCodeLanguage
  readOnly?: boolean
  label?: string
  className?: string
}

// AI : Monaco-backed editor — compact inline + optional fullscreen VS Code-style overlay.
export function CustomCodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  label,
  className,
}: CustomCodeEditorProps) {
  const [fullscreen, setFullscreen] = useState(false)

  const closeFullscreen = useCallback(() => setFullscreen(false), [])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen, closeFullscreen])

  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [fullscreen])

  return (
    <>
      {!fullscreen && (
        <div className={cn("relative overflow-hidden rounded-md border border-border bg-[#1e1f23]", className)}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 z-10 h-7 w-7 bg-background/60 text-muted-foreground backdrop-blur-sm hover:text-foreground"
            onClick={() => setFullscreen(true)}
            title="Open full editor"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <MonacoPane
            value={value}
            onChange={onChange}
            language={language}
            readOnly={readOnly}
            compact
          />
        </div>
      )}

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#1e1f23]">
          <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-2.5">
            <div className="min-w-0">
              {label && <p className="truncate font-mono text-xs text-foreground">{label}</p>}
              <p className="font-mono text-[10px] text-muted-foreground">
                {language === "python" ? "Python" : "TypeScript"} · Esc to close
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={closeFullscreen}
              title="Close editor"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <MonacoPane
              value={value}
              onChange={onChange}
              language={language}
              readOnly={readOnly}
              compact={false}
            />
          </div>
        </div>
      )}
    </>
  )
}

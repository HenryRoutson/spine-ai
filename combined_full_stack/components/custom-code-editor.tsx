"use client"
// AI : parity ids — inference.custom-code

// AI : TODO — debounced tryCompileCustomCodeEntry markers in Monaco (computeInvalid already blocks run).
import { useCallback, useEffect, useState } from "react"
import { Maximize2, X } from "lucide-react"
import { CODE_LANG_LABEL, MonacoCodeEditor } from "@/components/code-viewer"
import { Button } from "@/components/ui/button"
import type { CustomCodeLanguage } from "@/lib/types"
import { cn } from "@/lib/utils"

type CustomCodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  language: CustomCodeLanguage
  readOnly?: boolean
  label?: string
  className?: string
  compact?: boolean
}

// AI : Monaco-backed editor — compact inline + optional fullscreen VS Code-style overlay.
export function CustomCodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  label,
  className,
  compact = true,
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
              spineId="inference.custom-code"
            >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <MonacoCodeEditor
            value={value}
            onChange={onChange}
            language={language}
            readOnly={readOnly}
            compact={compact}
          />
        </div>
      )}

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#1e1f23]">
          <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-2.5">
            <div className="min-w-0">
              {label && <p className="truncate font-mono text-xs text-foreground">{label}</p>}
              <p className="font-mono text-[10px] text-muted-foreground">
                {CODE_LANG_LABEL[language]} · Esc to close
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
          <MonacoCodeEditor
            value={value}
            onChange={onChange}
            language={language}
            readOnly={readOnly}
          />
        </div>
      )}
    </>
  )
}

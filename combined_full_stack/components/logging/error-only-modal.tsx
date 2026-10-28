"use client"

import { useMemo, useState } from "react"
import { Check, Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { copyTextToClipboard } from "@/lib/clipboard"
import { runErrorLogJson, runErrorLogText } from "@/lib/run-error-log"
import type { PipelineModule, PipelineRun } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

export function ErrorOnlyModal({
  run,
  modules,
  onClose,
}: {
  run: PipelineRun
  modules: PipelineModule[]
  onClose: () => void
}) {
  const [mode, setMode] = useState<"text" | "json">("text")
  const [includePipeline, setIncludePipeline] = useState(false)
  const [copied, setCopied] = useState(false)

  const errorText = useMemo(
    () => runErrorLogText(run, { includePipeline }),
    [run, includePipeline],
  )
  const errorJson = useMemo(
    () => runErrorLogJson(run, modules, { includePipeline }),
    [run, modules, includePipeline],
  )

  async function copyContent() {
    await copyTextToClipboard(mode === "text" ? errorText : errorJson)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-destructive/40 bg-background shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-destructive">
              Isolated errors
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              Failed fields only{includePipeline ? " · pipeline included" : ""}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/80">{run.id}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={includePipeline ? "secondary" : "ghost"}
              className="h-7 font-mono text-[10px]"
              onClick={() => setIncludePipeline((v) => !v)}
              title="Include full step inputs and pipeline definition"
            >
              pipeline
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "text" ? "secondary" : "ghost"}
              className="h-7 font-mono text-[10px]"
              onClick={() => setMode("text")}
            >
              text
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "json" ? "secondary" : "ghost"}
              className="h-7 font-mono text-[10px]"
              onClick={() => setMode("json")}
            >
              json
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 font-mono text-[10px]"
              onClick={() => void copyContent()}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "copied" : "copy"}
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-destructive">
          {mode === "text" ? errorText : errorJson}
        </pre>
      </div>
    </div>
  )
}

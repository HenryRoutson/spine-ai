"use client"
// AI : parity ids — testing.pinpoint logging.copy-error

import { useState } from "react"
import { AlertTriangle, Check, Copy, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { copyTextToClipboard } from "@/lib/clipboard"
import { runErrorLogText } from "@/lib/run-error-log"
import type { PipelineModule, PipelineRun } from "@/lib/types"
import { ErrorOnlyModal } from "@/components/logging/error-only-modal"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

export function IsolatedErrorActions({
  run,
  modules,
  size = "sm",
  showView = true,
}: {
  run: PipelineRun
  modules: PipelineModule[]
  size?: "sm" | "default"
  showView?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)

  async function copyErrors() {
    await copyTextToClipboard(runErrorLogText(run, { includePipeline: false }))
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className="h-6 gap-1 border-destructive/40 font-mono text-[10px] text-destructive hover:bg-destructive/10"
        onClick={() => void copyErrors()}
        title="Copy failed fields only (input, process, diverging output)"
        spineId="logging.copy-error"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "copied" : "copy_errors"}
      </Button>
      {showView && (
        <Button
          type="button"
          variant="outline"
          size={size}
          className="h-6 gap-1 border-destructive/40 font-mono text-[10px] text-destructive hover:bg-destructive/10"
          onClick={() => setViewOpen(true)}
          title="View failed fields only"
        >
          <Eye className="h-3 w-3" />
          errors_only
        </Button>
      )}
      {viewOpen && (
        <ErrorOnlyModal run={run} modules={modules} onClose={() => setViewOpen(false)} />
      )}
    </>
  )
}

export function IsolatedErrorButton({
  run,
  modules,
  onClick,
}: {
  run: PipelineRun
  modules: PipelineModule[]
  onClick?: () => void
}) {
  const [viewOpen, setViewOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
        onClick={() => {
          setViewOpen(true)
          onClick?.()
        }}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Isolated errors
      </Button>
      {viewOpen && (
        <ErrorOnlyModal run={run} modules={modules} onClose={() => setViewOpen(false)} />
      )}
    </>
  )
}

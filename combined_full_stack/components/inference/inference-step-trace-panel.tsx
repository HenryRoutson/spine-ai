"use client"

import { useEffect, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { ChevronDown, Copy, Check } from "lucide-react"
import { runErrorLogText, runHasErrors } from "@/lib/run-error-log"
import { DiagnosisRunLink } from "@/components/diagnosis-agents/diagnosis-run-link"
import { InferenceHtmlDownloadButton } from "@/components/inference/inference-html-download-button"
import { HTML_EXPORT_SKIP_PROPS } from "@/lib/html-export-mark"
import { runLogText } from "@/lib/run-log-text"
import { runLogJson } from "@/lib/run-log-json"
import { copyTextToClipboard } from "@/lib/clipboard"
import { Progress } from "@/components/ui/progress"
import type { StepUiState } from "@/lib/run-engine"
import type { DocRef, JobLogEntry, ModuleId, PipelineModule, PipelineRun, StructureModel } from "@/lib/types"
import { CyclingWaitPhrase } from "@/components/inference/inference-run-chrome"
import { PipelineRunGraph } from "@/components/pipeline-run-graph"
import { cn } from "@/lib/utils"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import type { CodeExecUiState } from "@/lib/code-exec-ui"

function CopyTraceButton({
  label,
  copied,
  onCopy,
  tone = "muted",
}: {
  label: string
  copied: boolean
  onCopy: () => void | Promise<void>
  tone?: "muted" | "destructive"
}) {
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px]",
        tone === "destructive"
          ? "text-destructive hover:text-destructive/80"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "copied" : label}
    </button>
  )
}

export function InferenceStepTracePanel({
  modules,
  phase,
  stepStates,
  run,
  progressPct,
  waitPhrase,
  logEndRef,
  footer,
  docs,
  models,
  simple = false,
}: {
  modules: PipelineModule[]
  phase: "idle" | "running" | "done"
  stepStates: Map<ModuleId, StepUiState>
  run: PipelineRun | null
  progressPct: number
  waitPhrase: string
  logsByModule?: Map<ModuleId, JobLogEntry[]>
  logEndRef?: RefObject<HTMLDivElement | null>
  footer?: ReactNode
  docs: DocRef[]
  models: StructureModel[]
  inputDocs: Partial<Record<ModuleId, DocRef | DocRef[]>>
  codeExecByModule?: Map<ModuleId, CodeExecUiState>
  simple?: boolean
}) {
  const [stepsExpanded, setStepsExpanded] = useState(true)
  const [copiedKey, setCopiedKey] = useState<"errors" | "json" | "log" | null>(null)

  // AI : InferenceCollapsibleSection.collapseOnDone exists but is unused; wire it or default stepsExpanded false after done.
  useEffect(() => {
    if (phase === "running" || phase === "done") setStepsExpanded(true)
  }, [phase])

  if (phase !== "running" && phase !== "done") return null

  function markCopied(key: typeof copiedKey) {
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), COPY_FEEDBACK_MS)
  }

  // AI : same nested fork DAG + spreadsheet sidebar as Logging — never flatten lanes into a list.
  const graph = (
    <PipelineRunGraph
      modules={modules}
      models={models}
      run={run}
      stepStates={stepStates}
    />
  )

  if (simple) {
    return (
      <div className="space-y-3">
        {phase === "running" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Working…</p>
              <span className="text-sm tabular-nums text-muted-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
            <CyclingWaitPhrase phrase={waitPhrase} />
          </div>
        ) : null}
        {footer}
        {graph}
        {logEndRef ? <div ref={logEndRef} /> : null}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className={cn("flex items-center justify-between", stepsExpanded && "mb-2")}>
        <button
          type="button"
          onClick={() => setStepsExpanded((v) => !v)}
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3 w-3 shrink-0 transition-transform", stepsExpanded && "rotate-180")}
          />
          {phase === "done" ? "step graph" : "progress"}
        </button>
        <div className="flex items-center gap-2">
          {phase === "done" && run && (
            <span {...HTML_EXPORT_SKIP_PROPS} className="flex items-center gap-2">
              {runHasErrors(run) && <DiagnosisRunLink runId={run.id} />}
              {runHasErrors(run) && (
                <CopyTraceButton
                  label="copy_errors"
                  copied={copiedKey === "errors"}
                  tone="destructive"
                  onCopy={async () => {
                    await copyTextToClipboard(runErrorLogText(run))
                    markCopied("errors")
                  }}
                />
              )}
              <CopyTraceButton
                label="copy_json"
                copied={copiedKey === "json"}
                onCopy={async () => {
                  await copyTextToClipboard(await runLogJson(run, docs))
                  markCopied("json")
                }}
              />
              <CopyTraceButton
                label="copy_log"
                copied={copiedKey === "log"}
                onCopy={async () => {
                  await copyTextToClipboard(runLogText(run))
                  markCopied("log")
                }}
              />
              <InferenceHtmlDownloadButton run={run} models={models} />
            </span>
          )}
          <span className="font-mono text-[11px] text-primary">{progressPct}%</span>
        </div>
      </div>
      {stepsExpanded && <Progress value={progressPct} className="h-1.5" />}
      {stepsExpanded && phase === "running" && <CyclingWaitPhrase phrase={waitPhrase} className="mt-3" />}
      {stepsExpanded && footer}
      {stepsExpanded && <div className="mt-4">{graph}</div>}
      {stepsExpanded && logEndRef ? <div ref={logEndRef} /> : null}
    </div>
  )
}

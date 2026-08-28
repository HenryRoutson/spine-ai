"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, Maximize2 } from "lucide-react"
import { DataViewPanel } from "@/components/data-view-panel"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { cn } from "@/lib/utils"
import { useStatusPalette } from "@/lib/chart-colors"
import { hasDisplayableStepOutput, isDocReferenceOutputJson } from "@/lib/step-doc"
import {
  deriveHostedOutputView,
  extractHostedMetric,
  type hosted_resolved_output_view,
} from "@/lib/hosted-run-chrome"
import type { hosted_run_output_view } from "@/lib/shared-link-types"
import type { RunStep, StructureModel } from "@/lib/types"

function OutputStepLabel() {
  return (
    <span className="shrink-0 rounded border border-white/70 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-foreground">
      output
    </span>
  )
}

function outputStepOutlineClass(isOutputStep: boolean, compact = false) {
  if (compact) return "border-border"
  return isOutputStep ? "border-white/55 ring-1 ring-white/35" : "border-border"
}

export function InferenceRunOutputs({
  steps,
  models,
  compact = false,
  outputView = "auto",
}: {
  steps: RunStep[]
  models?: StructureModel[]
  compact?: boolean
  outputView?: hosted_run_output_view
}) {
  const [popup, setPopup] = useState<PopupPayload | null>(null)
  return (
    <div className="space-y-3">
      {compact ? null : (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">final outputs</p>
      )}
      {steps.map((step, i) => (
        <InferenceStepOutput
          key={step.moduleId}
          step={step}
          expanded={i === steps.length - 1}
          isOutputStep={step.kind === "output"}
          compact={compact}
          models={models}
          outputView={outputView}
          onFullscreen={
            step.outputJson
              ? () =>
                  setPopup({
                    json: step.outputJson!,
                    models,
                    title: `${step.label} (output)`,
                    defaultView: "json",
                  })
              : undefined
          }
        />
      ))}
      {popup && <PopupModal payload={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}

function InferenceStepOutput({
  step,
  expanded,
  isOutputStep,
  compact = false,
  models,
  outputView = "auto",
  onFullscreen,
}: {
  step: RunStep
  expanded: boolean
  isOutputStep: boolean
  compact?: boolean
  models?: StructureModel[]
  outputView?: hosted_run_output_view
  onFullscreen?: () => void
}) {
  const ok = step.status === "ok" || step.status === "cached"
  const palette = useStatusPalette()
  const resolved: hosted_resolved_output_view | null = step.outputJson
    ? compact
      ? deriveHostedOutputView({ preference: outputView, json: step.outputJson })
      : "table"
    : null
  const metric = resolved === "metric" && step.outputJson ? extractHostedMetric(step.outputJson) : null
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card",
        outputStepOutlineClass(isOutputStep, compact),
      )}
    >
      {isOutputStep && !compact ? (
        <span className="absolute bottom-0 left-0 top-0 w-1 bg-white/90 shadow-[2px_0_8px_rgba(255,255,255,0.15)]" aria-hidden />
      ) : null}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: palette.ok }} />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: palette.err }} />
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{step.label}</p>
        {isOutputStep && !compact ? <OutputStepLabel /> : null}
        {step.status === "cached" && (
          <span className="font-mono text-[10px] text-chart-3">cached</span>
        )}
        {compact && onFullscreen ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            title="View full JSON"
            aria-label="View full JSON"
            onClick={onFullscreen}
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {metric ? (
        <div className="flex flex-col items-center justify-center gap-1 px-4 py-7">
          {metric.label ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
          ) : null}
          <p className="text-4xl font-semibold tabular-nums tracking-tight">{metric.text}</p>
        </div>
      ) : step.outputJson ? (
        <div className={expanded ? "h-[min(28rem,55vh)]" : "h-[min(16rem,32vh)]"}>
          <DataViewPanel
            json={step.outputJson}
            models={models}
            defaultView={resolved === "json" ? "json" : "table"}
            lockedView={compact ? (resolved === "json" ? "json" : "table") : undefined}
            className="h-full"
            simple={compact}
            onFullscreen={compact ? undefined : onFullscreen}
          />
        </div>
      ) : (
        <div className="max-h-48 overflow-auto px-4 py-3">
          <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {step.outputPreview}
          </pre>
        </div>
      )}
    </div>
  )
}

export { OutputStepLabel, outputStepOutlineClass }

export function StepTraceOutputPreview({
  runStep,
  outputPreview,
  models,
  className,
  compact = true,
}: {
  runStep?: RunStep
  outputPreview?: string
  models?: StructureModel[]
  className?: string
  compact?: boolean
}) {
  const json = runStep?.outputJson
  const preview = runStep?.outputPreview ?? outputPreview
  if (json && !isDocReferenceOutputJson(json)) {
    return (
      <div className={cn("mt-2 overflow-hidden rounded-md border border-border", className)}>
        <div className={compact ? "h-[min(12rem,28vh)]" : "h-[min(24rem,50vh)]"}>
          <DataViewPanel json={json} models={models} defaultView="table" className="h-full" />
        </div>
      </div>
    )
  }
  if (preview?.trim()) {
    return (
      <div
        className={cn(
          "mt-2 overflow-auto rounded-md border border-border bg-muted/20 px-2.5 py-2",
          compact ? "max-h-32" : "max-h-64",
          className,
        )}
      >
        <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
          {preview}
        </pre>
      </div>
    )
  }
  return null
}

export function stepHasTraceOutput(
  runStep: RunStep | undefined,
  outputPreview: string | undefined,
  isInputStep: boolean,
): boolean {
  if (isInputStep) return false
  if (runStep) return hasDisplayableStepOutput(runStep)
  return !!(outputPreview?.trim())
}

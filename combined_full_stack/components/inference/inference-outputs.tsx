"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { cn } from "@/lib/utils"
import type { RunStep, StructureModel } from "@/lib/types"

function OutputStepLabel() {
  return (
    <span className="shrink-0 rounded border border-white/70 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-foreground">
      output
    </span>
  )
}

function outputStepOutlineClass(isOutputStep: boolean) {
  return isOutputStep ? "border-white/55 ring-1 ring-white/35" : "border-border"
}

export function InferenceRunOutputs({
  steps,
  models,
}: {
  steps: RunStep[]
  models?: StructureModel[]
}) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">outputs</p>
      {steps.map((step, i) => (
        <InferenceStepOutput
          key={step.moduleId}
          step={step}
          expanded={i === steps.length - 1}
          isOutputStep={step.kind === "output"}
          models={models}
        />
      ))}
    </div>
  )
}

function InferenceStepOutput({
  step,
  expanded,
  isOutputStep,
  models,
}: {
  step: RunStep
  expanded: boolean
  isOutputStep: boolean
  models?: StructureModel[]
}) {
  const ok = step.status === "ok" || step.status === "cached"
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card",
        outputStepOutlineClass(isOutputStep),
      )}
    >
      {isOutputStep && (
        <span className="absolute bottom-0 left-0 top-0 w-1 bg-white/90 shadow-[2px_0_8px_rgba(255,255,255,0.15)]" aria-hidden />
      )}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{step.label}</p>
        {isOutputStep && <OutputStepLabel />}
        {step.status === "cached" && (
          <span className="font-mono text-[10px] text-chart-3">cached</span>
        )}
      </div>
      {step.outputJson ? (
        <div className={expanded ? "h-[min(28rem,55vh)]" : "h-[min(16rem,32vh)]"}>
          <JsonPreviewPanel json={step.outputJson} models={models} defaultView="table" className="h-full" />
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

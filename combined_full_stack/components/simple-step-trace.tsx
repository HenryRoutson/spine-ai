"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, Loader2 } from "lucide-react"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { findPipelineModule, flattenPipelineModules } from "@/lib/fork-pipeline"
import { moduleInputDescription, resolveStepInputDescription } from "@/components/step-input-description"
import { simpleStepDescription } from "@/lib/plain-step-description"
import { Progress } from "@/components/ui/progress"
import { useStatusPalette } from "@/lib/chart-colors"
import type { StepUiState } from "@/lib/run-engine"
import { isManagedLockedStep } from "@/lib/structure-parse-steps"
import { stepSpreadsheetJson } from "@/lib/step-doc"
import { cn } from "@/lib/utils"
import type { ModuleId, PipelineModule, PipelineRun, RunStep, StructureModel } from "@/lib/types"
import { uiContextTargetProps } from "@/lib/ui-context-dom"

export type SimpleStepStatus = "idle" | "running" | "ok" | "cached" | "error"

export type SimpleTraceStep = {
  id: ModuleId
  label: string
  description?: string
  status: SimpleStepStatus
  json?: string
  errorPreview?: string
  sub?: { current: number; total: number; label?: string }
}

function includeModule(module: PipelineModule | undefined, kind?: string): boolean {
  if (module) return !isManagedLockedStep(module)
  return kind !== "quote" && kind !== "doc-to-text"
}

function statusFrom(step: RunStep | undefined, ui: StepUiState | undefined): SimpleStepStatus {
  const raw = ui?.status ?? step?.status ?? "idle"
  if (raw === "idle" || raw === "running" || raw === "ok" || raw === "cached" || raw === "error") return raw
  return "idle"
}

export function simpleTraceStepsFromRun(run: PipelineRun, modules: PipelineModule[]): SimpleTraceStep[] {
  return run.steps
    .filter((step) => includeModule(findPipelineModule(modules, step.moduleId), step.kind))
    .map((step) => ({
      id: step.moduleId,
      label: step.label,
      description: simpleStepDescription(resolveStepInputDescription(step, modules), step.kind),
      status: statusFrom(step, undefined),
      json: stepSpreadsheetJson(step),
      errorPreview: step.status === "error" ? step.outputPreview : undefined,
    }))
}

export function simpleTraceStepsFromLive({
  modules,
  stepStates,
  run,
}: {
  modules: PipelineModule[]
  stepStates: Map<ModuleId, StepUiState>
  run: PipelineRun | null
}): SimpleTraceStep[] {
  return flattenPipelineModules(modules).filter((m) => includeModule(m)).map((module) => {
    const runStep = run?.steps.find((s) => s.moduleId === module.id)
    const ui = stepStates.get(module.id)
    const status = statusFrom(runStep, ui)
    return {
      id: module.id,
      label: module.label,
      description: simpleStepDescription(
        moduleInputDescription(module) ?? runStep?.inputDescription?.trim(),
        module.kind,
      ),
      status,
      json: stepSpreadsheetJson(runStep ?? {}),
      errorPreview: status === "error" ? (runStep?.outputPreview ?? ui?.outputPreview) : undefined,
      sub: ui?.sub,
    }
  })
}

function stepStatusLabel(status: SimpleStepStatus): string {
  if (status === "error") return "Failed"
  if (status === "running") return "Running"
  if (status === "idle") return "Waiting"
  return "Done"
}

export function SimpleStepTrace({
  steps,
  models,
  loading = false,
}: {
  steps: SimpleTraceStep[]
  models: StructureModel[]
  loading?: boolean
}) {
  const palette = useStatusPalette()
  const [openIds, setOpenIds] = useState<Set<ModuleId>>(() => new Set())
  const [popup, setPopup] = useState<PopupPayload | null>(null)

  function toggle(id: ModuleId) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <ol className="space-y-2">
        {steps.map((step) => {
          const open = openIds.has(step.id)
          const failed = step.status === "error"
          const running = step.status === "running"
          return (
            <li
              key={step.id}
              className="rounded-lg border border-border bg-card"
              {...uiContextTargetProps({
                kind: "pipeline_step",
                id: `step:${step.id}`,
                label: `Step · ${step.label}`,
                moduleId: step.id,
                snippet: [
                  step.description,
                  `status: ${stepStatusLabel(step.status)}`,
                  step.errorPreview,
                ]
                  .filter(Boolean)
                  .join("\n"),
              })}
            >
              <button
                type="button"
                onClick={() => toggle(step.id)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
              >
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
                {failed ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: palette.err }} />
                ) : running ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : step.status === "idle" ? (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: palette.ok }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{step.label}</span>
                  {step.description ? (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {step.description}
                    </span>
                  ) : null}
                  {running && step.sub && step.sub.total > 1 ? (
                    <span className="mt-1 block">
                      <Progress
                        value={Math.round((step.sub.current / step.sub.total) * 100)}
                        className="h-0.5"
                      />
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "shrink-0 pt-0.5 text-xs",
                    failed ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {stepStatusLabel(step.status)}
                </span>
              </button>
              {open ? (
                <div className="border-t border-border">
                  {step.json ? (
                    <div className="h-[min(22rem,50vh)]">
                      <JsonPreviewPanel
                        json={step.json}
                        models={models}
                        excelOnly
                        downloadBaseName={step.label}
                        className="h-full"
                        onFullscreen={() =>
                          setPopup({
                            json: step.json!,
                            models,
                            excelOnly: true,
                            defaultView: "table",
                            title: step.label,
                          })
                        }
                      />
                    </div>
                  ) : loading && (step.status === "ok" || step.status === "cached") ? (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">Loading spreadsheet…</p>
                  ) : running ? (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">This step is still running.</p>
                  ) : failed ? (
                    <p className="px-3 py-2.5 text-sm text-destructive">
                      {step.errorPreview?.trim() || "This step could not finish."}
                    </p>
                  ) : step.status === "idle" ? (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">Waiting for this step.</p>
                  ) : (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">No spreadsheet for this step.</p>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      {popup && <PopupModal payload={popup} onClose={() => setPopup(null)} />}
    </>
  )
}

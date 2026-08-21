"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { resolveStepInputDescription } from "@/components/step-input-description"
import { useStatusPalette } from "@/lib/chart-colors"
import { formatCostCents } from "@/lib/format"
import { formatRunErrorForDisplay } from "@/lib/run-errors"
import { isSlimPipelineRun, runBilledCents } from "@/lib/run-metrics"
import { stepSpreadsheetJson } from "@/lib/step-doc"
import { timeAgo } from "@/lib/time-ago"
import { cn } from "@/lib/utils"
import type { ModuleId, PipelineModule, PipelineRun, RunStep, StructureModel } from "@/lib/types"

function runStatusLabel(status: PipelineRun["status"]): string {
  return status === "error" ? "Failed" : "Done"
}

function stepStatusLabel(status: RunStep["status"]): string {
  return status === "error" ? "Failed" : "Done"
}

export function SimpleLoggingTrace({
  run,
  modules,
  models,
}: {
  run: PipelineRun
  modules: PipelineModule[]
  models: StructureModel[]
}) {
  const palette = useStatusPalette()
  const [openIds, setOpenIds] = useState<Set<ModuleId>>(() => new Set())
  const [popup, setPopup] = useState<PopupPayload | null>(null)
  const runError = formatRunErrorForDisplay(run)
  const billed = runBilledCents(run)
  const failed = run.status === "error"

  function toggle(id: ModuleId) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {runStatusLabel(run.status)}
          <span className="font-normal text-muted-foreground"> · {timeAgo(run.startedAt)}</span>
          {billed > 0 ? (
            <span className="font-normal text-muted-foreground"> · {formatCostCents(billed)}</span>
          ) : null}
        </p>
        {failed && runError ? (
          <p className="text-sm text-destructive">{runError.message}</p>
        ) : null}
      </div>

      <ol className="space-y-2">
        {run.steps.map((step) => {
          const open = openIds.has(step.moduleId)
          const description = resolveStepInputDescription(step, modules)
          const json = stepSpreadsheetJson(step)
          const stepFailed = step.status === "error"
          return (
            <li key={step.moduleId} className="rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => toggle(step.moduleId)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
              >
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
                {stepFailed ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: palette.err }} />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: palette.ok }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{step.label}</span>
                  {description ? (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "shrink-0 pt-0.5 text-xs",
                    stepFailed ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {stepStatusLabel(step.status)}
                </span>
              </button>
              {open ? (
                <div className="border-t border-border">
                  {json ? (
                    <div className="h-[min(22rem,50vh)]">
                      <JsonPreviewPanel
                        json={json}
                        models={models}
                        excelOnly
                        downloadBaseName={step.label}
                        className="h-full"
                        onFullscreen={() =>
                          setPopup({
                            json,
                            models,
                            excelOnly: true,
                            defaultView: "table",
                            title: step.label,
                          })
                        }
                      />
                    </div>
                  ) : isSlimPipelineRun(run) ? (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">Loading spreadsheet…</p>
                  ) : stepFailed ? (
                    <p className="px-3 py-2.5 text-sm text-destructive">
                      {step.outputPreview?.trim() || "This step could not finish."}
                    </p>
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
    </div>
  )
}

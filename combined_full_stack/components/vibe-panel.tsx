"use client"

import { useMemo, useState } from "react"
import { Loader2, Play } from "lucide-react"
import { ProjectAssistantDockPanel } from "@/components/project-assistant-dock"
import { Button } from "@/components/ui/button"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import {
  pipelineHasHumanGate,
  resolveAssistantInferenceInputs,
  runAssistantInference,
} from "@/lib/assistant-run"
import { buildDefaultInputDocs, docsForInputModule, orderedInputModules } from "@/lib/inference-input"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { useStore } from "@/lib/store"
import { docsForProject } from "@/lib/project-docs"

// AI : agent-first Build surface — full project control via chat (+ run options); no workspace tabs.
export function VibePanel() {
  useMarkPrimarySectionReady(AppPrimarySection.Build)
  const {
    project,
    modules,
    models,
    typeAliases,
    docs,
    runs,
    model,
    addRun,
    refresh,
    refreshBilling,
    flushPendingSave,
  } = useStore()
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])
  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const defaultInputs = useMemo(
    () => buildDefaultInputDocs(docs, project, inputModules),
    [docs, project, inputModules],
  )
  const resolved = useMemo(
    () =>
      resolveAssistantInferenceInputs({
        project,
        modules,
        docs,
        model,
        inputDocs: defaultInputs,
      }),
    [project, modules, docs, model, defaultInputs],
  )
  const invalid = useMemo(
    () => computeInvalidForUi(modules, models, typeAliases),
    [modules, models, typeAliases],
  )
  const invalidCount = invalid.size
  const hasHumanGate = pipelineHasHumanGate(modules)
  const lastRun = runs[0]
  const canRun =
    !running && !hasHumanGate && invalidCount === 0 && resolved.ok

  async function onRun() {
    if (!canRun || !resolved.ok) return
    setRunning(true)
    setRunError(null)
    try {
      await flushPendingSave?.()
      const { run } = await runAssistantInference({
        project,
        modules,
        docs,
        model,
        inputDocs: resolved.inputDocs,
      })
      addRun(run)
      void refreshBilling()
      void refresh()
    } catch (err) {
      setRunError((err as Error).message || "Run failed")
    } finally {
      setRunning(false)
    }
  }

  const runDisabledReason = hasHumanGate
    ? "Pipeline needs human review / chatbot — open Inference"
    : invalidCount > 0
      ? `Fix ${invalidCount} validation issue${invalidCount === 1 ? "" : "s"} first`
      : !resolved.ok
        ? resolved.reason
        : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-border bg-muted/20 p-4 lg:w-72 lg:border-b-0 lg:border-r">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Run
            </p>
            <p className="text-xs text-muted-foreground">
              Describe what you want in the agent, then run when ready.
            </p>
          </div>

          <Button
            type="button"
            className="w-full justify-start gap-2 font-mono text-[11px]"
            onClick={() => void onRun()}
            disabled={!canRun}
            title={runDisabledReason ?? "Run pipeline on default inputs"}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {running ? "Running…" : "Run pipeline"}
          </Button>
          {runDisabledReason ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{runDisabledReason}</p>
          ) : null}
          {runError ? (
            <p className="text-[11px] leading-relaxed text-destructive">{runError}</p>
          ) : null}

          <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Inputs
            </p>
            {inputModules.length === 0 ? (
              <p className="text-xs text-muted-foreground">No input steps yet.</p>
            ) : (
              <ul className="space-y-2">
                {inputModules.map((m) => {
                  const assigned = docsForInputModule(defaultInputs, m.id)
                  return (
                    <li key={m.id} className="text-xs">
                      <p className="font-medium text-foreground">{m.label || "Input"}</p>
                      <p className="text-muted-foreground">
                        {assigned.length
                          ? assigned.map((d) => d.name).join(", ")
                          : "No matching document — ask the agent for test docs"}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
            {projectDocs.length > 0 ? (
              <p className="pt-1 font-mono text-[10px] text-muted-foreground">
                {projectDocs.length} project file{projectDocs.length === 1 ? "" : "s"} available
              </p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Last run
            </p>
            {lastRun ? (
              <div className="space-y-1 text-xs">
                <p className="font-medium text-foreground">
                  {lastRun.status} · {formatSecondsShort(lastRun.totalMs)} ·{" "}
                  {formatCostCents(lastRun.billedCents)}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {new Date(lastRun.startedAt).toLocaleString()}
                  {lastRun.source ? ` · ${lastRun.source}` : ""}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">{lastRun.id}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No runs yet.</p>
            )}
          </div>
        </aside>

        <div className="min-h-0 min-w-0 flex-1">
          <ProjectAssistantDockPanel embedded />
        </div>
      </div>
    </div>
  )
}

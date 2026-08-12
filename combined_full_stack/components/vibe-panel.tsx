"use client"

import { useMemo, useState } from "react"
import { Loader2, Play } from "lucide-react"
import { AgentBrowsePanel } from "@/components/agent-browse-panel"
import { FileDropZone } from "@/components/file-drop-zone"
import { ProjectAssistantDockPanel } from "@/components/project-assistant-dock"
import { Button } from "@/components/ui/button"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import {
  pipelineHasHumanGate,
  resolveAssistantInferenceInputs,
  runAssistantInference,
} from "@/lib/assistant-run"
import { isPreviewOnly } from "@/lib/demo-mode"
import {
  buildDefaultInputDocs,
  docsForInputModule,
  inputTypeAccept,
  orderedInputModules,
} from "@/lib/inference-input"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { useStore } from "@/lib/store"
import { DocLabel, type ModuleId } from "@/lib/types"

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
    addDoc,
    addRun,
    refresh,
    refreshBilling,
    flushPendingSave,
  } = useStore()
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [uploadingModule, setUploadingModule] = useState<ModuleId | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

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

  // AI : Vibe hides Documents — upload here so default inputs / Run can pick them up.
  async function onUploadForInput(moduleId: ModuleId, file: File) {
    if (isPreviewOnly()) {
      setUploadError("Uploads are disabled in preview mode.")
      return
    }
    setUploadingModule(moduleId)
    setUploadError(null)
    try {
      await addDoc(file, DocLabel.Inference, project.id)
    } catch (err) {
      setUploadError((err as Error).message || "Upload failed")
    } finally {
      setUploadingModule(null)
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
        <aside className="app-scrollbar flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-b border-border bg-muted/20 p-3 lg:w-72 lg:border-b-0 lg:border-r">
          <Button
            type="button"
            className="w-full justify-start gap-2 font-mono text-[11px]"
            onClick={() => void onRun()}
            disabled={!canRun}
            title={runDisabledReason ?? "Run"}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {running ? "Running…" : "Run"}
          </Button>
          {runDisabledReason ? (
            <p className="font-mono text-[10px] text-muted-foreground">{runDisabledReason}</p>
          ) : null}
          {runError ? (
            <p className="font-mono text-[10px] text-destructive">{runError}</p>
          ) : null}

          <div className="space-y-2 rounded-md border border-border bg-background/60 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Inputs
            </p>
            {uploadError ? (
              <p className="font-mono text-[10px] text-destructive">{uploadError}</p>
            ) : null}
            {inputModules.length === 0 ? (
              <p className="font-mono text-[10px] text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {inputModules.map((m) => {
                  const assigned = docsForInputModule(defaultInputs, m.id)
                  const uploading = uploadingModule === m.id
                  return (
                    <li key={m.id} className="space-y-1">
                      <p className="truncate font-mono text-[10px] text-foreground">
                        {m.label || "Input"}
                        {assigned.length
                          ? ` · ${assigned.map((d) => d.name).join(", ")}`
                          : ""}
                      </p>
                      <FileDropZone
                        compact
                        multiple={false}
                        accept={inputTypeAccept(m.inputType)}
                        disabled={uploadingModule !== null && !uploading}
                        uploading={uploading}
                        onFiles={(files) => {
                          const file = files[0]
                          if (file) void onUploadForInput(m.id, file)
                        }}
                        label={assigned.length ? "Drop to replace" : "Drag & drop here"}
                        browseLabel="Browse"
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {lastRun ? (
            <div className="rounded-md border border-border bg-background/60 px-2.5 py-2 font-mono text-[10px] text-muted-foreground">
              <span className="text-foreground">{lastRun.status}</span>
              {" · "}
              {formatSecondsShort(lastRun.totalMs)}
              {" · "}
              {formatCostCents(lastRun.billedCents)}
            </div>
          ) : null}

          {/* AI : docs + dev tabs — Maximize opens DocViewer; tab chips leave Vibe for that window. */}
          <div className="rounded-md border border-border bg-background/60 p-2.5">
            <AgentBrowsePanel />
          </div>
        </aside>

        <div className="min-h-0 min-w-0 flex-1">
          <ProjectAssistantDockPanel embedded />
        </div>
      </div>
    </div>
  )
}

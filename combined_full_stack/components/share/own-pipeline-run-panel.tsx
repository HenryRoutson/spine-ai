"use client"

// AI : TODO (arch-consumer-run) — shared-run-panel is the same chrome; one ConsumerRunPanel with funding/download slots.

import { useCallback, useMemo, useState } from "react"
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  RotateCcw,
  Zap,
} from "lucide-react"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { Button } from "@/components/ui/button"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { InferenceRunOutputs } from "@/components/inference/inference-outputs"
import {
  ErrorBanner,
  HumanReviewPanel,
  RunErrorSummary,
} from "@/components/inference/inference-run-chrome"
import { InferenceStepTracePanel } from "@/components/inference/inference-step-trace-panel"
import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { useDocViewer } from "@/lib/doc-viewer"
import { docsForInputModule } from "@/lib/inference-input"
import { inputModuleJsonStructSchema } from "@/lib/inference-json-struct-edit"
import { uploadDocContentForOwnPipeline, uploadDocForOwnPipeline } from "@/lib/own-pipeline-docs"
import { pipelineFinalOutputSteps } from "@/lib/step-doc"
import { useInferenceRun } from "@/lib/use-inference-run"
import { useOwnPipelineData } from "@/lib/use-own-pipeline-data"
import { useOptionalConsumerStore } from "@/lib/store"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { modelName } from "@/lib/validity"
import { formatErrorForClipboard } from "@/lib/error-copy"
import { DocLabel, type DocId, DocRef, InputType, ModuleId, PipelineModule, PipelineRun, ProjectId } from "@/lib/types"
import { RunPhase } from "@/lib/run-phase"

type OwnPipelineRunPanelProps = {
  projectId: ProjectId
  onRunComplete?: () => void
  onOpenBilling?: () => void
}

export function OwnPipelineRunPanel({
  projectId,
  onRunComplete,
  onOpenBilling,
}: OwnPipelineRunPanelProps) {
  const data = useOwnPipelineData(projectId)
  const consumer = useOptionalConsumerStore()
  const { open: openDoc } = useDocViewer()
  const { billingAccount, refreshBilling } = useWorkspaceBilling()
  const model = data.builder?.model ?? consumer?.model ?? "openrouter:deepseek-v4"
  const [localInferenceInputDocIds, setLocalInferenceInputDocIds] = useState<
    Partial<Record<ModuleId, DocId | DocId[]>>
  >({})

  const project = data.project
  const inferenceInputDocIds = data.isBuilderActive
    ? data.builder!.inferenceInputDocIds
    : localInferenceInputDocIds

  const addRun = useCallback(
    (r: PipelineRun) => {
      if (data.isBuilderActive) {
        data.builder!.addRun(r)
        return
      }
      const i = data.runs.findIndex((x) => x.id === r.id)
      const next =
        i >= 0 ? data.runs.map((x, idx) => (idx === i ? { ...x, ...r } : x)) : [r, ...data.runs]
      data.patchLocalRuns(next)
    },
    [data],
  )

  const updateRunNotes = useCallback(
    async (runId: PipelineRun["id"], notes: string | undefined) => {
      if (data.isBuilderActive) {
        await data.builder!.updateRunNotes(runId, notes)
        return
      }
      await apiJson(API_ROUTES.run(runId), {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ notes: notes ?? null }),
      })
      const i = data.runs.findIndex((r) => r.id === runId)
      if (i < 0) return
      const nextNotes = notes?.trim() ? notes.trim() : undefined
      const next = [...data.runs]
      next[i] = { ...next[i], notes: nextNotes }
      data.patchLocalRuns(next)
    },
    [data],
  )

  const setInferenceInputDocIds = useCallback(
    (assignment: Partial<Record<ModuleId, DocId | DocId[]>>) => {
      if (data.isBuilderActive) {
        data.builder!.setInferenceInputDocIds(assignment)
        return
      }
      setLocalInferenceInputDocIds(assignment)
    },
    [data],
  )

  const runHook = useInferenceRun({
    project: project ?? {
      id: projectId,
      name: "",
      kind: "blank",
      models: [],
      modules: [],
      strategies: [],
    },
    modules: data.modules,
    model,
    docs: data.docs,
    runs: data.runs,
    inferenceInputDocIds,
    setInferenceInputDocIds,
    addRun,
    updateRunNotes,
    refreshBilling,
    flushPendingSave: data.isBuilderActive ? data.builder!.flushPendingSave : undefined,
  })

  const addDoc = useCallback(
    async (file: File): Promise<DocRef> => {
      if (!project) throw new Error("Pipeline not loaded")
      if (data.isBuilderActive) {
        return await data.builder!.addDoc(file, DocLabel.Inference, project.id)
      }
      const { doc, project: nextProject } = await uploadDocForOwnPipeline(file, project)
      data.patchLocalProject(nextProject)
      data.patchLocalDocs([doc, ...data.docs.filter((d) => d.id !== doc.id && d.name !== doc.name)])
      return doc
    },
    [data, project],
  )

  const addDocContent = useCallback(
    async (
      name: string,
      type: InputType,
      content: string,
      _label: DocLabel,
      _projectId?: string,
      replaceDocId?: DocId,
    ): Promise<DocRef> => {
      if (!project) throw new Error("Pipeline not loaded")
      if (data.isBuilderActive) {
        return await data.builder!.addDocContent(
          name,
          type,
          content,
          DocLabel.Inference,
          project.id,
          replaceDocId,
        )
      }
      const { doc, project: nextProject } = await uploadDocContentForOwnPipeline(
        name,
        type,
        content,
        project,
        replaceDocId,
      )
      data.patchLocalProject(nextProject)
      data.patchLocalDocs([
        doc,
        ...data.docs.filter((d) => d.id !== replaceDocId && d.id !== doc.id && d.name !== doc.name),
      ])
      return doc
    },
    [data, project],
  )

  const validity = project
    ? computeWorkspaceValidity(data.modules, data.models, project.typeAliases ?? [])
    : { typesInvalid: false, pipelineInvalid: false, runTabsBlocked: false }

  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const insufficientCredit =
    billingAccount != null && billingAccount.balanceCents < minRunBalanceCents

  const outModelFor = useCallback(
    (m: PipelineModule) => modelName(data.models, m.outStructureId),
    [data.models],
  )

  const finalOutputSteps = useMemo(
    () => (runHook.run ? pipelineFinalOutputSteps(runHook.run.steps) : []),
    [runHook.run],
  )

  const runBlocked =
    !runHook.allInputsReady ||
    runHook.runInputsBlocked ||
    runHook.phase === RunPhase.Running ||
    validity.typesInvalid ||
    validity.pipelineInvalid ||
    insufficientCredit

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.loadError || !project) {
    return (
      <div className="space-y-4 py-8 text-center">
        <ErrorBanner text={data.loadError ?? "Pipeline not found"} />
      </div>
    )
  }

  if (validity.typesInvalid || validity.pipelineInvalid) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-6 py-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-4 text-sm font-medium text-destructive">
          {validity.typesInvalid
            ? "This pipeline has type errors — fix them in Build → Structure before running."
            : "This pipeline has validation errors — fix them in Build → Pipeline before running."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          pipeline inputs · {runHook.inputModules.length} slot
          {runHook.inputModules.length === 1 ? "" : "s"}
        </p>
        {runHook.inputModules.map((m) => (
          <InferenceInputSlot
            key={m.id}
            variant="store"
            inputModule={m}
            outModel={outModelFor(m)}
            docs={docsForInputModule(runHook.inputDocs, m.id)}
            issue={runHook.inputIssueByModule.get(m.id)}
            jsonStruct={inputModuleJsonStructSchema(m, data.models, project.typeAliases ?? [])}
            jsonStructDisabled={runHook.phase === RunPhase.Running || !!project.teamReadOnly}
            jsonStructSource={{
              docs: data.docs,
              project,
              addDocContent,
            }}
            onOpenPicker={() => runHook.setPickerModuleId(m.id)}
            onOpenDoc={(docId) => openDoc({ docId, start: 0, end: 0 })}
            onRemoveDoc={(docId) => runHook.removeInputDocForModule(m.id, docId)}
            onClearSlot={() => {
              for (const d of docsForInputModule(runHook.inputDocs, m.id)) {
                runHook.removeInputDocForModule(m.id, d.id)
              }
            }}
            onJsonStructAssigned={(doc) => runHook.setInputDocForModule(m.id, doc)}
          />
        ))}
      </div>

      {insufficientCredit && runHook.phase !== RunPhase.Running ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-4 text-center">
          <p className="text-sm font-medium text-destructive">Not enough credit to start a run</p>
          <p className="mt-1 text-xs text-muted-foreground">Top up in Billing, then try again.</p>
          {onOpenBilling ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onOpenBilling}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Go to Billing
            </Button>
          ) : null}
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={runBlocked}
          onClick={() => {
            void runHook.start().then(() => onRunComplete?.())
          }}
        >
          {runHook.runButtonBusy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-1.5 h-4 w-4" />
          )}
          {runHook.runButtonLabel}
        </Button>
      )}

      {runHook.pendingHumanReview && (
        <HumanReviewPanel
          spec={runHook.pendingHumanReview}
          module={data.modules.find((m) => m.id === runHook.pendingHumanReview!.moduleId)}
          onApprove={() => runHook.resolveHumanReview("approved")}
          onReject={() => runHook.resolveHumanReview("rejected")}
        />
      )}
      {/* AI : own-pipeline chatbot uses same Inference ChatbotPanel path when wired through run hooks. */}

      {runHook.error && runHook.phase !== RunPhase.Done && (
        <ErrorBanner
          text={runHook.error.split("\n")[0] ?? runHook.error}
          copyText={formatErrorForClipboard({
            uiLocation: "My pipeline → Run → start run",
            summary: runHook.error,
          })}
          uiLocation="My pipeline → Run → start run"
        />
      )}

      {(runHook.phase === RunPhase.Running || runHook.phase === RunPhase.Done) && (
        <>
          {runHook.phase === RunPhase.Done && finalOutputSteps.length > 0 && (
            <InferenceRunOutputs steps={finalOutputSteps} models={data.models} />
          )}

          {runHook.phase === RunPhase.Done && runHook.run && runHook.run.status !== "ok" && (
            <div className="rounded-lg border border-border bg-card px-6 py-6">
              {runHook.runErrorDisplay ? (
                <RunErrorSummary
                  display={runHook.runErrorDisplay}
                  technical={runHook.runErr}
                  uiLocation="My pipeline → Run → last run error"
                />
              ) : (
                <div className="text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                  <p className="mt-4 text-sm font-medium">Pipeline could not finish</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    See step trace below for details.
                  </p>
                </div>
              )}
            </div>
          )}

          <InferenceStepTracePanel
            modules={data.modules}
            phase={runHook.phase}
            stepStates={runHook.stepStates}
            run={runHook.run}
            progressPct={runHook.progressPct}
            waitPhrase={runHook.waitPhrase}
            logsByModule={runHook.logsByModule}
            docs={data.docs}
            models={data.models}
            inputDocs={runHook.inputDocs}
          />
        </>
      )}

      {runHook.phase !== RunPhase.Idle ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-transparent"
          onClick={runHook.reset}
          disabled={runHook.phase === RunPhase.Running}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset run
        </Button>
      ) : null}

      {runHook.pickerModule && (
        <InferenceInputPickerPopup
          inputModule={runHook.pickerModule}
          selectedDocIds={docsForInputModule(runHook.inputDocs, runHook.pickerModule.id).map(
            (d) => d.id,
          )}
          onSelect={(doc) => runHook.setInputDocForModule(runHook.pickerModule!.id, doc)}
          onClose={() => runHook.setPickerModuleId(null)}
          source={{
            docs: data.docs,
            project,
            models: data.models,
            addDoc: (file, _label, _projectId) => addDoc(file),
          }}
        />
      )}
    </div>
  )
}

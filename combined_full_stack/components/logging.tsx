"use client"

// AI : TODO (spec) — prompt context-length profiling grid per subcomponent (documents, JSON blocks, system text).
import { useMemo, useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PromptText } from "@/components/highlight"
import { JsonViewerEmbed } from "@/components/json-viewer"
import { LlmCallDistribution } from "@/components/llm-call-distribution"
import { StepFailuresSection } from "@/components/step-failures-panel"
import { StepProfiling } from "@/components/step-profiling"
import { InputDocumentLink } from "@/components/input-document-link"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { quotesFromJson, QuoteLinks } from "@/components/quote-links"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { timeAgo } from "@/lib/time-ago"
import { runBilledCents, runSavedCents, runTotalMs, isSlimPipelineRun } from "@/lib/run-metrics"
import { useStatusPalette } from "@/lib/chart-colors"
import { isSharedRun } from "@/lib/shared-link-types"
import { ResizableSplit } from "@/components/resizable-split"
import { loggingPipelineCanvasSplit, loggingSidebarSplit } from "@/lib/layout-split-settings"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { cn } from "@/lib/utils"
import { useAppShell } from "@/lib/app-shell"
import { API_ROUTES } from "@/lib/api-routes"
import { stepDocId, stepDocLinkLabels, stepSourceDocId, isDocReferenceOutputJson } from "@/lib/step-doc"
import { descriptionCheckLlmCallsFromStep, llmCallsFromStep } from "@/lib/llm-distribution"
import { enrichRunModules, modulesFromRunSteps } from "@/lib/pipeline-run-diff"
import { PipelineCanvas } from "@/components/pipeline-canvas"
import { PipelineInspector } from "@/components/pipeline-inspector"
import type { InvalidMap } from "@/lib/validity"
import { RunNotesEditor } from "@/components/run-notes-editor"
import { StepServerLogsSection } from "@/components/server-logs-panel"
import { StepInputDescription, resolveStepInputDescription } from "@/components/step-input-description"
import { stepKindIcon } from "@/lib/module-ui"
import { Search, GitCompareArrows, Zap, Copy, Check, AlertTriangle, Bot } from "lucide-react"
import { resolveRunInputDocIds, runInputDocsSummary } from "@/lib/inference-input"
import { stepIoLabels } from "@/lib/module-kinds"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"
import type { DocRef, ModuleId, PipelineRun, RunId, RunStepStatus } from "@/lib/types"
import { runLogText } from "@/lib/run-log-text"
import { runLogJson } from "@/lib/run-log-json"
import { copyTextToClipboard } from "@/lib/clipboard"
import { IoSection } from "@/components/logging/io-section"
import { IoPager } from "@/components/logging/io-pager"
import { StepLoadedDocSection } from "@/components/step-loaded-doc-section"
import { filterRuns, isTestingRun, RunNotesPreview } from "@/components/logging/run-picker-column"
import { filterRunsByErrorStatus, runHasErrors } from "@/lib/run-error-log"
import { IsolatedErrorActions } from "@/components/logging/isolated-error-actions"
import { useDiagnosisAgents } from "@/lib/diagnosis-agent-context"
import { TestResults } from "@/components/test-results"
import { CompareModal } from "@/components/logging/compare-modal"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { LlmRetryGridSection } from "@/components/logging/llm-retry-grid"

export function Logging() {
  const palette = useStatusPalette()
  const { runs, billingRuns, docs, modules, models, project, typeAliases, model: globalModel, hydrateRunDetail } = useStore()
  const { focusRunId, clearFocusRun, setSharedRunDocScope } = useAppShell()
  const [query, setQuery] = useState("")
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupPayload | null>(null)
  const [selectedPipelineModuleId, setSelectedPipelineModuleId] = useState<ModuleId | undefined>()
  const [compareOpen, setCompareOpen] = useState(false)
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [logCopied, setLogCopied] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)
  const { width: sidebarWidth, setWidth: setSidebarWidth, commitWidth: commitSidebarWidth } =
    usePersistedLeadingWidth(loggingSidebarSplit)
  const {
    width: pipelineCanvasWidth,
    setWidth: setPipelineCanvasWidth,
    commitWidth: commitPipelineCanvasWidth,
  } = usePersistedLeadingWidth(loggingPipelineCanvasSplit)

  useEffect(() => {
    if (!focusRunId) return
    setSelectedRun(focusRunId)
    setSelectedPipelineModuleId(undefined)
    clearFocusRun()
  }, [focusRunId, clearFocusRun])

  useEffect(() => {
    if (!selectedRun) return
    void fetch(API_ROUTES.activity, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            category: "log_view",
            action: "Viewed run logs",
            projectId: project.id,
            detail: { runId: selectedRun },
          },
        ],
      }),
    }).catch(() => {})
  }, [selectedRun, project.id])

  const runInputDocIds = (run: PipelineRun) => resolveRunInputDocIds(docs, project, run)
  const runInputLabel = (run: PipelineRun) => runInputDocsSummary(docs, project, run)

  const { spawnDiagnosis } = useDiagnosisAgents()

  const filtered = useMemo(() => {
    const byError = filterRunsByErrorStatus(runs, errorsOnly ? "errors" : "all")
    return filterRuns(byError, query)
  }, [runs, query, errorsOnly])

  const active = runs.find((r) => r.id === selectedRun) ?? billingRuns.find((r) => r.id === selectedRun) ?? null

  useEffect(() => {
    if (!selectedRun || !active || !isSlimPipelineRun(active)) return
    void hydrateRunDetail(selectedRun as RunId).catch(console.error)
  }, [selectedRun, active, hydrateRunDetail])

  useEffect(() => {
    if (active && isSharedRun(active) && active.sharedLinkId) {
      setSharedRunDocScope({
        linkId: active.sharedLinkId,
        sessionId: active.viewerSessionId,
      })
      return () => setSharedRunDocScope(null)
    }
    setSharedRunDocScope(null)
  }, [active?.id, active?.sharedLinkId, active?.viewerSessionId, setSharedRunDocScope])

  const activeSourceDocs = useMemo(() => {
    if (!active) return []
    return runInputDocIds(active)
      .map((id) => docs.find((d) => d.id === id))
      .filter((d): d is DocRef => d != null)
  }, [active, docs, project])
  const activeLlmCallGroups = useMemo(() => {
    if (!active) return []
    return active.steps
      .map((step) => ({
        calls: llmCallsFromStep(step),
        stepSucceeded: step.status !== "error",
      }))
      .filter((g) => g.calls.length > 0)
  }, [active])
  const runPipeline = useMemo(() => {
    if (!active) return null
    const modulesAtRun = enrichRunModules(modulesFromRunSteps(active.steps), modules)
    const stepStatus = new Map<ModuleId, RunStepStatus>(
      active.steps.map((s) => [s.moduleId, s.status]),
    )
    return { modules: modulesAtRun, stepStatus }
  }, [active, modules])

  // AI : historical runs use current models for I/O enrichment — skip live invalid overlay (misleading after edits).
  const runPipelineInvalid = useMemo((): InvalidMap => new Map(), [])

  const selectedPipelineModule = runPipeline?.modules.find((m) => m.id === selectedPipelineModuleId)

  return (
    <div className="flex h-full flex-col">
      <ResizableSplit
        className="min-h-0 flex-1"
        leadingWidth={sidebarWidth}
        onLeadingWidthChange={setSidebarWidth}
        onLeadingWidthCommit={commitSidebarWidth}
        minLeading={loggingSidebarSplit.min}
        maxLeading={loggingSidebarSplit.max}
        leading={
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-border p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by model, step, run id…"
                  className="h-8 pl-8 font-mono text-xs"
                />
              </div>
              <Button
                type="button"
                variant={errorsOnly ? "secondary" : "outline"}
                size="sm"
                className="h-7 w-full gap-1.5 font-mono text-[10px]"
                onClick={() => setErrorsOnly((v) => !v)}
              >
                <AlertTriangle className="h-3 w-3" />
                {errorsOnly ? "Showing errors only" : "Errors only"}
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {filtered.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">
                  No runs yet. Execute a pipeline from the Inference window.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((run) => (
                    <li key={run.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedRun(run.id)
                          setSelectedPipelineModuleId(undefined)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setSelectedRun(run.id)
                            setSelectedPipelineModuleId(undefined)
                          }
                        }}
                        className={cn(
                          "flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent",
                          active?.id === run.id && "bg-accent",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 break-all font-mono text-xs">{runInputLabel(run)}</span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {isSharedRun(run) && (
                              <Badge variant="secondary" className="shrink-0 font-mono text-[9px]">
                                shared run
                              </Badge>
                            )}
                            {isTestingRun(run) && (
                              <Badge variant="outline" className="shrink-0 border-chart-3/40 font-mono text-[9px] text-chart-3">
                                test
                              </Badge>
                            )}
                            {runInputDocIds(run).map((docId) => (
                              <OpenInDocumentsLink key={docId} docId={docId} label="store" className="text-[9px]" />
                            ))}
                            <Badge
                              variant="outline"
                              className="shrink-0 font-mono text-[10px]"
                              style={run.status === "ok"
                                ? { color: palette.ok, borderColor: `${palette.ok}66` }
                                : { color: palette.err, borderColor: `${palette.err}66` }}
                            >
                              {run.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                          <span className="min-w-0 truncate">{run.model}</span>
                          <span className="shrink-0">
                            {formatSecondsShort(runTotalMs(run))} · {formatCostCents(runBilledCents(run))}
                          </span>
                        </div>
                        <span className="break-all font-mono text-[10px] text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString()} · {timeAgo(run.startedAt)} · {run.id}
                        </span>
                        {run.notes && <RunNotesPreview notes={run.notes} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        }
        trailing={
          !active ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <p className="text-xs text-muted-foreground">Select a run to view its trace.</p>
            </div>
          ) : (
            <ScrollArea className="min-h-0 min-w-0 flex-1">
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Run</p>
                    <p className="truncate font-mono text-xs">{active.id}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {active && runHasErrors(active) && (
                      <>
                        <IsolatedErrorActions run={active} modules={modules} />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 gap-1 font-mono text-[10px]"
                          onClick={() =>
                            spawnDiagnosis(
                              {
                                run: active,
                                projectId: project.id,
                                runLabel: runInputLabel(active),
                              },
                              globalModel,
                            )
                          }
                        >
                          <Bot className="h-3 w-3" />
                          diagnose
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 font-mono text-[10px]"
                      onClick={async () => {
                        await copyTextToClipboard(await runLogJson(active, docs))
                        setJsonCopied(true)
                        setTimeout(() => setJsonCopied(false), 2000)
                      }}
                    >
                      {jsonCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {jsonCopied ? "copied" : "copy_json"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 font-mono text-[10px]"
                      onClick={() => {
                        void copyTextToClipboard(runLogText(active))
                        setLogCopied(true)
                        setTimeout(() => setLogCopied(false), 2000)
                      }}
                    >
                      {logCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {logCopied ? "copied" : "copy_log"}
                    </Button>
                  </div>
                </div>

                {activeSourceDocs.map((doc) => (
                  <InputDocumentLink key={doc.id} doc={doc} />
                ))}

                <RunNotesEditor runId={active.id} notes={active.notes} />

                {active.test && (
                  // AI : persisted Testing-tab verdict — expected vs actual per pinned step.
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                    <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
                      Test · {active.test.testDocName}
                    </p>
                    <TestResults results={active.test.results} />
                  </div>
                )}

                {active.fingerprint && (
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Run fingerprint</p>
                    <p className="mt-1 font-mono text-[11px] break-all">{active.fingerprint}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      Hashes the full pipeline config and input documents — identical reruns skip compute and link here.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Latency", value: formatSecondsShort(runTotalMs(active)) },
                    { label: "Billed", value: formatCostCents(runBilledCents(active)) },
                    { label: "Saved (cache)", value: formatCostCents(runSavedCents(active)) },
                    {
                      label: "Cache hits",
                      value: `${active.steps.filter((s) => s.status === "cached").length}/${active.steps.length}`,
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-md border border-border bg-card p-2.5">
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">{stat.label}</p>
                      <p className="mt-0.5 font-mono text-sm">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {activeLlmCallGroups.length > 0 && (
                  <LlmCallDistribution callGroups={activeLlmCallGroups} />
                )}

                <div>
                  <div className="mb-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Step trace
                    </h3>
                  </div>
                  <ol className="space-y-1.5">
                    {active.steps.map((step, i) => {
                      const Icon = stepKindIcon(step.kind)
                      const { inTitle, outTitle } = stepIoLabels(step.kind)
                      const stepLlmCalls = llmCallsFromStep(step)
                      const descCheckLlmCalls = descriptionCheckLlmCallsFromStep(step)
                      const stepQuotes = quotesFromJson(step.outputJson)
                      const stepDoc = stepDocId(step)
                      const stepSourceDoc = stepSourceDocId(step)
                      const stepDocRef = stepDoc ? docs.find((d) => d.id === stepDoc) : undefined
                      const stepDocLinks = stepDocLinkLabels(stepDocRef)
                      const hasStepDocLink =
                        !!stepDoc &&
                        (step.kind === "input" || step.kind === "quote" || step.kind === "doc-to-text")
                      return (
                        <li
                          key={step.moduleId}
                          className="rounded-md border border-border bg-card px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span className="flex-1 truncate font-mono text-xs">{step.label}</span>
                            {step.status === "cached" && (
                              <Badge
                                variant="outline"
                                className="gap-1 border-chart-3/40 font-mono text-[10px] text-chart-3"
                              >
                                <Zap className="h-2.5 w-2.5" /> cached
                              </Badge>
                            )}
                            {step.model && (
                              <span className="font-mono text-[10px] text-muted-foreground">{step.model}</span>
                            )}
                            <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">
                              {step.ms}ms
                            </span>
                            <span className="w-16 text-right font-mono text-[10px] text-muted-foreground">
                              {step.status === "cached" && (step.savedCostCents ?? 0) > 0
                                ? `saved ${formatCostCents(step.savedCostCents!)}`
                                : formatCostCents(step.costCents)}
                            </span>
                          </div>

                          <StepFailuresSection step={step} className="ml-7" />

                          {(stepLlmCalls.length > 0 || descCheckLlmCalls.length > 0) && (
                            <LlmRetryGridSection
                              calls={[...stepLlmCalls, ...descCheckLlmCalls]}
                              stepSucceeded={step.status !== "error"}
                              promptCountHint={
                                step.kind === "llm-batch"
                                  ? step.inputPreviewItems?.length
                                  : undefined
                              }
                              className="ml-7"
                            />
                          )}

                          <StepInputDescription
                            description={resolveStepInputDescription(step, modules)}
                            check={step.inputDescriptionCheck}
                            forceVisible={step.status === "error"}
                            className="ml-7"
                          />

                          {descCheckLlmCalls.length > 0 && (
                            <LlmCallDistribution
                              calls={descCheckLlmCalls}
                              compact
                              title="Description validation"
                              stepSucceeded={step.inputDescriptionCheck?.matches !== false}
                            />
                          )}

                          {stepLlmCalls.length > 0 && (
                            <LlmCallDistribution
                              calls={stepLlmCalls}
                              compact
                              stepSucceeded={step.status !== "error"}
                            />
                          )}

                          {step.kind === "input" ? (
                            <StepLoadedDocSection step={step} docs={docs} models={models} />
                          ) : (
                          <IoSection
                            title={inTitle}
                            qualifier="input"
                            summary={compactPreview(step.inputPreview, PREVIEW_STEP_IO_CHARS)}
                            docLink={
                              hasStepDocLink
                                ? { docId: stepDoc, ...stepDocLinks.input }
                                : undefined
                            }
                            onExpand={() =>
                              setPopup({
                                text:
                                  step.inputPreviewItems?.length &&
                                  step.inputPreviewItems.length > 1
                                    ? step.inputPreviewItems
                                        .map((item) => `${item.label}\n${item.text}`)
                                        .join("\n\n")
                                    : step.inputPreview,
                                title: `${inTitle} (input) · ${step.label}`,
                                sourceDocId: stepSourceDoc,
                              })
                            }
                          >
                            {step.inputPreviewItems && step.inputPreviewItems.length > 1 ? (
                              <IoPager
                                items={step.inputPreviewItems}
                                renderItem={(item) => (
                                  <PromptText text={item.text} sourceDocId={stepSourceDoc} />
                                )}
                              />
                            ) : (
                              <PromptText text={step.inputPreview} sourceDocId={stepSourceDoc} />
                            )}
                          </IoSection>
                          )}

                          {step.serverLogs && step.serverLogs.length > 0 && (
                            <StepServerLogsSection
                              logs={step.serverLogs}
                              onExpand={(logs) =>
                                setPopup({
                                  serverLogs: logs,
                                  title: `Server logs · ${step.label}`,
                                })
                              }
                            />
                          )}

                          {step.status === "error" && step.outputPreview && (
                            <IoSection
                              title="Validation errors"
                              qualifier="error"
                              summary={compactPreview(step.outputPreview, PREVIEW_STEP_IO_CHARS)}
                              onExpand={() =>
                                setPopup({
                                  text: step.outputPreview,
                                  title: `Validation errors · ${step.label}`,
                                })
                              }
                            >
                              <p className="whitespace-pre-wrap text-destructive">{step.outputPreview}</p>
                            </IoSection>
                          )}

                          {!(step.kind === "input" && isDocReferenceOutputJson(step.outputJson)) && (
                          <IoSection
                            title={outTitle}
                            qualifier="output"
                            summary={
                              step.outputJson
                                ? compactPreview(step.outputJson, PREVIEW_STEP_IO_CHARS)
                                : step.status === "error"
                                  ? undefined
                                  : step.outputPreview
                            }
                            docLink={
                              hasStepDocLink
                                ? { docId: stepDoc, ...stepDocLinks.output }
                                : undefined
                            }
                            onExpand={() =>
                              setPopup(
                                step.outputJson
                                  ? { json: step.outputJson, title: `${outTitle} (output) · ${step.label}` }
                                  : { text: step.outputPreview, title: `${outTitle} (output) · ${step.label}` },
                              )
                            }
                          >
                            {step.outputJson ? (
                              <div className="-m-2 mt-0 h-[min(12rem,28vh)] overflow-hidden">
                                <JsonViewerEmbed
                                  json={step.outputJson}
                                  defaultView="table"
                                  className="h-full"
                                />
                              </div>
                            ) : step.status !== "error" ? (
                              step.outputPreview
                            ) : (
                              <span className="text-muted-foreground/70">No raw response captured</span>
                            )}
                          </IoSection>
                          )}

                          {stepQuotes.length > 0 && (
                            <QuoteLinks quotes={stepQuotes} className="mt-2 pl-7" />
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>

                {runPipeline && (
                  <div className="rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-2.5">
                      <div>
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Pipeline at run time
                        </h3>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          Same layout as the Pipeline tab — click a step to inspect its config.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 font-mono text-[10px]"
                        onClick={() => setCompareOpen(true)}
                        disabled={runs.length < 2}
                      >
                        <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                        compare_logs
                      </Button>
                    </div>
                    <div className="min-h-[20rem]">
                      <ResizableSplit
                        className="h-full min-h-[20rem]"
                        leadingWidth={pipelineCanvasWidth}
                        onLeadingWidthChange={setPipelineCanvasWidth}
                        onLeadingWidthCommit={commitPipelineCanvasWidth}
                        minLeading={loggingPipelineCanvasSplit.min}
                        maxLeading={loggingPipelineCanvasSplit.max}
                        leading={
                          <div className="min-h-0 overflow-x-auto px-4 py-6">
                            <PipelineCanvas
                              modules={runPipeline.modules}
                              models={models}
                              selectedId={selectedPipelineModuleId}
                              onSelect={setSelectedPipelineModuleId}
                              stepStatus={runPipeline.stepStatus}
                              invalid={runPipelineInvalid}
                            />
                          </div>
                        }
                        trailing={
                          <aside className="flex min-h-0 flex-col overflow-hidden">
                            <PipelineInspector
                              module={selectedPipelineModule}
                              models={models}
                              typeAliases={typeAliases}
                              modules={runPipeline.modules}
                            />
                          </aside>
                        }
                      />
                    </div>
                  </div>
                )}

                <StepProfiling runs={runs} stepOrder={active.steps} />
              </div>
            </ScrollArea>
          )
        }
      />

      {compareOpen && (
        <CompareModal
          runs={runs}
          runInputLabel={runInputLabel}
          runInputDocIds={runInputDocIds}
          initialRunId={active?.id}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {popup && <PopupModal payload={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}

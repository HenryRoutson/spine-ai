"use client"

import { useMemo, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useStore } from "@/lib/store"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { JsonHighlight, PromptText } from "@/components/highlight"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { LlmCallDistribution } from "@/components/llm-call-distribution"
import { StepProfiling } from "@/components/step-profiling"
import { InputDocumentLink } from "@/components/input-document-link"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { QuoteLinks, quotesFromJson } from "@/components/quote-links"
import { cn } from "@/lib/utils"
import { useDocViewer, type DocViewMode } from "@/lib/doc-viewer"
import { useAppShell } from "@/lib/app-shell"
import { stepDocId, stepDocLinkLabels } from "@/lib/step-doc"
import { collectRunLlmCalls, llmCallsFromStep } from "@/lib/llm-distribution"
import { timeAgo } from "@/lib/time-ago"
import { enrichRunModules, modulesFromRunSteps } from "@/lib/pipeline-run-diff"
import { PipelineCanvas } from "@/components/pipeline-canvas"
import { PipelineInspector } from "@/components/pipeline-inspector"
import { RunNotesEditor } from "@/components/run-notes-editor"
import { Search, ChevronRight, Database, Cpu, Code2, Combine, FileCog, Zap, Maximize2, X, Link2, GitCompareArrows } from "lucide-react"
import type { DocId, ModuleId, ModuleKind, PipelineRun, RunStepStatus } from "@/lib/types"

const KIND_ICON: Record<ModuleKind, typeof Cpu> = {
  input: Database,
  "doc-to-text": FileCog,
  llm: Cpu,
  "llm-batch": Cpu,
  quote: Link2,
  transform: Code2,
  combine: Combine,
  "custom-code": Code2,
  output: ChevronRight,
}

// AI : llm steps use prompt/response wording; quote step shows source + extracts → linked spans
import { isLlmKind } from "@/lib/module-kinds"

function stepIoLabels(kind: ModuleKind) {
  if (kind === "quote") {
    return { inTitle: "Source + extracts", outTitle: "Linked quotes" }
  }
  const isLlm = isLlmKind(kind)
  return {
    inTitle: isLlm ? "Prompt" : "Input",
    outTitle: isLlm ? "Response" : "Output",
  }
}

type PopupPayload = { json?: string; text?: string; title: string }

function filterRuns(runs: PipelineRun[], query: string): PipelineRun[] {
  if (!query.trim()) return runs
  const q = query.toLowerCase()
  return runs.filter(
    (r) =>
      r.model.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.notes?.toLowerCase().includes(q) ?? false) ||
      r.steps.some((s) => s.label.toLowerCase().includes(q)),
  )
}

const RUN_NOTES_PREVIEW_CHARS = 72

function previewRunNotes(notes: string): string {
  const flat = notes.replace(/\s+/g, " ").trim()
  if (flat.length <= RUN_NOTES_PREVIEW_CHARS) return flat
  return `${flat.slice(0, RUN_NOTES_PREVIEW_CHARS).trimEnd()}...`
}

function RunNotesPreview({ notes }: { notes: string }) {
  return (
    <p className="truncate text-[10px] text-muted-foreground/90" title={notes}>
      {previewRunNotes(notes)}
    </p>
  )
}

function RunPickerColumn({
  label,
  runs,
  docName,
  selectedId,
  onSelect,
  query,
  onQueryChange,
}: {
  label: string
  runs: PipelineRun[]
  docName: (id?: string) => string
  selectedId: string
  onSelect: (id: string) => void
  query: string
  onQueryChange: (q: string) => void
}) {
  const filtered = useMemo(() => filterRuns(runs, query), [runs, query])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter by model, step, run id…"
            className="h-8 pl-8 font-mono text-xs"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No matching runs.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((run) => (
              <li key={run.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(run.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(run.id)
                    }
                  }}
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent",
                    selectedId === run.id && "bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">{docName(run.inputDocId)}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {run.inputDocId && (
                        <OpenInDocumentsLink docId={run.inputDocId} label="store" className="text-[9px]" />
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 font-mono text-[10px]",
                          run.status === "ok"
                            ? "border-primary/40 text-primary"
                            : "border-destructive/40 text-destructive",
                        )}
                      >
                        {run.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{run.model}</span>
                    <span>
                      {(run.totalMs / 1000).toFixed(1)}s · ${(run.billedCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
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
  )
}

function IoSection({
  title,
  qualifier,
  summary,
  children,
  onExpand,
  docLink,
}: {
  title: string
  qualifier: "input" | "output" | "error"
  summary?: string
  children?: React.ReactNode
  onExpand?: () => void
  docLink?: { docId: DocId; mode: DocViewMode; label: string }
}) {
  const { open } = useDocViewer()

  function openDoc() {
    if (!docLink) return
    open({ docId: docLink.docId, start: 0, end: 0, mode: docLink.mode })
  }

  return (
    <div className="mt-2 pl-7">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {title}{" "}
          <span className="normal-case text-muted-foreground/70">({qualifier})</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {summary &&
            (docLink ? (
              <button
                type="button"
                onClick={openDoc}
                className="max-w-[220px] truncate font-mono text-[10px] text-primary hover:underline"
                title={docLink.label}
              >
                {summary}
              </button>
            ) : (
              <span className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground/80">
                {summary}
              </span>
            ))}
          {docLink && (
            <>
              <button
                type="button"
                onClick={openDoc}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
              >
                <Link2 className="h-3 w-3" />
                {docLink.label}
              </button>
              <OpenInDocumentsLink docId={docLink.docId} label="store" />
            </>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Open in full-screen viewer"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {docLink ? (
        <div
          role="button"
          tabIndex={0}
          onClick={openDoc}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openDoc()
            }
          }}
          className="cursor-pointer rounded border border-border bg-muted/20 p-2 font-mono text-[10px] leading-snug whitespace-pre-wrap text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          {children}
        </div>
      ) : (
        <div className="rounded border border-border bg-muted/20 p-2 font-mono text-[10px] leading-snug whitespace-pre-wrap text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  )
}

export function Logging() {
  const { runs, docs, modules, models } = useStore()
  const { focusRunId, clearFocusRun } = useAppShell()
  const [query, setQuery] = useState("")
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupPayload | null>(null)
  const [selectedPipelineModuleId, setSelectedPipelineModuleId] = useState<ModuleId | undefined>()
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareRunA, setCompareRunA] = useState<string>("")
  const [compareRunB, setCompareRunB] = useState<string>("")
  const [compareQueryA, setCompareQueryA] = useState("")
  const [compareQueryB, setCompareQueryB] = useState("")

  useEffect(() => {
    if (!focusRunId) return
    setSelectedRun(focusRunId)
    setSelectedPipelineModuleId(undefined)
    clearFocusRun()
  }, [focusRunId, clearFocusRun])

  const docName = (id?: string) => docs.find((d) => d.id === id)?.name ?? id ?? "—"

  const filtered = useMemo(() => filterRuns(runs, query), [runs, query])

  const active = runs.find((r) => r.id === selectedRun) ?? null
  const activeSourceDoc = active?.inputDocId ? docs.find((d) => d.id === active.inputDocId) : undefined
  const activeLlmCalls = active ? collectRunLlmCalls(active.steps) : []
  const popupQuotes = popup?.json ? quotesFromJson(popup.json) : []

  const runPipeline = useMemo(() => {
    if (!active) return null
    const modulesAtRun = enrichRunModules(modulesFromRunSteps(active.steps), modules)
    const stepStatus = new Map<ModuleId, RunStepStatus>(
      active.steps.map((s) => [s.moduleId, s.status]),
    )
    return { modules: modulesAtRun, stepStatus }
  }, [active, modules])

  const selectedPipelineModule = runPipeline?.modules.find((m) => m.id === selectedPipelineModuleId)

  function openCompare() {
    setCompareRunA(active?.id ?? runs[0]?.id ?? "")
    setCompareRunB(runs.find((r) => r.id !== active?.id)?.id ?? runs[1]?.id ?? "")
    setCompareQueryA("")
    setCompareQueryB("")
    setCompareOpen(true)
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="05 / Logging"
        title="Run History"
        description="Every inference run is recorded with a full per-step trace, token counts, and cost."
      />
      <div className="flex min-h-0 flex-1">
        {/* Run list */}
        <div className="flex w-[340px] flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by model, step, run id…"
                className="h-8 pl-8 font-mono text-xs"
              />
            </div>
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
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs">{docName(run.inputDocId)}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {run.inputDocId && (
                            <OpenInDocumentsLink docId={run.inputDocId} label="store" className="text-[9px]" />
                          )}
                          <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 font-mono text-[10px]",
                            run.status === "ok"
                              ? "border-primary/40 text-primary"
                              : "border-destructive/40 text-destructive",
                          )}
                          >
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                        <span>{run.model}</span>
                        <span>
                          {(run.totalMs / 1000).toFixed(1)}s · ${(run.billedCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
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

        {/* Detail */}
        <div className="min-w-0 flex-1">
          {!active ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">Select a run to view its trace.</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                {activeSourceDoc && <InputDocumentLink doc={activeSourceDoc} />}

                <RunNotesEditor runId={active.id} notes={active.notes} />

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
                    { label: "Latency", value: `${(active.totalMs / 1000).toFixed(1)}s` },
                    { label: "Billed", value: `$${(active.billedCents / 100).toFixed(2)}` },
                    { label: "Saved (cache)", value: `$${(active.savedCents / 100).toFixed(2)}` },
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

                {activeLlmCalls.length > 0 && (
                  <LlmCallDistribution calls={activeLlmCalls} />
                )}

                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Step trace
                  </h3>
                  <ol className="space-y-1.5">
                    {active.steps.map((step, i) => {
                      const Icon = KIND_ICON[step.kind] ?? Cpu
                      const { inTitle, outTitle } = stepIoLabels(step.kind)
                      const stepLlmCalls = llmCallsFromStep(step)
                      const stepQuotes = quotesFromJson(step.outputJson)
                      const stepDoc = stepDocId(step)
                      const stepDocRef = stepDoc ? docs.find((d) => d.id === stepDoc) : undefined
                      const stepDocLinks = stepDocLinkLabels(stepDocRef)
                      const hasStepDocLink =
                        !!stepDoc &&
                        (step.kind === "input" || step.kind === "doc-to-text" || step.kind === "quote")
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
                              ${(step.costCents / 100).toFixed(4)}
                            </span>
                          </div>

                          {stepLlmCalls.length > 0 && (
                            <LlmCallDistribution calls={stepLlmCalls} compact />
                          )}

                          <IoSection
                            title={inTitle}
                            qualifier="input"
                            summary={compactPreview(step.inputPreview)}
                            docLink={
                              hasStepDocLink
                                ? { docId: stepDoc, ...stepDocLinks.input }
                                : undefined
                            }
                            onExpand={() =>
                              setPopup({
                                text: step.inputPreview,
                                title: `${inTitle} (input) · ${step.label}`,
                              })
                            }
                          >
                            <PromptText text={step.inputPreview} />
                          </IoSection>

                          {step.status === "error" && step.outputPreview && (
                            <IoSection
                              title="Validation errors"
                              qualifier="error"
                              summary={compactPreview(step.outputPreview)}
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

                          <IoSection
                            title={outTitle}
                            qualifier="output"
                            summary={
                              step.outputJson
                                ? compactPreview(step.outputJson.replace(/\s+/g, " "))
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
                              <JsonHighlight json={step.outputJson} />
                            ) : step.status !== "error" ? (
                              step.outputPreview
                            ) : (
                              <span className="text-muted-foreground/70">No raw response captured</span>
                            )}
                          </IoSection>

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
                        onClick={openCompare}
                        disabled={runs.length < 2}
                      >
                        <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                        compare_logs
                      </Button>
                    </div>
                    <div className="grid min-h-[20rem] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,32%)]">
                      <div className="overflow-x-auto border-b border-border px-4 py-6 xl:border-b-0 xl:border-r">
                        <PipelineCanvas
                          modules={runPipeline.modules}
                          models={models}
                          selectedId={selectedPipelineModuleId}
                          onSelect={setSelectedPipelineModuleId}
                          stepStatus={runPipeline.stepStatus}
                        />
                      </div>
                      <aside className="flex min-h-48 flex-col">
                        <div className="border-b border-border px-4 py-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Inspector
                          </span>
                        </div>
                        <PipelineInspector module={selectedPipelineModule} models={models} />
                      </aside>
                    </div>
                  </div>
                )}

                <StepProfiling runs={runs} stepOrder={active.steps} />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {compareOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label="Close compare"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setCompareOpen(false)}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="font-mono text-xs text-muted-foreground">compare_logs</span>
              <button
                onClick={() => setCompareOpen(false)}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid h-[min(32rem,52vh)] min-h-[16rem] grid-cols-2 divide-x divide-border">
              <RunPickerColumn
                label="Pipeline A"
                runs={runs}
                docName={docName}
                selectedId={compareRunA}
                onSelect={setCompareRunA}
                query={compareQueryA}
                onQueryChange={setCompareQueryA}
              />
              <RunPickerColumn
                label="Pipeline B"
                runs={runs}
                docName={docName}
                selectedId={compareRunB}
                onSelect={setCompareRunB}
                query={compareQueryB}
                onQueryChange={setCompareQueryB}
              />
            </div>
            <div className="border-t border-border px-4 py-3">
              <p className="text-center text-xs text-muted-foreground">Not yet implemented.</p>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {popup && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col">
          <button
            aria-label="Close viewer"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setPopup(null)}
          />
          <div className="relative m-6 flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="font-mono text-xs text-muted-foreground">{popup.title}</span>
              <button
                onClick={() => setPopup(null)}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {popup.json ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {popupQuotes.length > 0 && <QuoteLinks quotes={popupQuotes} className="border-b border-border px-4 py-3" />}
                <JsonPreviewPanel json={popup.json} className="min-h-0 flex-1" />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                <PromptText text={popup.text ?? ""} />
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function compactPreview(text: string, max = 100): string {
  const one = text.replace(/\s+/g, " ").trim()
  return one.length <= max ? one : `${one.slice(0, max)}…`
}

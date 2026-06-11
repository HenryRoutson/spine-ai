"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  Circle,
  Zap,
  RotateCcw,
  Link2,
  AlertTriangle,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { useDocViewer } from "@/lib/doc-viewer"
import { awaitRun, startRun, type StepProgress } from "@/lib/run-engine"
import { collectQuotes } from "@/lib/quotes"
import type { DocId, DocRef, ModuleId, PipelineRun, ProjectId } from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { JsonHighlight } from "@/components/highlight"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { defaultInferenceDoc } from "@/lib/project-docs"
import { segmentPipeline } from "@/lib/pipeline-layout"

type Phase = "idle" | "running" | "done"

// AI : the shape the legal seed's "Extract Atomic Rules" step emits — rendered as cards;
// AI : anything else falls back to the generic quote list + final JSON.
interface RuleRow {
  rule_id: string
  description?: string
  severity?: number
  source?: { text: string; quote: { doc_id: string; start: number; end: number } }
}

function isRuleRows(v: unknown): v is RuleRow[] {
  return Array.isArray(v) && v.length > 0 && v.every((r) => r && typeof r === "object" && "rule_id" in r && "source" in r)
}

// AI : step errors are stored on RunStep.outputPreview — surface them instead of a generic "run error".
function pipelineRunError(run: PipelineRun): string | null {
  const step = run.steps.find((s) => s.status === "error")
  if (!step) return run.status === "error" ? "Pipeline failed" : null
  return step.outputPreview ? `${step.label}: ${step.outputPreview}` : `${step.label} failed`
}

export function Inference() {
  const { project, modules, model, addDoc, addRun, docs, refreshBilling } = useStore()
  const { open } = useDocViewer()
  const fileRef = useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [inputDoc, setInputDoc] = useState<DocRef | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepProgress["status"]>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inputModules = modules.filter((m) => m.kind === "input")

  // AI : reset sample doc when switching projects so legal PDFs don't stick on the DB pipeline.
  useEffect(() => {
    setInputDoc(defaultInferenceDoc(docs, project) ?? null)
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setError(null)
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      setInputDoc(await addDoc(files[0], "inference"))
    } catch (e) {
      setError((e as Error).message)
    }
    setUploading(false)
  }

  function useSample() {
    setInputDoc(defaultInferenceDoc(docs, project) ?? null)
  }

  async function start() {
    if (!inputDoc) return
    setPhase("running")
    setError(null)
    setRun(null)
    setStepStates(new Map())
    try {
      const jobId = await startRun(project.id as ProjectId, inputDoc.id as DocId, model)
      refreshBilling().catch(console.error)
      const finished = await awaitRun(jobId, (steps) => {
        setStepStates(new Map(steps.map((s) => [s.moduleId, s.status])))
      })
      setRun(finished)
      addRun(finished)
      const runErr = pipelineRunError(finished)
      if (runErr) setError(runErr)
      setPhase("done")
    } catch (e) {
      setError((e as Error).message)
      setPhase("idle")
    }
  }

  function reset() {
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setError(null)
  }

  const progressPct = useMemo(() => {
    if (phase === "idle") return 0
    if (phase === "done") return 100
    const done = [...stepStates.values()].filter((s) => s !== "running").length
    return Math.round((done / Math.max(1, modules.length)) * 100)
  }, [phase, stepStates, modules.length])

  // AI : real outputs — rule cards from the extraction step, plus the final step's JSON.
  const parsedSteps = useMemo(() => {
    return (run?.steps ?? []).map((s) => {
      try {
        return s.outputJson ? (JSON.parse(s.outputJson) as unknown) : undefined
      } catch {
        return undefined
      }
    })
  }, [run])
  const rules = useMemo(() => parsedSteps.find(isRuleRows) ?? [], [parsedSteps])
  const quotes = useMemo(
    () => [...new Map(parsedSteps.flatMap((v) => collectQuotes(v)).map((q) => [q.href, q])).values()],
    [parsedSteps],
  )
  const finalStep = useMemo(() => [...(run?.steps ?? [])].reverse().find((s) => s.outputJson), [run])
  const runErr = useMemo(() => (run ? pipelineRunError(run) : null), [run])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="04 / Inference"
        title="Run Pipeline"
        description="Drag a document onto an input to run the live pipeline against real models via OpenRouter."
        actions={
          phase !== "idle" ? (
            <Button variant="outline" size="sm" className="bg-transparent" onClick={reset} disabled={phase === "running"}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          ) : undefined
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
        {/* left: input + run controls */}
        <div className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          <div className="space-y-4 p-5">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
              )}
            >
              {uploading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <UploadCloud className={cn("h-7 w-7", dragOver ? "text-primary" : "text-muted-foreground")} />
              )}
              <p className="text-sm font-medium">{uploading ? "Parsing…" : "Drop a document to run"}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                pdf · word · excel · json · accepts {inputModules.length} input slot
                {inputModules.length === 1 ? "" : "s"}
              </p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-transparent" onClick={useSample}>
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Use sample
              </Button>
              {inputDoc && (
                <Badge variant="outline" className="gap-1.5 font-mono text-[10px]">
                  <FileText className="h-3 w-3 text-primary" /> {inputDoc.name}
                </Badge>
              )}
            </div>

            <Button className="w-full" disabled={!inputDoc || phase === "running"} onClick={start}>
              {phase === "running" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-4 w-4" />
              )}
              {phase === "running" ? "Running…" : "Run pipeline"}
            </Button>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <p className="font-mono text-[11px] text-destructive">{error}</p>
              </div>
            )}

            {/* high-level progress (mirrors the Logging high-level view) */}
            {phase !== "idle" && (
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    progress
                  </span>
                  <span className="font-mono text-[11px] text-primary">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-1.5" />
                <div className="mt-4 space-y-2.5">
                  {segmentPipeline(modules).map((seg) => {
                    if (seg.kind === "combine") {
                      const combineState = stepStates.get(seg.combine.id) ?? "idle"
                      const inputState = stepStates.get(seg.input.id) ?? "idle"
                      const state =
                        combineState === "error" || inputState === "error"
                          ? "error"
                          : combineState === "running" || inputState === "running"
                            ? "running"
                            : combineState === "cached" && inputState === "cached"
                              ? "cached"
                              : combineState !== "idle" || inputState !== "idle"
                                ? "ok"
                                : "idle"
                      return (
                        <div key={seg.combine.id} className="space-y-1">
                          <StepRow
                            label={seg.combine.label}
                            state={state}
                            errorMessage={run?.steps.find((s) => s.moduleId === seg.combine.id && s.status === "error")?.outputPreview}
                          />
                          <StepRow
                            label={seg.input.label}
                            state={inputState}
                            nested
                            errorMessage={run?.steps.find((s) => s.moduleId === seg.input.id && s.status === "error")?.outputPreview}
                          />
                        </div>
                      )
                    }
                    const moduleState = stepStates.get(seg.module.id) ?? "idle"
                    const failedStep = run?.steps.find((s) => s.moduleId === seg.module.id && s.status === "error")
                    return (
                      <StepRow
                        key={seg.module.id}
                        label={seg.module.label}
                        state={moduleState}
                        errorMessage={failedStep?.outputPreview}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {run && phase === "done" && (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="latency" value={`${(run.totalMs / 1000).toFixed(1)}s`} />
                <Stat label="billed" value={`$${(run.billedCents / 100).toFixed(2)}`} />
                <Stat label="saved" value={`$${(run.savedCents / 100).toFixed(2)}`} accent />
              </div>
            )}
          </div>
        </div>

        {/* right: validated output */}
        <div className="min-h-0 overflow-y-auto">
          <div className="p-5">
            {phase !== "done" || !run ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center">
                <Link2 className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Output appears here after a run.</p>
                <p className="max-w-xs font-mono text-[10px] text-muted-foreground">
                  extracted text is validated — click any quote to jump to its source in the document
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Validated Output</h3>
                  <Badge
                    className={cn(
                      run.status === "ok"
                        ? "bg-primary/15 text-primary hover:bg-primary/15"
                        : "bg-destructive/15 text-destructive hover:bg-destructive/15",
                    )}
                  >
                    {run.status === "ok" ? "schema valid" : "run error"}
                  </Badge>
                </div>

                {runErr && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    <p className="font-mono text-[11px] text-destructive">{runErr}</p>
                  </div>
                )}

                {rules.length > 0 && (
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      extracted rules · click a quote to verify
                    </p>
                    <div className="space-y-2">
                      {rules.map((r) => (
                        <div key={r.rule_id} className="rounded-md border border-border bg-card p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[9px]">
                              {r.rule_id}
                            </Badge>
                            {r.severity !== undefined && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                severity {r.severity}
                              </span>
                            )}
                          </div>
                          {r.description && <p className="text-xs text-foreground">{r.description}</p>}
                          {r.source?.quote && (
                            <button
                              onClick={() =>
                                open({
                                  docId: r.source!.quote.doc_id,
                                  start: r.source!.quote.start,
                                  end: r.source!.quote.end,
                                  text: r.source!.text,
                                })
                              }
                              className="mt-1.5 inline-flex items-start gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-left font-mono text-[10px] text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/20"
                            >
                              <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="line-clamp-1">&ldquo;{r.source.text}&rdquo;</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rules.length === 0 && quotes.length > 0 && (
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      source-linked quotes · click to verify
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {quotes.map((q) => (
                        <button
                          key={q.href}
                          onClick={() => open({ docId: q.doc_id, start: q.start, end: q.end, text: q.text })}
                          className="inline-flex items-start gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-left font-mono text-[10px] text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/20"
                        >
                          <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-1">&ldquo;{q.text}&rdquo;</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {finalStep?.outputJson && (
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      final output · {finalStep.label}
                    </p>
                    <div className="rounded border border-border bg-[oklch(0.14_0.004_264)] p-2">
                      <JsonHighlight json={finalStep.outputJson} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepRow({
  label,
  state,
  nested,
  errorMessage,
}: {
  label: string
  state: StepProgress["status"] | "idle"
  nested?: boolean
  errorMessage?: string
}) {
  return (
    <div className={cn(nested && "pl-5")}>
      <div className="flex items-center gap-2.5">
        {state === "ok" && <CheckCircle2 className="h-4 w-4 text-primary" />}
        {state === "cached" && <Zap className="h-4 w-4 text-chart-3" />}
        {state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {state === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
        {state === "idle" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
        <span className={cn("flex-1 text-xs", state === "idle" ? "text-muted-foreground" : "text-foreground")}>
          {label}
        </span>
        {state === "cached" && <span className="font-mono text-[10px] text-chart-3">cache · $0.00</span>}
      </div>
      {state === "error" && errorMessage && (
        <p className="mt-1 pl-7 font-mono text-[10px] text-destructive">{errorMessage}</p>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-sm", accent && "text-primary")}>{value}</p>
    </div>
  )
}

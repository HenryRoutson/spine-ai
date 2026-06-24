"use client"

import { useMemo, useRef, useState } from "react"
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  Circle,
  Zap,
  RotateCcw,
  Share2,
  Link2,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { useDocViewer } from "@/lib/doc-viewer"
import { buildRun } from "@/lib/run-engine"
import { SEED_RULES } from "@/lib/store"
import type { PipelineRun } from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type Phase = "idle" | "running" | "done"

export function Inference() {
  const { modules, models, model, addDoc, addRun, docs } = useStore()
  const { open } = useDocViewer()
  const fileRef = useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver] = useState(false)
  const [inputDoc, setInputDoc] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [activeStep, setActiveStep] = useState(-1)
  const [run, setRun] = useState<PipelineRun | null>(null)

  const inputModules = modules.filter((m) => m.kind === "input")

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    const doc = addDoc(f.name, "pdf", f.name + ":" + f.size, "inference")
    setInputDoc(doc.name)
  }

  function useSample() {
    setInputDoc(docs[0]?.name ?? "vendor_dpa_v2.pdf")
  }

  function start() {
    if (!inputDoc) return
    setPhase("running")
    setActiveStep(0)
    const built = buildRun(modules, models, model, "sha_doc")
    let i = 0
    const tick = () => {
      if (i >= built.steps.length) {
        setPhase("done")
        setActiveStep(built.steps.length)
        setRun(built)
        addRun(built)
        return
      }
      setActiveStep(i)
      const delay = built.steps[i].status === "cached" ? 220 : 520
      i++
      setTimeout(tick, delay)
    }
    tick()
  }

  function reset() {
    setPhase("idle")
    setActiveStep(-1)
    setRun(null)
  }

  const progressPct = useMemo(() => {
    if (phase === "idle") return 0
    if (phase === "done") return 100
    return Math.round((activeStep / Math.max(1, modules.length)) * 100)
  }, [phase, activeStep, modules.length])

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="04 / Inference"
        title="Run Pipeline"
        description="Drag a document onto an input to run the live pipeline. Share this page — no deploy required."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent">
              <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
            </Button>
            {phase !== "idle" && (
              <Button variant="outline" size="sm" className="bg-transparent" onClick={reset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>
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
              <UploadCloud className={cn("h-7 w-7", dragOver ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm font-medium">Drop a document to run</p>
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
                  <FileText className="h-3 w-3 text-primary" /> {inputDoc}
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
                  {modules.map((m, i) => {
                    const state =
                      i < activeStep || phase === "done"
                        ? m.cached
                          ? "cached"
                          : "done"
                        : i === activeStep && phase === "running"
                          ? "running"
                          : "idle"
                    return (
                      <div key={m.id} className="flex items-center gap-2.5">
                        {state === "done" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        {state === "cached" && <Zap className="h-4 w-4 text-chart-3" />}
                        {state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        {state === "idle" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
                        <span
                          className={cn(
                            "flex-1 text-xs",
                            state === "idle" ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          {m.label}
                        </span>
                        {state === "cached" && (
                          <span className="font-mono text-[10px] text-chart-3">cache · $0.00</span>
                        )}
                      </div>
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
            {phase !== "done" ? (
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
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                    schema valid
                  </Badge>
                </div>

                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    extracted rules · click a quote to verify
                  </p>
                  <div className="space-y-2">
                    {SEED_RULES.map((r) => (
                      <div key={r.ruleId} className="rounded-md border border-border bg-card p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[9px]">
                            {r.ruleId}
                          </Badge>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            severity {r.severity}
                          </span>
                        </div>
                        <p className="text-xs text-foreground">{r.description}</p>
                        <button
                          onClick={() => open({ docId: "sha_doc", start: r.start, end: r.end })}
                          className="mt-1.5 inline-flex items-start gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-left font-mono text-[10px] text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/20"
                        >
                          <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-1">&ldquo;{r.quote}&rdquo;</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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

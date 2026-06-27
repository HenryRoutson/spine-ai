"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Download,
  Loader2,
  Play,
  Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { orderedInputModules } from "@/lib/inference-input"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { InferenceRunOutputs } from "@/components/inference/inference-outputs"
import { InferenceStepRow } from "@/components/inference/inference-step-trace"
import { SharedRunInputSlot } from "@/components/shared-run-input-slot"
import {
  CyclingWaitPhrase,
  ErrorBanner,
  RunErrorSummary,
} from "@/components/inference/inference-run-chrome"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"
import type { DocId, DocRef, ModuleId, PipelineRun } from "@/lib/types"
import {
  awaitSharedRun,
  downloadBlob,
  fetchSharedDownload,
  fetchSharedLink,
  startSharedRun,
  uploadSharedDoc,
} from "@/lib/shared-run-client"
import { mergeStepStates } from "@/lib/run-engine"
import type { StepUiState } from "@/lib/run-engine"
import { pipelineRunError } from "@/lib/run-errors"

type Tab = "run" | "progress" | "download"

type InputDocs = Partial<Record<ModuleId, DocRef[]>>

export function SharedRunViewer({ linkId }: { linkId: string }) {
  const [link, setLink] = useState<SharedLinkPublicView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("run")
  const [viewerName, setViewerName] = useState("")
  const [inputDocs, setInputDocs] = useState<InputDocs>({})
  const [uploadingModule, setUploadingModule] = useState<ModuleId | null>(null)
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle")
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [progressToken, setProgressToken] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)

  useEffect(() => {
    fetchSharedLink(linkId)
      .then(setLink)
      .catch((e) => setLoadError((e as Error).message))
  }, [linkId])

  const inputModules = useMemo(
    () => (link ? orderedInputModules(link.modules) : []),
    [link],
  )

  const segments = useMemo(
    () => (link ? segmentPipeline(link.modules) : []),
    [link],
  )

  const defaultForModule = useCallback(
    (moduleId: ModuleId) => link?.defaultDocs.find((d) => d.moduleId === moduleId)?.filename,
    [link],
  )

  const handleUpload = useCallback(
    async (moduleId: ModuleId, file: File) => {
      setUploadingModule(moduleId)
      try {
        const doc = await uploadSharedDoc(linkId, moduleId, file)
        setInputDocs((prev) => {
          const cur = prev[moduleId] ?? []
          const multi = inputModules.find((m) => m.id === moduleId)?.inputMinCount ?? 1
          const next = multi > 1 ? [...cur, doc] : [doc]
          return { ...prev, [moduleId]: next }
        })
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setUploadingModule(null)
      }
    },
    [linkId, inputModules],
  )

  const handleClear = useCallback((moduleId: ModuleId, docId: DocId) => {
    setInputDocs((prev) => {
      const cur = prev[moduleId] ?? []
      const next = cur.filter((d) => d.id !== docId)
      if (!next.length) {
        const { [moduleId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [moduleId]: next }
    })
  }, [])

  const start = async () => {
    if (!link) return
    if (link.viewerNameRequired && !viewerName.trim()) {
      setError("Please enter your name")
      return
    }
    if (link.fundingMode === "viewer_signs_in") {
      window.location.href = `/login?next=${encodeURIComponent(`/run/${linkId}`)}`
      return
    }
    setPhase("running")
    setError(null)
    setRun(null)
    setTab("progress")
    setStepStates(new Map())
    try {
      const byModule: Partial<Record<ModuleId, DocId[]>> = {}
      for (const [mid, docs] of Object.entries(inputDocs)) {
        if (docs?.length) byModule[mid as ModuleId] = docs.map((d) => d.id)
      }
      const { jobId: jid, progressToken: tok } = await startSharedRun(
        linkId,
        byModule,
        viewerName.trim() || undefined,
      )
      setJobId(jid)
      setProgressToken(tok)
      const finished = await awaitSharedRun(linkId, jid, tok, (steps) => {
        setStepStates((prev) => mergeStepStates(prev, steps))
      })
      setRun(finished)
      const runErr = pipelineRunError(finished)
      if (runErr) setError(runErr)
      setPhase("done")
      setTab("download")
    } catch (e) {
      setError((e as Error).message)
      setPhase("idle")
    }
  }

  const handleDownloadAll = async () => {
    if (!run || !jobId || !progressToken) return
    setDownloadBusy(true)
    try {
      const data = await fetchSharedDownload(linkId, run.id, jobId, progressToken)
      downloadBlob(`run-${run.id}.md`, data.markdown, "text/markdown")
      for (const [i, out] of data.outputs.entries()) {
        if (out.json) {
          downloadBlob(`${out.label || `step-${i + 1}`}.json`, out.json, "application/json")
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDownloadBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    )
  }

  if (!link) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const doneSteps = run?.steps.filter((s) => s.status === "ok" || s.status === "cached") ?? []
  const progressPct =
    phase === "running"
      ? Math.round(
          ([...stepStates.values()].filter((s) => s.status !== "idle").length /
            Math.max(1, link.modules.length)) *
            100,
        )
      : phase === "done"
        ? 100
        : 0

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{link.name}</h1>
            {link.description && (
              <p className="truncate text-xs text-muted-foreground">{link.description}</p>
            )}
          </div>
          <Badge variant="outline" className="font-mono text-[9px]">
            shared pipeline
          </Badge>
        </div>
      </header>

      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-3xl gap-1 px-4 py-2">
          {(["run", "progress", "download"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              disabled={t === "download" && !run}
              className={cn(
                "rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                t === "download" && !run && "opacity-40",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-4">
        {error && <ErrorBanner text={error} />}

        {tab === "run" && (
          <div className="space-y-4">
            {link.viewerNameRequired && (
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your name
                </label>
                <Input
                  value={viewerName}
                  onChange={(e) => setViewerName(e.target.value)}
                  placeholder="Enter your name"
                  className="h-9 font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                pipeline · {inputModules.length} input{inputModules.length === 1 ? "" : "s"}
              </p>
              {segments.map((seg, i) => {
                const label =
                  seg.kind === "combine"
                    ? `${seg.combine.label} + ${seg.input.label}`
                    : seg.module.label
                const kind = seg.kind === "combine" ? "combine" : seg.module.kind
                return (
                  <div key={i} className="rounded-lg border border-border bg-card/50 px-3 py-2">
                    <p className="text-xs font-medium">
                      {i + 1}. {label}
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">{kind}</span>
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">inputs</p>
              {inputModules.map((m) => (
                <SharedRunInputSlot
                  key={m.id}
                  inputModule={m}
                  defaultFilename={defaultForModule(m.id)}
                  docs={inputDocs[m.id] ?? []}
                  uploading={uploadingModule === m.id}
                  onUpload={(file) => handleUpload(m.id, file)}
                  onClear={(docId) => handleClear(m.id, docId)}
                />
              ))}
            </div>

            {link.fundingMode === "viewer_pays" && (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Payment required before run — top up in Billing after signing in.
              </p>
            )}

            <Button className="w-full gap-2" onClick={start} disabled={phase === "running"}>
              {phase === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run pipeline
            </Button>
          </div>
        )}

        {tab === "progress" && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>{phase === "done" ? "complete" : phase === "running" ? "running…" : "idle"}</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            {phase === "running" && <CyclingWaitPhrase phrase="processing" />}
            <div className="space-y-2">
              {link.modules.map((m) => {
                const st = stepStates.get(m.id)
                return (
                  <InferenceStepRow
                    key={m.id}
                    label={m.label}
                    state={st?.status ?? "idle"}
                    sub={st?.sub}
                    isOutputStep={m.kind === "output"}
                  />
                )
              })}
            </div>
            {run && run.status === "error" && (
              <RunErrorSummary
                display={{
                  title: "Run failed",
                  message: pipelineRunError(run) ?? "Pipeline failed",
                }}
              />
            )}
            {run && (run.status === "ok" || run.status === "error") && (
              <InferenceRunOutputs steps={doneSteps.length ? doneSteps : run.steps} />
            )}
          </div>
        )}

        {tab === "download" && run && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download outputs from this run. Files are only available for this session.
            </p>
            <InferenceRunOutputs steps={run.steps.filter((s) => s.outputJson || s.outputPreview.trim())} />
            <Button className="w-full gap-2" onClick={handleDownloadAll} disabled={downloadBusy}>
              {downloadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download all outputs
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

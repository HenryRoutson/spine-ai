"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Download,
  Loader2,
  RotateCcw,
  Share2,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { docsForInputModule } from "@/lib/inference-input"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { InferenceRunOutputs } from "@/components/inference/inference-outputs"
import {
  ErrorBanner,
  HumanReviewPanel,
  RunErrorSummary,
} from "@/components/inference/inference-run-chrome"
import { InferenceStepTracePanel } from "@/components/inference/inference-step-trace-panel"
import { downloadBlob } from "@/lib/download-blob"
import { fetchSharedDownload, fetchSharedLink } from "@/lib/shared-run-client"
import { useSharedInferenceRun } from "@/lib/use-shared-inference-run"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"

export function SharedRunViewer({ linkId }: { linkId: string }) {
  const [link, setLink] = useState<SharedLinkPublicView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchSharedLink(linkId)
      .then(setLink)
      .catch((e) => setLoadError((e as Error).message))
  }, [linkId])

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <ErrorBanner text={loadError} />
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

  return <SharedRunContent link={link} linkId={linkId} />
}

function SharedRunContent({ link, linkId }: { link: SharedLinkPublicView; linkId: string }) {
  const run = useSharedInferenceRun(link, linkId)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleDownloadAll = async () => {
    if (!run.run || !run.jobId || !run.progressToken) return
    setDownloadBusy(true)
    setDownloadError(null)
    try {
      const data = await fetchSharedDownload(linkId, run.run.id, run.jobId, run.progressToken)
      downloadBlob(`run-${run.run.id}.md`, data.markdown, "text/markdown")
      for (const [i, out] of data.outputs.entries()) {
        if (out.json) {
          downloadBlob(`${out.label || `step-${i + 1}`}.json`, out.json, "application/json")
        }
      }
    } catch (e) {
      setDownloadError((e as Error).message)
    } finally {
      setDownloadBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
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
          {run.phase !== "idle" ? (
            <Button variant="outline" size="sm" className="h-7 bg-transparent" onClick={run.reset} disabled={run.phase === "running"}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          {link.viewerNameRequired && (
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Your name
              </label>
              <Input
                value={run.viewerName}
                onChange={(e) => run.setViewerName(e.target.value)}
                placeholder="Enter your name"
                className="h-9 font-mono text-xs"
                disabled={run.phase === "running"}
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              pipeline inputs · {run.inputModules.length} slot{run.inputModules.length === 1 ? "" : "s"}
            </p>
            {run.inputModules.map((m) => (
              <InferenceInputSlot
                key={m.id}
                variant="upload"
                inputModule={m}
                outModel={run.outModelFor(m)}
                defaultFilename={run.defaultForModule(m.id)}
                docs={docsForInputModule(run.inputDocs, m.id)}
                uploading={run.uploadingModule === m.id}
                onUpload={(file) => run.handleUpload(m.id, file)}
                onRemoveDoc={(docId) => run.removeInputDocForModule(m.id, docId)}
              />
            ))}
          </div>

          {link.fundingMode === "viewer_pays" && run.phase !== "running" && (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Payment required before run — top up in Billing after signing in.
            </p>
          )}

          <Button
            className="w-full"
            disabled={!run.allInputsReady || run.phase === "running"}
            onClick={run.start}
          >
            {run.runButtonBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-1.5 h-4 w-4" />
            )}
            {run.runButtonLabel}
          </Button>

          {run.pendingHumanReview && (
            <HumanReviewPanel
              spec={run.pendingHumanReview}
              module={link.modules.find((m) => m.id === run.pendingHumanReview!.moduleId)}
              onApprove={() => run.resolveHumanReview("approved")}
              onReject={() => run.resolveHumanReview("rejected")}
            />
          )}

          {run.error && run.phase !== "done" && <ErrorBanner text={run.error} />}

          {(run.phase === "running" || run.phase === "done") && (
            <>
              {run.phase === "done" && run.outputSteps.length > 0 && (
                <InferenceRunOutputs steps={run.outputSteps} models={link.models} />
              )}

              {run.phase === "done" && run.run && run.run.status !== "ok" && (
                <div className="rounded-lg border border-border bg-card px-6 py-6">
                  {run.runErrorDisplay ? (
                    <RunErrorSummary display={run.runErrorDisplay} technical={run.runErr} />
                  ) : (
                    <div className="text-center">
                      <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                      <p className="mt-4 text-sm font-medium">Pipeline could not finish</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Something went wrong during the run. See step trace below.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {run.phase === "done" && run.run && run.error && !run.runErrorDisplay && (
                <ErrorBanner text={run.error} />
              )}

              {downloadError && <ErrorBanner text={downloadError} />}

              <InferenceStepTracePanel
                modules={run.modules}
                phase={run.phase}
                stepStates={run.stepStates}
                run={run.run}
                progressPct={run.progressPct}
                waitPhrase={run.waitPhrase}
                docs={Object.values(run.inputDocs).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))}
                models={link.models}
                inputDocs={run.inputDocs}
                footer={
                  run.phase === "done" && run.run ? (
                    <Button
                      className="mt-4 w-full gap-2"
                      variant="outline"
                      onClick={handleDownloadAll}
                      disabled={downloadBusy || !run.jobId || !run.progressToken}
                    >
                      {downloadBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download all outputs
                    </Button>
                  ) : undefined
                }
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

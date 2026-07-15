"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CreditCard,
  Download,
  Loader2,
  RotateCcw,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { formatErrorForClipboard } from "@/lib/error-copy"
import { fetchSharedDownload } from "@/lib/shared-run-client"
import { useSharedInferenceRun } from "@/lib/use-shared-inference-run"
import { sharedLinkRequiresSignIn, viewerFundsSharedRun } from "@/lib/shared-link-funding"
import { SharedRunDocScopeProvider } from "@/lib/shared-run-doc-scope"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"

type SharedRunPanelProps = {
  link: SharedLinkPublicView
  linkId: string
  isAuthenticated: boolean
  onAuthRequired?: () => void
  onRunComplete?: () => void
  insufficientCredit?: boolean
  onOpenBilling?: () => void
}

export function SharedRunPanel({
  link,
  linkId,
  isAuthenticated,
  onAuthRequired,
  onRunComplete,
  insufficientCredit = false,
  onOpenBilling,
}: SharedRunPanelProps) {
  const run = useSharedInferenceRun(
    link,
    linkId,
    { isAuthenticated, onAuthRequired },
    onRunComplete,
  )
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

  const needsSignIn = sharedLinkRequiresSignIn(link.fundingMode) && !isAuthenticated
  const viewerFunds = viewerFundsSharedRun(link.fundingMode)
  const runBlocked =
    !run.allInputsReady ||
    run.phase === "running" ||
    link.spendLimitReached ||
    link.disabled ||
    needsSignIn ||
    insufficientCredit

  return (
    <SharedRunDocScopeProvider scope={{ linkId }}>
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

      {(link.billingMultiple > 1 || link.flatFeeCents > 0) && viewerFunds && (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Pricing:
          {link.billingMultiple > 1 ? ` ${link.billingMultiple}× measured LLM cost` : ""}
          {link.billingMultiple > 1 && link.flatFeeCents > 0 ? " plus" : ""}
          {link.flatFeeCents > 0 ? ` $${(link.flatFeeCents / 100).toFixed(2)} per run` : ""}
          .
        </p>
      )}

      {needsSignIn && run.phase !== "running" && (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {viewerFunds
            ? "Sign in to run — this link bills your account."
            : "Sign in to run — the link owner pays, not you."}
        </p>
      )}

      {insufficientCredit && !needsSignIn && run.phase !== "running" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-4 text-center">
          <p className="text-sm font-medium text-destructive">Not enough credit to start this run</p>
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
      )}

      {link.spendLimitReached && run.phase !== "running" && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          This link has reached its spending limit and cannot accept new runs.
        </p>
      )}

      {link.disabled && run.phase !== "running" && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          This link is temporarily disabled by its owner.
        </p>
      )}

      {!insufficientCredit && (
        <Button className="w-full" disabled={runBlocked} onClick={run.start}>
          {run.runButtonBusy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-1.5 h-4 w-4" />
          )}
          {needsSignIn ? "Sign in to run" : run.runButtonLabel}
        </Button>
      )}

      {run.pendingHumanReview && (
        <HumanReviewPanel
          spec={run.pendingHumanReview}
          module={link.modules.find((m) => m.id === run.pendingHumanReview!.moduleId)}
          onApprove={(feedback) => run.resolveHumanReview("approved", feedback)}
          onReject={(feedback) => run.resolveHumanReview("rejected", feedback)}
        />
      )}

      {run.error && run.phase !== "done" && (
        <ErrorBanner
          text={run.error.split("\n")[0] ?? run.error}
          copyText={formatErrorForClipboard({
            uiLocation: "Shared link → Run → start run",
            summary: run.error,
          })}
          uiLocation="Shared link → Run → start run"
        />
      )}

      {(run.phase === "running" || run.phase === "done") && (
        <>
          {run.phase === "done" && run.outputSteps.length > 0 && (
            <InferenceRunOutputs steps={run.outputSteps} models={link.models} />
          )}

          {run.phase === "done" && run.run && run.run.status !== "ok" && (
            <div className="rounded-lg border border-border bg-card px-6 py-6">
              {run.runErrorDisplay ? (
                <RunErrorSummary
                  display={run.runErrorDisplay}
                  technical={run.runErr}
                  uiLocation="Shared link → Run → last run error"
                />
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
            <ErrorBanner
              text={run.error.split("\n")[0] ?? run.error}
              copyText={formatErrorForClipboard({
                uiLocation: "Shared link → Run → run error",
                summary: run.error,
              })}
              uiLocation="Shared link → Run → run error"
            />
          )}

          {downloadError && (
            <ErrorBanner
              text={downloadError}
              uiLocation="Shared link → Run → download error"
            />
          )}

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

      {run.phase !== "idle" ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-transparent"
          onClick={run.reset}
          disabled={run.phase === "running"}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset run
        </Button>
      ) : null}
    </div>
    </SharedRunDocScopeProvider>
  )
}

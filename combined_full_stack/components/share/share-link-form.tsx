"use client"

// AI : TODO (arch-share-form) — spend-limit parse, busy/error, default-docs, copy-to-clipboard duplicated
// AI :   with host-api-form and share-embed-form; SharePricingFields already extracted — add useShareCreateForm.
// AI :   Don't merge Link vs API vs Embed products.

import { useMemo, useState } from "react"
import { Copy, Link2, Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { ShareFundingPicker } from "@/components/share/share-funding-flow"
import { parseSharePricing, parseSpendLimitUsd, SharePricingFields } from "@/components/share/share-pricing-fields"
import { HtmlPreviewFrame } from "@/components/share/html-preview-frame"
import { ShareViewerDocsFields } from "@/components/share/share-viewer-docs-fields"
import { SharedLinkPreview } from "@/components/share/shared-link-preview"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { composeViewerMarkdown } from "@/lib/share-viewer-markdown"
import { SharedLinkFundingMode } from "@/lib/types"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

const LINK_FUNDING_OPTIONS = [
  {
    value: SharedLinkFundingMode.SharerPays,
    label: "You pay (no sign in required)",
    senderPays: true,
    description: "Anyone with the link can run — billed to your credits.",
  },
  {
    value: SharedLinkFundingMode.ViewerSignsIn,
    label: "You pay (sign in required)",
    senderPays: true,
    receiverSignInRequired: true,
    description: "Viewer signs in to run — still billed to your credits, not theirs.",
  },
  {
    value: SharedLinkFundingMode.ViewerPays,
    label: "Viewer pays (sign in required)",
    senderPays: false,
    receiverSignInRequired: true,
    description: "Viewer signs in, tops up in Billing, and funds each run.",
  },
] as const

const SIMPLE_LINK_FUNDING_OPTIONS = [
  {
    value: SharedLinkFundingMode.SharerPays,
    label: "I'll pay",
    senderPays: true,
    description: "Anyone with the link can run it — billed to you.",
  },
  {
    value: SharedLinkFundingMode.ViewerPays,
    label: "They pay",
    senderPays: false,
    receiverSignInRequired: true,
    description: "They sign in and use their own credits.",
  },
] as const

export function ShareLinkForm({
  project,
  docs,
  inferenceInputDocIds,
  onCreated,
  simple = false,
}: {
  project: Project
  docs: DocRef[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  onCreated?: () => void
  simple?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [fundingMode, setFundingMode] = useState<SharedLinkFundingMode>(SharedLinkFundingMode.SharerPays)
  const [viewerNameRequired, setViewerNameRequired] = useState(false)
  const [spendLimitEnabled, setSpendLimitEnabled] = useState(false)
  const [spendLimitUsd, setSpendLimitUsd] = useState("5.00")
  const [billingMultiple, setBillingMultiple] = useState("1.0")
  const [flatFeeEnabled, setFlatFeeEnabled] = useState(false)
  const [flatFeeUsd, setFlatFeeUsd] = useState("0.50")
  const [showDocs, setShowDocs] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [appendProjectDocs, setAppendProjectDocs] = useState(false)

  const viewerFunds = viewerFundsSharedRun(fundingMode)
  const defaultDocsByModule = useMemo(
    () => shareDefaultDocsByModule(project, docs, inferenceInputDocIds),
    [project, docs, inferenceInputDocIds],
  )
  const viewerMarkdown = composeViewerMarkdown({
    showDocs,
    instructions,
    appendProjectDocs,
    projectDocumentation: project.documentation ?? "",
  })

  async function createLink() {
    setBusy(true)
    setError(null)
    const spend = parseSpendLimitUsd(spendLimitEnabled, spendLimitUsd)
    if (!spend.ok) {
      setError(spend.error)
      setBusy(false)
      return
    }
    const spendLimitCents = spend.spendLimitCents
    const pricing = viewerFunds
      ? parseSharePricing(billingMultiple, flatFeeEnabled, flatFeeUsd)
      : { ok: true as const, billingMultiple: 1, flatFeeCents: 0 }
    if (!pricing.ok) {
      setError(pricing.error)
      setBusy(false)
      return
    }
    try {
      const body = await apiJson<{ url: string }>(API_ROUTES.sharedLinks, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          fundingMode,
          viewerNameRequired,
          spendLimitCents,
          billingMultiple: pricing.billingMultiple,
          flatFeeCents: pricing.flatFeeCents || undefined,
          defaultDocsByModule,
          viewerMarkdown,
        }),
      })
      setUrl(`${window.location.origin}${body.url}`)
      onCreated?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copyUrl() {
    if (!url) return
    await copyTextToClipboard(url)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{simple ? "Share a link" : "Public link"}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {simple
            ? "Send this to anyone. They can run it in their browser."
            : "Share a run page — viewers see defaults plus their own uploads."}
        </p>
      </div>

      {!url ? (
        <>
          <ShareFundingPicker
            value={fundingMode}
            onChange={(v) => setFundingMode(v as SharedLinkFundingMode)}
            senderLabel="You"
            receiverLabel="Viewer"
            options={simple ? [...SIMPLE_LINK_FUNDING_OPTIONS] : [...LINK_FUNDING_OPTIONS]}
            simple={simple}
          />

          {viewerFunds && !simple && (
            <SharePricingFields
              billingMultiple={billingMultiple}
              onBillingMultipleChange={setBillingMultiple}
              flatFeeUsd={flatFeeUsd}
              onFlatFeeUsdChange={setFlatFeeUsd}
              flatFeeEnabled={flatFeeEnabled}
              onFlatFeeEnabledChange={setFlatFeeEnabled}
              perUnitLabel="run"
            />
          )}

          {simple ? null : (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={viewerNameRequired}
                onChange={(e) => setViewerNameRequired(e.target.checked)}
              />
              Require viewer name
            </label>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={spendLimitEnabled}
                onChange={(e) => setSpendLimitEnabled(e.target.checked)}
              />
              {simple ? "Stop after this much is spent" : "Set spending limit"}
            </label>
            {spendLimitEnabled && (
              <div className="flex items-center gap-2 pl-5">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={spendLimitUsd}
                  onChange={(e) => setSpendLimitUsd(e.target.value)}
                  className={cn("h-8 w-28 text-xs", !simple && "font-mono")}
                />
                {simple ? null : (
                  <span className="text-[10px] text-muted-foreground">max billed via this link</span>
                )}
              </div>
            )}
          </div>

          <ShareDefaultFiles
            project={project}
            docs={docs}
            defaultDocsByModule={defaultDocsByModule}
            simple={simple}
          />

          <ShareViewerDocsFields
            showDocs={showDocs}
            onShowDocsChange={setShowDocs}
            instructions={instructions}
            onInstructionsChange={setInstructions}
            appendProjectDocs={appendProjectDocs}
            onAppendProjectDocsChange={setAppendProjectDocs}
            projectDocumentation={project.documentation ?? ""}
            simple={simple}
          />

          <HtmlPreviewFrame label="Link preview">
            <SharedLinkPreview
              projectName={project.name}
              viewerMarkdown={viewerMarkdown}
              modules={project.modules}
            />
          </HtmlPreviewFrame>
        </>
      ) : null}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {url ? (
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 truncate rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[10px]">
            {url}
          </code>
          <Button size="sm" variant="outline" onClick={() => void copyUrl()}>
            {copied ? <Copy className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {simple ? <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span> : null}
          </Button>
        </div>
      ) : (
        <Button className="w-full gap-2" onClick={() => void createLink()} disabled={busy} spineId="share.create-link">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          {simple ? "Create share link" : "Create link"}
        </Button>
      )}
    </div>
  )
}

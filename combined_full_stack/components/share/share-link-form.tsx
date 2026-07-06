"use client"

import { useMemo, useState } from "react"
import { Copy, Link2, Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { parseSharePricing, SharePricingFields } from "@/components/share/share-pricing-fields"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { SharedLinkFundingMode } from "@/lib/types"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"

export function ShareLinkForm({
  project,
  docs,
  inferenceInputDocIds,
  onCreated,
}: {
  project: Project
  docs: DocRef[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  onCreated?: () => void
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

  const viewerFunds = fundingMode === "viewer_pays" || fundingMode === "viewer_signs_in"
  const defaultDocsByModule = useMemo(
    () => shareDefaultDocsByModule(project, docs, inferenceInputDocIds),
    [project, docs, inferenceInputDocIds],
  )

  async function createLink() {
    setBusy(true)
    setError(null)
    let spendLimitCents: number | undefined
    if (spendLimitEnabled) {
      const parsed = Number.parseFloat(spendLimitUsd)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Enter a valid spending limit greater than $0")
        setBusy(false)
        return
      }
      spendLimitCents = Math.round(parsed * 100)
    }
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
        <h3 className="text-sm font-semibold">Public link</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Share a run page — viewers see defaults plus their own uploads.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="font-mono text-[10px] uppercase tracking-wider">Who pays</Label>
        <Select
          value={fundingMode}
          onValueChange={(v) => setFundingMode(v as SharedLinkFundingMode)}
        >
          <SelectTrigger className="h-auto min-h-9 w-full py-2 text-left text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="sharer_pays">You pay (default)</SelectItem>
            <SelectItem value="viewer_signs_in">Viewer signs in & pays</SelectItem>
            <SelectItem value="viewer_pays">Viewer pays (sign in required)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {viewerFunds && (
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

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={viewerNameRequired}
          onChange={(e) => setViewerNameRequired(e.target.checked)}
        />
        Require viewer name
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={spendLimitEnabled}
            onChange={(e) => setSpendLimitEnabled(e.target.checked)}
          />
          Set spending limit
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
              className="h-8 w-28 font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground">max billed via this link</span>
          </div>
        )}
      </div>

      <ShareDefaultFiles project={project} docs={docs} defaultDocsByModule={defaultDocsByModule} />

      {error && <p className="text-xs text-destructive">{error}</p>}

      {url ? (
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 truncate rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[10px]">
            {url}
          </code>
          <Button size="sm" variant="outline" onClick={() => void copyUrl()}>
            {copied ? <Copy className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ) : (
        <Button className="w-full gap-2" onClick={() => void createLink()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Create link
        </Button>
      )}
    </div>
  )
}

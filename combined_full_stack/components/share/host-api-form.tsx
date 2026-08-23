"use client"

// AI : TODO (arch-share-form) — spend-limit parse, busy/error, default-docs, copy-to-clipboard duplicated
// AI :   with share-link-form and share-embed-form; SharePricingFields already extracted — add useShareCreateForm.

import { useMemo, useState } from "react"
import { Copy, KeyRound, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { ShareFundingPicker } from "@/components/share/share-funding-flow"
import { parseSharePricing, parseSpendLimitUsd, SharePricingFields } from "@/components/share/share-pricing-fields"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { HostedApiFundingMode } from "@/lib/types"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"

// AI : Share Embed path is separate — keep deploy keys server-side; document custom UI = caller backend + this API, website UI drop-in = Embed (origin allowlist).
const API_FUNDING_OPTIONS = [
  {
    value: HostedApiFundingMode.OwnerPays,
    label: "You pay (default)",
    senderPays: true,
    description: "Calls bill your workspace credits.",
  },
  {
    value: HostedApiFundingMode.CallerPays,
    label: "Caller pays (billable API)",
    senderPays: false,
    description: "Callers pass X-Spine-Billing-Key — you earn markup above LLM cost.",
  },
] as const

type CreatedHostedApi = {
  apiKey: string
  invokeUrl: string
  progressUrl: string
  fundingMode: HostedApiFundingMode
}

export function HostApiForm({
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
  const [created, setCreated] = useState<CreatedHostedApi | null>(null)
  const [copied, setCopied] = useState<"key" | "curl" | null>(null)
  const [spendLimitEnabled, setSpendLimitEnabled] = useState(false)
  const [spendLimitUsd, setSpendLimitUsd] = useState("10.00")
  const [fundingMode, setFundingMode] = useState<HostedApiFundingMode>(HostedApiFundingMode.OwnerPays)
  const [billingMultiple, setBillingMultiple] = useState("1.0")
  const [flatFeeEnabled, setFlatFeeEnabled] = useState(false)
  const [flatFeeUsd, setFlatFeeUsd] = useState("0.50")

  const callerPays = fundingMode === HostedApiFundingMode.CallerPays
  const defaultDocsByModule = useMemo(
    () => shareDefaultDocsByModule(project, docs, inferenceInputDocIds),
    [project, docs, inferenceInputDocIds],
  )

  async function createApi() {
    setBusy(true)
    setError(null)
    const spend = parseSpendLimitUsd(spendLimitEnabled, spendLimitUsd)
    if (!spend.ok) {
      setError(spend.error)
      setBusy(false)
      return
    }
    const spendLimitCents = spend.spendLimitCents
    const pricing = callerPays
      ? parseSharePricing(billingMultiple, flatFeeEnabled, flatFeeUsd)
      : { ok: true as const, billingMultiple: 1, flatFeeCents: 0 }
    if (!pricing.ok) {
      setError(pricing.error)
      setBusy(false)
      return
    }
    try {
      const body = await apiJson<CreatedHostedApi & { api: { fundingMode: HostedApiFundingMode } }>(
        API_ROUTES.hostedApis,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            projectId: project.id,
            fundingMode,
            billingMultiple: pricing.billingMultiple,
            flatFeeCents: pricing.flatFeeCents || undefined,
            spendLimitCents,
            defaultDocsByModule,
          }),
        },
      )
      setCreated({
        apiKey: body.apiKey,
        invokeUrl: `${window.location.origin}${body.invokeUrl}`,
        progressUrl: `${window.location.origin}${body.progressUrl}`,
        fundingMode: body.api?.fundingMode ?? fundingMode,
      })
      onCreated?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string, kind: "key" | "curl") {
    await copyTextToClipboard(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), COPY_FEEDBACK_MS)
  }

  const curlExample =
    created &&
    (created.fundingMode === HostedApiFundingMode.CallerPays
      ? `curl -X POST '${created.invokeUrl}' \\
  -H 'X-Spine-Api-Key: ${created.apiKey}' \\
  -H 'X-Spine-Billing-Key: <your_billing_key>' \\
  -H 'Content-Type: application/json' \\
  -d '{"inputsByModule":{}}'`
      : `curl -X POST '${created.invokeUrl}' \\
  -H 'Authorization: Bearer ${created.apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{"inputsByModule":{}}'`)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Hosted API</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          REST endpoint for programmatic runs — deploy key shown once.
        </p>
      </div>

      <ShareFundingPicker
        value={fundingMode}
        onChange={(v) => setFundingMode(v as HostedApiFundingMode)}
        senderLabel="You"
        receiverLabel="Caller"
        options={[...API_FUNDING_OPTIONS]}
      />

      {callerPays && (
        <SharePricingFields
          billingMultiple={billingMultiple}
          onBillingMultipleChange={setBillingMultiple}
          flatFeeUsd={flatFeeUsd}
          onFlatFeeUsdChange={setFlatFeeUsd}
          flatFeeEnabled={flatFeeEnabled}
          onFlatFeeEnabledChange={setFlatFeeEnabled}
          perUnitLabel="call"
        />
      )}

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
          </div>
        )}
      </div>

      <ShareDefaultFiles project={project} docs={docs} defaultDocsByModule={defaultDocsByModule} />

      {error && <p className="text-xs text-destructive">{error}</p>}

      {created ? (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
            Copy your API key now — it will not be shown again.
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider">API key</Label>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[10px]">
                {created.apiKey}
              </code>
              <Button size="sm" variant="outline" onClick={() => void copy(created.apiKey, "key")}>
                {copied === "key" ? <Copy className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider">Invoke URL</Label>
            <code className="block truncate rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[10px]">
              {created.invokeUrl}
            </code>
          </div>
          {curlExample && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="font-mono text-[10px] uppercase tracking-wider">Example</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px]"
                  onClick={() => void copy(curlExample, "curl")}
                >
                  {copied === "curl" ? "Copied" : "Copy curl"}
                </Button>
              </div>
              <pre className="max-h-40 overflow-auto rounded border border-border bg-muted/20 p-2 font-mono text-[9px] leading-relaxed">
                {curlExample}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <Button className="w-full gap-2" onClick={() => void createApi()} disabled={busy} spineId="share.deploy-api">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Deploy API
        </Button>
      )}
    </div>
  )
}

"use client"
// AI : parity ids — share.create-site

import { useMemo, useState } from "react"
import { Copy, ExternalLink, LayoutTemplate, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { ShareFundingPicker } from "@/components/share/share-funding-flow"
import { parseSharePricing, parseSpendLimitUsd, SharePricingFields } from "@/components/share/share-pricing-fields"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { SharedLinkFundingMode } from "@/lib/types"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { HostedSiteBrand, HostedSiteOptions, SharedLinkRecord } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_HTML, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"

const SITE_FUNDING_OPTIONS = [
  {
    value: SharedLinkFundingMode.SharerPays,
    label: "You pay (no sign in required)",
    senderPays: true,
    description: "Anyone on the page can run — billed to your credits.",
  },
  {
    value: SharedLinkFundingMode.ViewerSignsIn,
    label: "You pay (sign in required)",
    senderPays: true,
    receiverSignInRequired: true,
    description: "Visitor signs in to run — still billed to your credits.",
  },
  {
    value: SharedLinkFundingMode.ViewerPays,
    label: "Viewer pays (sign in required)",
    senderPays: false,
    receiverSignInRequired: true,
    description: "Visitor signs in and funds each run from their credits.",
  },
] as const

function brandFromState(partial: HostedSiteBrand): HostedSiteBrand {
  return normalizeHostedSiteOptions({ brand: partial }).brand
}

export function ShareSiteForm({
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
  const [created, setCreated] = useState<{ url: string; link: SharedLinkRecord } | null>(null)
  const [copied, setCopied] = useState(false)
  const [fundingMode, setFundingMode] = useState<SharedLinkFundingMode>(SharedLinkFundingMode.SharerPays)
  const [viewerNameRequired, setViewerNameRequired] = useState(false)
  const [spendLimitEnabled, setSpendLimitEnabled] = useState(true)
  const [spendLimitUsd, setSpendLimitUsd] = useState("10.00")
  const [billingMultiple, setBillingMultiple] = useState("1.0")
  const [flatFeeEnabled, setFlatFeeEnabled] = useState(false)
  const [flatFeeUsd, setFlatFeeUsd] = useState("0.50")
  const [companyName, setCompanyName] = useState(project.name)
  const [tagline, setTagline] = useState("Run this pipeline")
  const [logoUrl, setLogoUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_HOSTED_SITE_OPTIONS.brand.primaryColor)
  const [accentColor, setAccentColor] = useState(DEFAULT_HOSTED_SITE_OPTIONS.brand.accentColor)
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_HOSTED_SITE_OPTIONS.brand.backgroundColor)
  const [textColor, setTextColor] = useState(DEFAULT_HOSTED_SITE_OPTIONS.brand.textColor)
  const [customHtml, setCustomHtml] = useState(DEFAULT_HOSTED_SITE_HTML)
  const [customCss, setCustomCss] = useState("")
  const [hideSpineFooter, setHideSpineFooter] = useState(false)

  const viewerFunds = viewerFundsSharedRun(fundingMode)
  const defaultDocsByModule = useMemo(
    () => shareDefaultDocsByModule(project, docs, inferenceInputDocIds),
    [project, docs, inferenceInputDocIds],
  )

  const previewOptions: HostedSiteOptions = useMemo(
    () =>
      normalizeHostedSiteOptions({
        brand: {
          companyName,
          tagline,
          logoUrl,
          primaryColor,
          accentColor,
          backgroundColor,
          textColor,
        },
        customHtml,
        customCss,
        hideSpineFooter,
      }),
    [companyName, tagline, logoUrl, primaryColor, accentColor, backgroundColor, textColor, customHtml, customCss, hideSpineFooter],
  )

  function siteOptionsBody(): HostedSiteOptions {
    return {
      brand: brandFromState({
        companyName,
        tagline,
        logoUrl,
        primaryColor,
        accentColor,
        backgroundColor,
        textColor,
      }),
      customHtml,
      customCss,
      hideSpineFooter,
    }
  }

  async function createSite() {
    setBusy(true)
    setError(null)
    if (!companyName.trim()) {
      setError("Add a company name — it becomes the page title.")
      setBusy(false)
      return
    }
    const spend = parseSpendLimitUsd(spendLimitEnabled, spendLimitUsd)
    if (!spend.ok) {
      setError(spend.error)
      setBusy(false)
      return
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
      const body = await apiJson<{ url: string; link: SharedLinkRecord }>(API_ROUTES.sharedLinks, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          kind: "site",
          fundingMode,
          viewerNameRequired,
          spendLimitCents: spend.spendLimitCents,
          billingMultiple: pricing.billingMultiple,
          flatFeeCents: pricing.flatFeeCents || undefined,
          defaultDocsByModule,
          siteOptions: siteOptionsBody(),
        }),
      })
      setCreated({ url: `${window.location.origin}${body.url}`, link: body.link })
      onCreated?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveSite() {
    if (!created) return
    setBusy(true)
    setError(null)
    if (!companyName.trim()) {
      setError("Add a company name — it becomes the page title.")
      setBusy(false)
      return
    }
    try {
      const body = await apiJson<{ link: SharedLinkRecord }>(API_ROUTES.sharedLink(created.link.id), {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ siteOptions: siteOptionsBody() }),
      })
      setCreated({ url: created.url, link: body.link })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copyUrl() {
    if (!created) return
    await copyTextToClipboard(created.url)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Hosted company page</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Wrap this pipeline in custom HTML with your company&apos;s look. We host the page — no website
          or database of your own.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Company name</Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="h-8 text-xs"
            placeholder="Acme"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tagline</Label>
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="h-8 text-xs"
            placeholder="Invoice review in one click"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Logo URL (optional)</Label>
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="https://…"
          />
        </div>
        {(
          [
            ["Primary", primaryColor, setPrimaryColor],
            ["Accent", accentColor, setAccentColor],
            ["Background", backgroundColor, setBackgroundColor],
            ["Text", textColor, setTextColor],
          ] as const
        ).map(([label, value, setValue]) => (
          <div key={label} className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-border bg-background p-0.5"
              />
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Custom HTML</Label>
        <textarea
          value={customHtml}
          onChange={(e) => setCustomHtml(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="text-[10px] text-muted-foreground">
          Place {`{{run}}`} where the pipeline should appear. {`{{company}}`}, {`{{tagline}}`}, and{" "}
          {`{{logo}}`} fill from the fields above. Scripts are stripped.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Extra CSS (optional)</Label>
        <textarea
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder=".hs-title { letter-spacing: -0.03em; }"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={hideSpineFooter}
          onChange={(e) => setHideSpineFooter(e.target.checked)}
        />
        Hide Spine footer
      </label>

      <div className="overflow-hidden rounded-md border border-border">
        <p className="border-b border-border bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">Preview</p>
        <div className="max-h-64 overflow-auto">
          <HostedSiteChrome options={previewOptions}>
            <div className="p-6 text-center text-xs text-muted-foreground">Pipeline runs here</div>
          </HostedSiteChrome>
        </div>
      </div>

      <ShareFundingPicker
        value={fundingMode}
        onChange={(v) => setFundingMode(v as SharedLinkFundingMode)}
        senderLabel="You"
        receiverLabel="Viewer"
        options={[...SITE_FUNDING_OPTIONS]}
      />

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
            <span className="text-[10px] text-muted-foreground">max billed via this page</span>
          </div>
        )}
      </div>

      <ShareDefaultFiles project={project} docs={docs} defaultDocsByModule={defaultDocsByModule} />

      {error && <p className="text-xs text-destructive">{error}</p>}

      {created ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[11px] text-muted-foreground">Live page URL — send this, no hosting required:</p>
          <code className="block truncate font-mono text-[10px]">{created.url}</code>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void copyUrl()}>
              <Copy className="h-3 w-3" />
              {copied ? "Copied" : "Copy URL"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1"
              onClick={() => window.open(created.url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
            <Button size="sm" className="h-7 gap-1" onClick={() => void saveSite()} disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save HTML
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-full gap-2" onClick={() => void createSite()} disabled={busy} spineId="share.create-site">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
          Launch hosted page
        </Button>
      )}
    </div>
  )
}

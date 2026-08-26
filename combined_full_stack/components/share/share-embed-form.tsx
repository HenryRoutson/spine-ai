"use client"
// AI : parity ids — share.create-embed

// AI : TODO (arch-share-form) — spend-limit / busy / copy duplicated with share-link-form and host-api-form.

import { useMemo, useState } from "react"
import { Code2, Copy, Loader2, PanelTop } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { ShareFundingPicker } from "@/components/share/share-funding-flow"
import { parseSharePricing, parseSpendLimitUsd, SharePricingFields } from "@/components/share/share-pricing-fields"
import { HtmlPreviewFrame } from "@/components/share/html-preview-frame"
import { ShareViewerDocsFields, useShareViewerMarkdown } from "@/components/share/share-viewer-docs-fields"
import { SharedLinkPreview } from "@/components/share/shared-link-preview"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { SharedLinkFundingMode } from "@/lib/types"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { EmbedDelivery, EmbedOptions, EmbedTheme, SharedLinkRecord } from "@/lib/shared-link-types"
import { DEFAULT_EMBED_OPTIONS } from "@/lib/shared-link-types"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"

const EMBED_FUNDING_OPTIONS = [
  {
    value: SharedLinkFundingMode.SharerPays,
    label: "You pay (no sign in required)",
    senderPays: true,
    description: "Site visitors can run — billed to your credits.",
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

function iframeSnippet(embedUrl: string, heightPx: number): string {
  return `<iframe\n  src="${embedUrl}"\n  title="Pipeline run"\n  style="width:100%;height:${heightPx}px;border:0"\n  loading="lazy"\n  allow="clipboard-write"\n></iframe>`
}

function scriptSnippet(embedUrl: string, heightPx: number): string {
  return `<div data-spine-embed src="${embedUrl}" style="width:100%;min-height:${heightPx}px"></div>\n<script>\n(function(){\n  var el=document.currentScript.previousElementSibling;\n  if(!el||el.tagName!=="DIV") return;\n  var f=document.createElement("iframe");\n  f.src=el.getAttribute("src");\n  f.title="Pipeline run";\n  f.style.cssText="width:100%;height:${heightPx}px;border:0";\n  f.loading="lazy";\n  f.allow="clipboard-write";\n  el.replaceWith(f);\n})();\n</script>`
}

export function ShareEmbedForm({
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
  const [copied, setCopied] = useState<"iframe" | "script" | null>(null)
  const [originsText, setOriginsText] = useState("")
  const [fundingMode, setFundingMode] = useState<SharedLinkFundingMode>(SharedLinkFundingMode.ViewerSignsIn)
  const [viewerNameRequired, setViewerNameRequired] = useState(false)
  const [spendLimitEnabled, setSpendLimitEnabled] = useState(true)
  const [spendLimitUsd, setSpendLimitUsd] = useState("10.00")
  const [billingMultiple, setBillingMultiple] = useState("1.0")
  const [flatFeeEnabled, setFlatFeeEnabled] = useState(false)
  const [flatFeeUsd, setFlatFeeUsd] = useState("0.50")
  const [delivery, setDelivery] = useState<EmbedDelivery>(DEFAULT_EMBED_OPTIONS.delivery)
  const [heightPx, setHeightPx] = useState(String(DEFAULT_EMBED_OPTIONS.heightPx))
  const [theme, setTheme] = useState<EmbedTheme>(DEFAULT_EMBED_OPTIONS.theme)
  const [hideBranding, setHideBranding] = useState(DEFAULT_EMBED_OPTIONS.hideBranding)
  const [postMessageEvents, setPostMessageEvents] = useState(DEFAULT_EMBED_OPTIONS.postMessageEvents)
  const { viewerMarkdown, fieldsProps } = useShareViewerMarkdown(project.documentation ?? "")

  const viewerFunds = viewerFundsSharedRun(fundingMode)
  const defaultDocsByModule = useMemo(
    () => shareDefaultDocsByModule(project, docs, inferenceInputDocIds),
    [project, docs, inferenceInputDocIds],
  )

  async function createEmbed() {
    setBusy(true)
    setError(null)
    const allowedOrigins = originsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!allowedOrigins.length) {
      setError("Add at least one allowed website origin (e.g. https://yoursite.com)")
      setBusy(false)
      return
    }
    const spend = parseSpendLimitUsd(spendLimitEnabled, spendLimitUsd)
    if (!spend.ok) {
      setError(spend.error)
      setBusy(false)
      return
    }
    const spendLimitCents = spend.spendLimitCents
    const height = Number.parseInt(heightPx, 10)
    if (!Number.isFinite(height) || height < 240 || height > 2400) {
      setError("Height must be between 240 and 2400 px")
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
    const embedOptions: EmbedOptions = {
      delivery,
      heightPx: height,
      theme,
      hideBranding,
      postMessageEvents,
    }
    try {
      const body = await apiJson<{ url: string; link: SharedLinkRecord }>(API_ROUTES.sharedLinks, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          kind: "embed",
          fundingMode,
          viewerNameRequired,
          spendLimitCents,
          billingMultiple: pricing.billingMultiple,
          flatFeeCents: pricing.flatFeeCents || undefined,
          defaultDocsByModule,
          allowedOrigins,
          embedOptions,
          viewerMarkdown,
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

  async function copySnippet(kind: "iframe" | "script") {
    if (!created) return
    const h = created.link.embedOptions?.heightPx ?? DEFAULT_EMBED_OPTIONS.heightPx
    const text = kind === "iframe" ? iframeSnippet(created.url, h) : scriptSnippet(created.url, h)
    await copyTextToClipboard(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), COPY_FEEDBACK_MS)
  }

  const showIframe = !created || delivery === "iframe" || delivery === "both"
  const showScript = !created || delivery === "script" || delivery === "both"

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Website embed</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drop our run UI into your site. Lock it to your domains so others cannot hotlink your
          inference. Prefer Hosted API (from your server) if you want a fully custom UI — never put
          API keys in page HTML.
        </p>
      </div>

      {!created ? (
        <>
      <div className="space-y-1.5">
        <Label className="text-xs">Allowed origins</Label>
        <textarea
          value={originsText}
          onChange={(e) => setOriginsText(e.target.value)}
          rows={3}
          placeholder={"https://yoursite.com\nhttps://www.yoursite.com"}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="text-[10px] text-muted-foreground">
          One origin per line (scheme + host). Only these websites may iframe this embed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Snippet style</Label>
          <select
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as EmbedDelivery)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="both">Iframe + script</option>
            <option value="iframe">Iframe only</option>
            <option value="script">Script loader only</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Height (px)</Label>
          <Input
            type="number"
            min={240}
            max={2400}
            value={heightPx}
            onChange={(e) => setHeightPx(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Theme</Label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as EmbedTheme)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 pb-0.5">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hideBranding}
              onChange={(e) => setHideBranding(e.target.checked)}
            />
            Hide branding chrome
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={postMessageEvents}
              onChange={(e) => setPostMessageEvents(e.target.checked)}
            />
            postMessage run events
          </label>
        </div>
      </div>

      <ShareFundingPicker
        value={fundingMode}
        onChange={(v) => setFundingMode(v as SharedLinkFundingMode)}
        senderLabel="You"
        receiverLabel="Viewer"
        options={[...EMBED_FUNDING_OPTIONS]}
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
            <span className="text-[10px] text-muted-foreground">max billed via this embed</span>
          </div>
        )}
      </div>

      <ShareDefaultFiles project={project} docs={docs} defaultDocsByModule={defaultDocsByModule} />

      <ShareViewerDocsFields {...fieldsProps} />

      <HtmlPreviewFrame label="Embed preview">
        <SharedLinkPreview
          projectName={project.name}
          viewerMarkdown={viewerMarkdown}
          modules={project.modules}
        />
      </HtmlPreviewFrame>
        </>
      ) : null}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {created ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[11px] text-muted-foreground">
            Embed URL (origin-locked). Copy a snippet into your website:
          </p>
          <code className="block truncate font-mono text-[10px]">{created.url}</code>
          {showIframe && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium">Iframe</span>
                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void copySnippet("iframe")}>
                  {copied === "iframe" ? <Copy className="h-3 w-3" /> : <PanelTop className="h-3 w-3" />}
                  {copied === "iframe" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded border border-border bg-background p-2 font-mono text-[9px] leading-relaxed">
                {iframeSnippet(created.url, created.link.embedOptions?.heightPx ?? 640)}
              </pre>
            </div>
          )}
          {showScript && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium">Script loader</span>
                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void copySnippet("script")}>
                  {copied === "script" ? <Copy className="h-3 w-3" /> : <Code2 className="h-3 w-3" />}
                  {copied === "script" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded border border-border bg-background p-2 font-mono text-[9px] leading-relaxed">
                {scriptSnippet(created.url, created.link.embedOptions?.heightPx ?? 640)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <Button className="w-full gap-2" onClick={() => void createEmbed()} disabled={busy} spineId="share.create-embed">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PanelTop className="h-4 w-4" />}
          Create website embed
        </Button>
      )}
    </div>
  )
}

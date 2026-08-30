"use client"
// AI : parity ids — share.create-site

import { useEffect, useMemo, useRef, useState } from "react"
import { Copy, ExternalLink, LayoutTemplate, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { ShareFundingPicker } from "@/components/share/share-funding-flow"
import { parseSharePricing, parseSpendLimitUsd, SharePricingFields } from "@/components/share/share-pricing-fields"
import { HostedSitePageStudio } from "@/components/share/hosted-site-page-studio"
import { SiteSupabaseStatus } from "@/components/share/site-supabase-status"
import { ShareSheet } from "@/components/share/share-sheet"
import { ShareViewerDocsFields, useShareViewerMarkdown } from "@/components/share/share-viewer-docs-fields"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { SharedLinkFundingMode } from "@/lib/types"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { HostedSiteOptions, SharedLinkRecord } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_HTML, isSiteLinkId, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import { listedWebsitePipelineBindings, websiteNameForCreate } from "@/lib/website-pipelines"
import { useOptionalAppShell } from "@/lib/app-shell"
import { useHideDeveloperTools } from "@/lib/developer-tools-settings"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

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
  const shell = useOptionalAppShell()
  const editingWebsite = shell?.editingWebsite
  const hideDeveloperTools = useHideDeveloperTools()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ url: string; link: SharedLinkRecord } | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [fundingMode, setFundingMode] = useState<SharedLinkFundingMode>(SharedLinkFundingMode.SharerPays)
  const [viewerNameRequired, setViewerNameRequired] = useState(false)
  const [spendLimitEnabled, setSpendLimitEnabled] = useState(true)
  const [spendLimitUsd, setSpendLimitUsd] = useState("10.00")
  const [billingMultiple, setBillingMultiple] = useState("1.0")
  const [flatFeeEnabled, setFlatFeeEnabled] = useState(false)
  const [flatFeeUsd, setFlatFeeUsd] = useState("0.50")
  const [siteOptions, setSiteOptions] = useState<HostedSiteOptions>(() =>
    normalizeHostedSiteOptions({
      brand: {
        ...DEFAULT_HOSTED_SITE_OPTIONS.brand,
        companyName: websiteNameForCreate(project.name),
        tagline: "Run this pipeline",
      },
      customHtml: DEFAULT_HOSTED_SITE_HTML,
    }),
  )
  const { viewerMarkdown, fieldsProps } = useShareViewerMarkdown(project.documentation ?? "")
  const viewerFunds = viewerFundsSharedRun(fundingMode)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!editingWebsite || !isSiteLinkId(editingWebsite.id)) return
    const origin = typeof window === "undefined" ? "" : window.location.origin
    setCreated({ url: `${origin}/site/${editingWebsite.id}`, link: editingWebsite })
    setSiteOptions(normalizeHostedSiteOptions(editingWebsite.siteOptions))
  }, [editingWebsite])

  function commitSiteOptions(next: HostedSiteOptions) {
    setSiteOptions(next)
    if (!editingWebsite || !shell) return
    const link = { ...editingWebsite, siteOptions: next }
    shell.patchEditingWebsite(link)
    setCreated((c) => (c ? { ...c, link } : c))
    const id = created?.link.id ?? editingWebsite.id
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void apiJson<{ link: SharedLinkRecord }>(API_ROUTES.sharedLink(id), {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ siteOptions: normalizeHostedSiteOptions(next), viewerMarkdown }),
      })
        .then((body) => {
          setCreated((c) => (c ? { ...c, link: body.link } : c))
          shell.patchEditingWebsite(body.link)
        })
        .catch((e) => setError((e as Error).message))
    }, 400)
  }
  const defaultDocsByModule = useMemo(
    () => shareDefaultDocsByModule(project, docs, inferenceInputDocIds),
    [project, docs, inferenceInputDocIds],
  )

  function requireCompanyName(): boolean {
    if (siteOptions.brand.companyName.trim()) return true
    setError("Add a company name — it becomes the page title.")
    return false
  }

  async function createSite() {
    setBusy(true)
    setError(null)
    if (!requireCompanyName()) {
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
          siteOptions: normalizeHostedSiteOptions(siteOptions),
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

  async function saveSite() {
    if (!created) return
    setBusy(true)
    setError(null)
    if (!requireCompanyName()) {
      setBusy(false)
      return
    }
    try {
      const body = await apiJson<{ link: SharedLinkRecord }>(API_ROUTES.sharedLink(created.link.id), {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ siteOptions: normalizeHostedSiteOptions(siteOptions), viewerMarkdown }),
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
    // AI : document flow + parent scroll — flex fillHeight collapsed these headings on top of each other.
    <div className={cn("space-y-4", editingWebsite && "p-4")}>
      {editingWebsite ? null : (
      <div>
        <h3 className="text-sm font-semibold">Website</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Create a website and attach pipelines there. We host it — no site of your own.
        </p>
      </div>
      )}

      {created ? (
        <SiteSupabaseStatus
          linkId={created.link.id}
          auth={siteOptions.auth}
          onAuth={(nextAuth) => {
            setSiteOptions((prev) => ({ ...prev, auth: nextAuth }))
            setCreated((c) =>
              c
                ? { ...c, link: { ...c.link, siteOptions: { ...c.link.siteOptions, auth: nextAuth } } }
                : c,
            )
          }}
        />
      ) : null}

      <HostedSitePageStudio
        project={project}
        value={siteOptions}
        onChange={commitSiteOptions}
        viewerMarkdown={viewerMarkdown}
        forcedTab={editingWebsite ? undefined : hideDeveloperTools ? "vibe" : undefined}
        hideSurfaceTabs={editingWebsite ? false : hideDeveloperTools}
      />

      {editingWebsite || hideDeveloperTools ? null : <ShareViewerDocsFields {...fieldsProps} />}

      {editingWebsite && created ? (
        <div className="border-t border-border">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <button
              type="button"
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShareOpen((v) => !v)}
            >
              {shareOpen ? "Hide share" : "Share"}
            </button>
            <a
              href={created.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              {created.url}
            </a>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => void copyUrl()}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <a
              href={created.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center rounded-lg px-2 text-muted-foreground hover:text-foreground"
              aria-label="Open public site"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {shareOpen ? (
            <div className="overflow-y-auto border-t border-border p-3">
              <ShareSheet
                target={{ kind: "website", site: created.link, project }}
                docs={docs}
                inferenceInputDocIds={inferenceInputDocIds}
                onCreated={onCreated}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!created && listedWebsitePipelineBindings(siteOptions.pipelineBindings).length > 0 ? (
        <>
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
        </>
      ) : null}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {created ? (
        <div className="shrink-0 space-y-3 rounded-md border border-border bg-muted/20 p-3">
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
              Save page
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-full gap-2" onClick={() => void createSite()} disabled={busy} spineId="share.create-site">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
          Create website
        </Button>
      )}
    </div>
  )
}

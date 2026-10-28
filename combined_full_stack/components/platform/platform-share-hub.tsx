"use client"

import { useState } from "react"
import { Check, Copy, Globe, Link2, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { spineActionProps } from "@/lib/core/parity"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"
import type { HostedSiteOptions, SharedLinkRecord } from "@/lib/shared-link-types"
import { absoluteShareUrl, platformShareBodies } from "@/lib/platform-share-bodies"
import { websiteNameForCreate } from "@/lib/website-pipelines"
import type { Project } from "@/lib/types"

type share_result = {
  website?: { url: string; id: string }
  link?: { url: string; id: string }
  api?: { url: string; id: string }
}

// AI : one-click share — mint website + run link + API from a single panel.
export function PlatformShareHub({
  project,
  siteOptions,
  onShared,
}: {
  project: Project
  siteOptions?: HostedSiteOptions
  onShared?: (result: share_result) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<share_result | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [name, setName] = useState(websiteNameForCreate(project.name))

  async function shareAll() {
    setBusy(true)
    setError(null)
    const out: share_result = {}
    const origin = window.location.origin
    const bodies = platformShareBodies({
      projectId: project.id,
      name,
      siteOptions,
    })

    try {
      const siteRes = await apiJson<{ link: SharedLinkRecord; url: string }>(
        API_ROUTES.sharedLinks,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(bodies.site),
        },
      )
      out.website = { url: absoluteShareUrl(siteRes.url, origin), id: siteRes.link.id }

      const linkRes = await apiJson<{ link: SharedLinkRecord; url: string }>(
        API_ROUTES.sharedLinks,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(bodies.link),
        },
      )
      out.link = { url: absoluteShareUrl(linkRes.url, origin), id: linkRes.link.id }

      const apiRes = await apiJson<{ id: string; invokeUrl: string }>(
        API_ROUTES.hostedApis,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(bodies.api),
        },
      )
      out.api = { url: absoluteShareUrl(apiRes.invokeUrl, origin), id: apiRes.id }

      setResult(out)
      onShared?.(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed")
    } finally {
      setBusy(false)
    }
  }

  async function copyUrl(key: string, url: string) {
    await copyTextToClipboard(url)
    setCopied(key)
    setTimeout(() => setCopied(null), COPY_FEEDBACK_MS)
  }

  async function copyAll() {
    if (!result) return
    const lines = [
      result.website ? `Website: ${result.website.url}` : null,
      result.link ? `Run link: ${result.link.url}` : null,
      result.api ? `API: ${result.api.url}` : null,
    ].filter(Boolean)
    await copyTextToClipboard(lines.join("\n"))
    setCopied("all")
    setTimeout(() => setCopied(null), COPY_FEEDBACK_MS)
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">Share everything</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Publish your website, run link, and API in one click. All three share the same pipeline backend.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="platform-share-name" className="text-xs">
          Name
        </Label>
        <Input
          id="platform-share-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 font-mono text-xs"
          disabled={busy}
        />
      </div>

      <Button
        type="button"
        onClick={shareAll}
        disabled={busy || !name.trim()}
        className="w-full"
        {...spineActionProps("platform.share-all")}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Publishing…
          </>
        ) : (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Share website + link + API
          </>
        )}
      </Button>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600">Published</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              onClick={copyAll}
              {...spineActionProps("platform.copy-all-urls")}
            >
              {copied === "all" ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              Copy all
            </Button>
          </div>

          {result.website ? (
            <ShareUrlRow
              icon={Globe}
              label="Website"
              url={result.website.url}
              copied={copied === "website"}
              onCopy={() => copyUrl("website", result.website!.url)}
            />
          ) : null}
          {result.link ? (
            <ShareUrlRow
              icon={Link2}
              label="Run link"
              url={result.link.url}
              copied={copied === "link"}
              onCopy={() => copyUrl("link", result.link!.url)}
            />
          ) : null}
          {result.api ? (
            <ShareUrlRow
              icon={Zap}
              label="API"
              url={result.api.url}
              copied={copied === "api"}
              onCopy={() => copyUrl("api", result.api!.url)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ShareUrlRow({
  icon: Icon,
  label,
  url,
  copied,
  onCopy,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  url: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-border/60 bg-background px-2 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-medium">{label}</span>
        <p className="truncate font-mono text-[10px] text-muted-foreground">{url}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0" onClick={onCopy}>
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}

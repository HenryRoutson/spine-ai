"use client"

import { useMemo, useState } from "react"
import { Copy, Link2, Loader2, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { orderedInputModules } from "@/lib/inference-input"
import { DocLabel, SharedLinkFundingMode } from "@/lib/types"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"

export function ShareLinkDialog({
  project,
  docs,
  inferenceInputDocIds,
}: {
  project: Project
  docs: DocRef[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [fundingMode, setFundingMode] = useState<SharedLinkFundingMode>(SharedLinkFundingMode.SharerPays)
  const [viewerNameRequired, setViewerNameRequired] = useState(false)

  const inputModules = useMemo(() => orderedInputModules(project.modules), [project.modules])

  const defaultDocsByModule = useMemo(() => {
    const out: Partial<Record<ModuleId, DocId[]>> = {}
    for (const m of inputModules) {
      const raw = inferenceInputDocIds[m.id]
      if (raw) {
        out[m.id] = Array.isArray(raw) ? raw : [raw]
        continue
      }
      const seeded = docs.filter((d) => d.label === DocLabel.Inference).slice(0, 1)
      if (seeded.length) out[m.id] = [seeded[0].id]
    }
    return out
  }, [inputModules, inferenceInputDocIds, docs])

  async function createLink() {
    setBusy(true)
    setError(null)
    try {
      const body = await apiJson<{ url: string }>(API_ROUTES.sharedLinks, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          fundingMode,
          viewerNameRequired,
          defaultDocsByModule: defaultDocsByModule,
        }),
      })
      const full = `${window.location.origin}${body.url}`
      setUrl(full)
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
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 bg-transparent"
        onClick={() => setOpen((o) => !o)}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share link
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Share pipeline</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Public link — you pay by default. Viewers only see defaults + their uploads.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-wider">Who pays</Label>
              <Select value={fundingMode} onValueChange={(v) => setFundingMode(v as SharedLinkFundingMode)}>
                <SelectTrigger className="h-auto min-h-9 w-full py-2 text-left text-xs [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="w-max max-w-[min(28rem,calc(100vw-2rem))] min-w-[var(--anchor-width)]"
                >
                  <SelectItem value="sharer_pays" className="whitespace-normal">
                    You pay (default)
                  </SelectItem>
                  <SelectItem value="viewer_signs_in" className="whitespace-normal">
                    Viewer signs in & pays
                  </SelectItem>
                  <SelectItem value="viewer_pays" className="whitespace-normal">
                    Viewer pays (sign in required)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={viewerNameRequired}
                onChange={(e) => setViewerNameRequired(e.target.checked)}
              />
              Require viewer name
            </label>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Default files
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {inputModules.map((m) => {
                  const ids = defaultDocsByModule[m.id] ?? []
                  const names = ids
                    .map((id) => docs.find((d) => d.id === id)?.name)
                    .filter(Boolean)
                  return (
                    <li key={m.id}>
                      <span className="text-foreground">{m.label}:</span>{" "}
                      {names.length ? names.join(", ") : "none — assign inputs first"}
                    </li>
                  )
                })}
              </ul>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {url ? (
              <div className="flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[10px]">
                  {url}
                </code>
                <Button size="sm" variant="outline" onClick={copyUrl}>
                  {copied ? <Copy className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <Button className="w-full gap-2" onClick={createLink} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Create link
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Copy, Loader2, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { copyTextToClipboard } from "@/lib/clipboard"
import { formatCents } from "@/lib/format"
import type { MarketplaceListingRecord } from "@/lib/marketplace-types"
import type { Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

export function MarketplacePublishForm({
  project,
  onCreated,
}: {
  project: Project
  onCreated?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listing, setListing] = useState<MarketplaceListingRecord | null>(null)
  const [copied, setCopied] = useState(false)
  const [title, setTitle] = useState(project.name)
  const [description, setDescription] = useState("")
  const [priced, setPriced] = useState(false)
  const [priceUsd, setPriceUsd] = useState("5.00")

  async function publish() {
    setBusy(true)
    setError(null)
    let priceCents = 0
    if (priced) {
      const parsed = Number.parseFloat(priceUsd)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Enter a valid price")
        setBusy(false)
        return
      }
      priceCents = Math.round(parsed * 100)
    }
    try {
      const body = await apiJson<{ listing: MarketplaceListingRecord }>(API_ROUTES.marketplace, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          title: title.trim() || project.name,
          description: description.trim(),
          priceCents,
        }),
      })
      setListing(body.listing)
      onCreated?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copyId() {
    if (!listing) return
    await copyTextToClipboard(listing.id)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Share to marketplace</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Publish a snapshot others can copy into their workspace — like an example template. Their
          edits won&apos;t affect yours.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="font-mono text-[10px] uppercase tracking-wider">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 text-xs"
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="font-mono text-[10px] uppercase tracking-wider">Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          placeholder="What this pipeline does…"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={priced} onChange={(e) => setPriced(e.target.checked)} />
          Charge for copies
        </label>
        {priced ? (
          <div className="flex items-center gap-2 pl-5">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="h-8 w-28 font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground">one-time · credited to Earnings</span>
          </div>
        ) : (
          <p className="pl-5 text-[10px] text-muted-foreground">Listed as free</p>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {listing ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-foreground">
            Listed {listing.priceCents > 0 ? `for ${formatCents(listing.priceCents)}` : "for free"}.
          </p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1.5 font-mono text-[10px]">
              {listing.id}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copyId()}>
              <Copy className="h-3.5 w-3.5" />
              <span className="sr-only">{copied ? "Copied" : "Copy id"}</span>
            </Button>
            {copied ? (
              <span className="self-center text-[10px] text-muted-foreground">copied</span>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Browse and copy listings from Projects → Marketplace. Their edits won&apos;t affect yours.
          </p>
        </div>
      ) : (
        <Button className="w-full gap-2" onClick={() => void publish()} disabled={busy || !title.trim()} spineId="share.marketplace-publish">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
          Share to marketplace
        </Button>
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, Loader2, Play, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchSharedLink } from "@/lib/shared-run-client"
import {
  addSharedWithMe,
  parseSharedLinkIdFromInput,
  readSharedWithMe,
  removeSharedWithMe,
  type SharedWithMeEntry,
} from "@/lib/shared-with-me"
import { openSharedLinkInWorkspace } from "@/lib/open-shared-in-workspace"
import { timeAgo } from "@/lib/time-ago"
import { cn } from "@/lib/utils"

type SharedWithMePanelProps = {
  onRun: (linkId: string) => void
  simple?: boolean
  // AI : parent supplies the section heading (project picker).
  embedded?: boolean
}

export function SharedWithMePanel({ onRun, simple = false, embedded = false }: SharedWithMePanelProps) {
  const [entries, setEntries] = useState<SharedWithMeEntry[]>(() => readSharedWithMe())
  const [addInput, setAddInput] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const reload = useCallback(() => setEntries(readSharedWithMe()), [])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleAdd() {
    const linkId = parseSharedLinkIdFromInput(addInput)
    if (!linkId) {
      setAddError(simple ? "That doesn't look like a share link" : "Paste a shared link URL or pub_… id")
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const link = await fetchSharedLink(linkId)
      addSharedWithMe(linkId, link.name)
      setAddInput("")
      reload()
    } catch (e) {
      setAddError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  function handleRemove(linkId: string) {
    removeSharedWithMe(linkId)
    reload()
  }

  return (
    <div className="space-y-4">
      {embedded ? null : (
        <p className="text-sm text-muted-foreground">
          {simple
            ? "Paste a link someone sent you to run it here."
            : "Pipelines others shared with you. Run them here with full access to Billing and the rest of your workspace."}
        </p>
      )}

      <div className="flex gap-2">
        <Input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          placeholder={simple ? "Paste a link…" : "https://…/run/pub_… or pub_…"}
          className={cn("h-9 text-xs", !simple && "font-mono")}
          disabled={adding}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd()
          }}
        />
        <Button size="sm" className="h-9 shrink-0 gap-1.5" disabled={adding || !addInput.trim()} onClick={() => void handleAdd()}>
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
      {addError ? <p className="text-xs text-destructive">{addError}</p> : null}

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {simple
            ? "No links yet — paste one above."
            : "No shared links yet — paste a link above or open one from an email and choose “Open in workspace”."}
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.linkId}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.name ?? entry.linkId}</p>
                <p className={cn("text-muted-foreground", simple ? "text-xs" : "font-mono text-[10px]")}>
                  {simple ? `Added ${timeAgo(entry.addedAt)}` : `${entry.linkId} · added ${timeAgo(entry.addedAt)}`}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onRun(entry.linkId)}>
                <Play className="h-3.5 w-3.5" />
                Run
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                title="Open public page"
                onClick={() => window.open(`/run/${entry.linkId}`, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                title="Remove from list"
                onClick={() => handleRemove(entry.linkId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

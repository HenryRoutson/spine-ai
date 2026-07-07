"use client"

import { useMemo, useState } from "react"
import { Check, Loader2, ScrollText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import type { DeploymentRow } from "@/lib/deployment-funding"
import { formatCents } from "@/lib/format"
import { cn } from "@/lib/utils"

function centsToUsd(cents: number | undefined): string {
  if (cents == null) return "10.00"
  return (cents / 100).toFixed(2)
}

export function DeploymentSpendLimitEditor({
  item,
  onSaved,
}: {
  item: DeploymentRow
  onSaved: () => void
}) {
  const { row } = item
  const [editing, setEditing] = useState(false)
  const [enabled, setEnabled] = useState(row.spendLimitCents != null)
  const [usd, setUsd] = useState(centsToUsd(row.spendLimitCents))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasLimit = row.spendLimitCents != null
  const atLimit = hasLimit && row.totalSpendCents >= row.spendLimitCents!

  async function save() {
    setBusy(true)
    setError(null)
    try {
      let spendLimitCents: number | null = null
      if (enabled) {
        const parsed = Number.parseFloat(usd)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setError("Enter a positive dollar amount")
          return
        }
        spendLimitCents = Math.round(parsed * 100)
      }
      const route =
        item.kind === "link" ? API_ROUTES.sharedLink(row.id) : API_ROUTES.hostedApi(row.id)
      await apiJson(route, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ spendLimitCents }),
      })
      setEditing(false)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function startEditing() {
    setEnabled(row.spendLimitCents != null)
    setUsd(centsToUsd(row.spendLimitCents))
    setError(null)
    setEditing(true)
  }

  return (
    <div className="mt-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground">Credit limit</p>
          {!editing ? (
            <p className="mt-0.5 font-mono text-[11px]">
              {hasLimit ? (
                <>
                  <span className={cn(atLimit && "text-destructive")}>
                    {formatCents(row.spendLimitCents!)} cap
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatCents(row.totalSpendCents)} spent
                  </span>
                </>
              ) : (
                <>
                  <span className="text-amber-600 dark:text-amber-400">No cap</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatCents(row.totalSpendCents)} spent
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {formatCents(row.totalSpendCents)} already spent on this deployment
            </p>
          )}
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 px-2 text-[10px]"
            onClick={startEditing}
          >
            {hasLimit ? "Edit limit" : "Set limit"}
          </Button>
        )}
      </div>

      {editing && (
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Cap total spend on this deployment
          </label>
          {enabled && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                className="h-8 w-28 font-mono text-xs"
              />
              <span className="text-[10px] text-muted-foreground">maximum</span>
            </div>
          )}
          {error && <p className="text-[10px] text-destructive">{error}</p>}
          <div className="flex gap-1">
            <Button size="sm" className="h-7 gap-1 px-2" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save limit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

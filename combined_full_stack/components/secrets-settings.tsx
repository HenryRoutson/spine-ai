"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import { WEBHOOK_URL_DEFAULTS } from "@/lib/webhook-step"

type SecretRow = { name: string; hint: string; updatedAt: number }

const PRESETS: { name: string; blurb: string }[] = [
  {
    name: "HIGGSFIELD_API_KEY",
    blurb: "Higgsfield Authorization — paste `Key KEY_ID:KEY_SECRET` or `KEY_ID:KEY_SECRET`.",
  },
  {
    name: "HIGGSFIELD_GENERATE_URL",
    blurb: `Optional video endpoint override. Default: ${WEBHOOK_URL_DEFAULTS.HIGGSFIELD_GENERATE_URL}`,
  },
  {
    name: "HIGGSFIELD_IMAGE_URL",
    blurb: `Optional image endpoint override. Default: ${WEBHOOK_URL_DEFAULTS.HIGGSFIELD_IMAGE_URL}`,
  },
]

export function SecretsSettings() {
  const [rows, setRows] = useState<SecretRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("HIGGSFIELD_API_KEY")
  const [draftValue, setDraftValue] = useState("")
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyName, setBusyName] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isDemoMode()) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const data = await apiJson<{ secrets: SecretRow[] }>(API_ROUTES.secrets)
      setRows(data.secrets)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const byName = useMemo(() => new Map(rows.map((r) => [r.name, r])), [rows])

  async function saveSecret(name: string, value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const data = await apiJson<{ secret: SecretRow }>(API_ROUTES.secrets, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value: trimmed }),
      })
      setRows((prev) => {
        const next = prev.filter((r) => r.name !== data.secret.name)
        next.push(data.secret)
        return next.sort((a, b) => a.name.localeCompare(b.name))
      })
      setDraftValue("")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function removeSecret(name: string) {
    setBusyName(name)
    setError(null)
    try {
      await apiJson<{ ok: true }>(`${API_ROUTES.secrets}?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      setRows((prev) => prev.filter((r) => r.name !== name))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyName(null)
    }
  }

  return (
    <section id="settings-secrets" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Secrets</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Webhook auth and URL overrides for this account. Values are stored with row-level security and never shown
          again after save.
        </p>
      </div>
      <div className="space-y-4 px-4 py-3">
        {isDemoMode() ? (
          <p className="font-mono text-[11px] text-muted-foreground">Secrets are disabled in demo mode.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading secrets
          </div>
        ) : (
          <>
            {PRESETS.map((preset) => {
              const saved = byName.get(preset.name)
              return (
                <div key={preset.name} className="rounded-md border border-border px-3 py-2.5">
                  <p className="font-mono text-xs font-medium">{preset.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{preset.blurb}</p>
                  {saved ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        saved · …{saved.hint}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyName === preset.name}
                        onClick={() => void removeSecret(preset.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">not set</p>
                  )}
                </div>
              )
            })}
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                void saveSecret(draftName.trim(), draftValue)
              }}
            >
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value.toUpperCase())}
                placeholder="SECRET_NAME"
                className="h-8 font-mono text-xs"
                autoComplete="off"
              />
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input
                    type={showValue ? "text" : "password"}
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    placeholder="Value — shown only while typing"
                    className="h-8 pr-9 font-mono text-xs"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1.5 text-muted-foreground"
                    onClick={() => setShowValue((v) => !v)}
                    aria-label={showValue ? "Hide value" : "Show value"}
                  >
                    {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="submit" size="sm" disabled={saving || !draftName.trim() || !draftValue.trim()}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </form>
            {rows.filter((r) => !PRESETS.some((p) => p.name === r.name)).length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {rows
                  .filter((r) => !PRESETS.some((p) => p.name === r.name))
                  .map((row) => (
                    <li key={row.name} className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-[11px]">
                      <span>
                        {row.name} · …{row.hint}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyName === row.name}
                        onClick={() => void removeSecret(row.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
              </ul>
            ) : null}
          </>
        )}
        {error ? <p className="font-mono text-[11px] text-destructive">{error}</p> : null}
      </div>
    </section>
  )
}

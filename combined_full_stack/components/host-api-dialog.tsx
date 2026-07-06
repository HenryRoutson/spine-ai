"use client"

import { useMemo, useState } from "react"
import { Copy, KeyRound, Loader2, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { orderedInputModules } from "@/lib/inference-input"
import { DocLabel } from "@/lib/types"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"

type CreatedHostedApi = {
  apiKey: string
  invokeUrl: string
  progressUrl: string
}

export function HostApiDialog({
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
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedHostedApi | null>(null)
  const [copied, setCopied] = useState<"key" | "curl" | null>(null)
  const [spendLimitEnabled, setSpendLimitEnabled] = useState(false)
  const [spendLimitUsd, setSpendLimitUsd] = useState("10.00")

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

  async function createApi() {
    setBusy(true)
    setError(null)
    let spendLimitCents: number | undefined
    if (spendLimitEnabled) {
      const parsed = Number.parseFloat(spendLimitUsd)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Enter a valid spending limit greater than $0")
        setBusy(false)
        return
      }
      spendLimitCents = Math.round(parsed * 100)
    }
    try {
      const body = await apiJson<CreatedHostedApi>(API_ROUTES.hostedApis, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          spendLimitCents,
          defaultDocsByModule,
        }),
      })
      setCreated({
        apiKey: body.apiKey,
        invokeUrl: `${window.location.origin}${body.invokeUrl}`,
        progressUrl: `${window.location.origin}${body.progressUrl}`,
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
    `curl -X POST '${created.invokeUrl}' \\
  -H 'Authorization: Bearer ${created.apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{"inputsByModule":{}}'`

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 bg-transparent"
        onClick={() => setOpen((o) => !o)}
      >
        <Zap className="h-3.5 w-3.5" />
        Host API
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Host scalable API</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                One-click REST endpoint — billed to your account. Key shown once.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-4">
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
                    className="h-8 font-mono text-xs"
                    placeholder="10.00"
                  />
                </div>
              )}
            </div>
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
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => void copy(curlExample, "curl")}>
                        {copied === "curl" ? "Copied" : "Copy curl"}
                      </Button>
                    </div>
                    <pre className="max-h-32 overflow-auto rounded border border-border bg-muted/20 p-2 font-mono text-[9px] leading-relaxed">
                      {curlExample}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <Button className="w-full gap-2" onClick={() => void createApi()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Deploy API
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

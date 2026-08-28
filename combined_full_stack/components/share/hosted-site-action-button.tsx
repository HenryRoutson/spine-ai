"use client"

import { useCallback, useState } from "react"
import { APP_SQL_CHANGED_EVENT } from "@/lib/app-sql"
import { awaitSharedRun, startSharedRun } from "@/lib/shared-run-client"

function outputValue(run: { steps?: Array<{ outputJson?: string; status?: string }> }): unknown {
  const steps = [...(run.steps ?? [])].reverse()
  for (const step of steps) {
    if (step.status && step.status !== "ok") continue
    if (!step.outputJson) continue
    try {
      return JSON.parse(step.outputJson) as unknown
    } catch {
      return step.outputJson
    }
  }
  return null
}

export function HostedSiteActionButton({
  linkId,
  alias,
  label = "Double it",
}: {
  linkId: string
  alias?: string
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const run = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const { jobId, progressToken } = await startSharedRun(linkId, {}, undefined, undefined, alias)
      const finished = await awaitSharedRun(linkId, jobId, progressToken, () => undefined)
      const value = outputValue(finished)
      const shown =
        value && typeof value === "object" && "value" in value
          ? String((value as { value: unknown }).value)
          : value != null
            ? JSON.stringify(value)
            : null
      setResult(shown)
      window.dispatchEvent(new Event(APP_SQL_CHANGED_EVENT))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [alias, linkId])

  return (
    <div className="hs-action-widget" data-spine-id="site.sql-action">
      <button type="button" className="hs-action-btn" disabled={busy} onClick={() => void run()}>
        {busy ? "Running…" : label}
      </button>
      {result != null ? <p className="hs-sql-caption">Now {result}</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export function HostedSiteActionPreview({ label = "Double it" }: { label?: string }) {
  return (
    <div className="hs-action-widget" data-spine-id="site.sql-action">
      <button type="button" className="hs-action-btn" disabled>
        {label}
      </button>
    </div>
  )
}

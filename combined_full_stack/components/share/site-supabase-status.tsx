"use client"

import { useEffect, useRef, useState } from "react"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import type { HostedSiteAuth } from "@/lib/shared-link-types"

export function SiteSupabaseStatus({
  linkId,
  auth,
  onAuth,
}: {
  linkId: string
  auth: HostedSiteAuth
  onAuth?: (auth: HostedSiteAuth) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = auth.allocStatus
  const onAuthRef = useRef(onAuth)
  onAuthRef.current = onAuth

  useEffect(() => {
    if (status !== "pending") return
    let cancelled = false
    const tick = async () => {
      try {
        const body = await apiJson<{ auth: HostedSiteAuth }>(API_ROUTES.sharedLinkSupabase(linkId))
        if (!cancelled) onAuthRef.current?.(body.auth)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    const id = window.setInterval(() => void tick(), 3000)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [linkId, status])

  async function retry() {
    setBusy(true)
    setError(null)
    try {
      const body = await apiJson<{ auth: HostedSiteAuth }>(API_ROUTES.sharedLinkSupabase(linkId), {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      })
      onAuth?.(body.auth)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (status === "idle" || status === "skipped") return null

  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px]">
      {status === "pending" ? (
        <p className="text-muted-foreground">Creating an isolated Supabase project for this website… about two minutes.</p>
      ) : null}
      {status === "ready" ? (
        <p>
          Isolated database connected
          {auth.customSupabaseUrl ? (
            <>
              {" "}
              · <span className="font-mono">{auth.customSupabaseUrl}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {status === "error" ? (
        <div className="space-y-1">
          <p className="text-destructive">{auth.allocError || "Could not create an isolated Supabase project."}</p>
          <button type="button" className="underline" disabled={busy} onClick={() => void retry()}>
            {busy ? "Retrying…" : "Retry allocation"}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  )
}

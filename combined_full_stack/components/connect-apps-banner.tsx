"use client"
// AI : Vibe-only Connect chip — OAuth popup to Slack/Google, never nango.dev or a node canvas.

import { useState } from "react"
import { Clock, Plug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { collectConnectRequirements } from "@/lib/connect-catalog"
import { rememberConnectAccount } from "@/lib/connect-accounts"
import { ConnectActionIcon } from "@/components/connect-action-icon"
import { flattenPipelineModules, updatePipelineModule } from "@/lib/fork-pipeline"
import { useAppShell } from "@/lib/app-shell"
import { AppWindowId } from "@/lib/app-window-id"
import { useStore } from "@/lib/store"
import type { ModuleId, PipelineModule } from "@/lib/types"

type SessionRes = {
  kind?: "nango" | "ap"
  sessionToken?: string
  host?: string
  frontendUrl?: string
  provider: string
  actionId: string
}

export function ConnectAppsBanner({ modules, simple = false }: { modules: PipelineModule[]; simple?: boolean }) {
  const needed = collectConnectRequirements(flattenPipelineModules(modules))
  const toConnect = needed.filter((r) => !r.connected)
  const toReconnect = needed.filter((r) => r.connected)
  const { setModules, project } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!toConnect.length && !toReconnect.length) return null

  async function connectOne(moduleLabel: string, moduleId: string | undefined, actionId: string) {
    setError(null)
    setBusy(actionId)
    try {
      const session = await apiJson<SessionRes>(API_ROUTES.connectSession, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, projectId: project?.id }),
      })
      if (session.kind === "ap") {
        const url = session.frontendUrl?.trim()
        if (!url) throw new Error("Activepieces URL missing — python3 scripts/setup_local.py ap")
        window.open(url, "_blank", "noopener,width=980,height=720")
        setError("Approve the app in the window that opened, then paste the connection id on this step to run.")
        return
      }
      const sdk = await import("@nangohq/frontend").catch(() => null)
      const Ctor = sdk?.default
      if (!Ctor) {
        throw new Error("Connect SDK missing — npm install @nangohq/frontend, or set Nango and retry")
      }
      if (!session.sessionToken || !session.host) {
        throw new Error("Connect session missing — set Nango and retry")
      }
      const nango = new Ctor({ connectSessionToken: session.sessionToken, host: session.host })
      const result = (await nango.auth(session.provider)) as { connectionId?: string; connection_id?: string }
      const connectionId = result.connectionId ?? result.connection_id
      if (!connectionId) throw new Error("No connection id from the app")
      rememberConnectAccount(session.provider, connectionId)
      const step = flattenPipelineModules(modules).find(
        (m) => (moduleId && m.id === moduleId) || m.label === moduleLabel,
      )
      if (step) {
        setModules(
          updatePipelineModule(modules, step.id as ModuleId, (m) => ({ ...m, connectConnectionId: connectionId })),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const headline =
    toConnect.length === 1
      ? `Connect ${toConnect[0]!.displayName}`
      : toConnect.length
        ? "Connect your apps"
        : "Apps connected"

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-5 text-center">
      <Plug className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{headline}</p>
      {!simple ? (
        <p className="mt-1 text-[11px] text-muted-foreground">A short approval window will open. You stay in Spine after.</p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {toConnect.length
            ? "A small window will ask you to approve. Then you can run."
            : "Tap reconnect if a login expired — you never leave Spine for a dashboard."}
        </p>
      )}
      {toConnect.length ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {toConnect.map((n) => (
            <Button
              key={`${n.moduleId ?? n.moduleLabel}:${n.actionId}`}
              size="sm"
              disabled={busy === n.actionId}
              onClick={() => void connectOne(n.moduleLabel, n.moduleId, n.actionId)}
              spineId="connect.start-session"
            >
              {busy === n.actionId ? "Connecting…" : (
                <span className="inline-flex items-center gap-1.5">
                  <ConnectActionIcon provider={n.provider} size="sm" />
                  {n.displayName}
                </span>
              )}
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {toReconnect.map((n) => (
            <Button
              key={`re:${n.moduleId ?? n.moduleLabel}:${n.actionId}`}
              size="sm"
              variant="outline"
              disabled={busy === n.actionId}
              onClick={() => void connectOne(n.moduleLabel, n.moduleId, n.actionId)}
              spineId="connect.start-session"
            >
              {busy === n.actionId ? "Connecting…" : (
                <span className="inline-flex items-center gap-1.5">
                  <ConnectActionIcon provider={n.provider} size="sm" />
                  {`Reconnect ${n.displayName}`}
                </span>
              )}
            </Button>
          ))}
        </div>
      )}
      {error ? <p className="mt-3 text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}

// AI : Vibe copy for inbound + cron without a node canvas (connect-L-triggers).
export function ConnectTriggersHint({ modules, simple = false }: { modules: PipelineModule[]; simple?: boolean }) {
  const { setVibeObserveTab, setActiveWindow, activeWindow } = useAppShell()
  if (!simple) return null
  const flat = flattenPipelineModules(modules)
  const hasConnect = flat.some((m) => m.kind === "connect")
  const hasWebhook = flat.some((m) => m.kind === "webhook")
  if (!hasConnect && !hasWebhook) return null

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-center">
      <p className="text-[11px] text-muted-foreground">
        {hasWebhook
          ? "Share a link when you want this to run from another app. Use Schedule for every morning."
          : "Use Schedule for every morning. Share a link when something else should kick this off."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            if (activeWindow === AppWindowId.Vibe) setVibeObserveTab(AppWindowId.Schedule)
            else setActiveWindow(AppWindowId.Schedule)
          }}
        >
          <Clock className="h-3.5 w-3.5" />
          Schedule
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (activeWindow === AppWindowId.Vibe) setVibeObserveTab(AppWindowId.Share)
            else setActiveWindow(AppWindowId.Share)
          }}
        >
          Share a link
        </Button>
      </div>
    </div>
  )
}

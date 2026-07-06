"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Boxes, Globe, Users, Zap } from "lucide-react"
import { DeploymentsList } from "@/components/share/deployments-list"
import { HostApiForm } from "@/components/share/host-api-form"
import { ShareLinkForm } from "@/components/share/share-link-form"
import { SharedLinkRunner } from "@/components/share/shared-link-runner"
import { SharedWithMePanel } from "@/components/share/shared-with-me-panel"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useOptionalStore } from "@/lib/store"
import { useAppShell } from "@/lib/app-shell"
import { consumePendingSharedRun } from "@/lib/pending-shared-run"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"

type ShareSection = "publish" | "shared"

type PublishTab = "link" | "api"

export function SharePage() {
  const builder = useOptionalStore()
  const isConsumer = !builder
  const { setActiveWindow, activeSharedLinkId, openSharedRun } = useAppShell()
  const { typesInvalid, pipelineInvalid, runTabsBlocked } = builder
    ? computeWorkspaceValidity(builder.modules, builder.models, builder.typeAliases)
    : { typesInvalid: false, pipelineInvalid: false, runTabsBlocked: false }
  const [section, setSection] = useState<ShareSection>(isConsumer ? "shared" : "publish")
  const [tab, setTab] = useState<PublishTab>("link")
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const pending = consumePendingSharedRun()
    if (pending) {
      openSharedRun(pending)
      setSection("shared")
    }
  }, [openSharedRun])

  if (activeSharedLinkId) {
    return <SharedLinkRunner linkId={activeSharedLinkId} />
  }

  if (isConsumer) {
    return (
      <div className="flex h-full flex-col">
        <WindowHeader
          step="Shared with me"
          title="Run shared pipelines"
          description="Paste a link someone shared with you, top up in Billing, then run — no project required."
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-2xl">
            <SharedWithMePanel onRun={openSharedRun} />
          </div>
        </div>
      </div>
    )
  }

  const publishBlocked = typesInvalid || pipelineInvalid

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="05 / Share"
        title="Share & Monetize"
        description="Publish your pipeline or run links others shared with you — viewer billing uses the Billing tab."
      />

      <div className="border-b border-border px-5">
        <div className="mx-auto flex max-w-6xl gap-1 py-2">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              section === "publish"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSection("publish")}
          >
            <Globe className="h-3.5 w-3.5" />
            Publish
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              section === "shared"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSection("shared")}
          >
            <Users className="h-3.5 w-3.5" />
            Shared with me
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {section === "shared" ? (
          <div className="mx-auto max-w-2xl">
            <SharedWithMePanel onRun={openSharedRun} />
          </div>
        ) : publishBlocked ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-6 py-8">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <p className="mt-4 text-sm font-medium text-destructive">
                {typesInvalid
                  ? "Fix type errors in Structure before publishing."
                  : "Fix pipeline validation errors before publishing."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setActiveWindow(typesInvalid ? "structure" : "pipeline")}
              >
                <Boxes className="h-3.5 w-3.5" />
                Go to {typesInvalid ? "Structure" : "Pipeline"}
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">
                You can still run shared links from the Shared with me tab.
              </p>
              <Button variant="link" size="sm" className="mt-1" onClick={() => setSection("shared")}>
                Open Shared with me
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-4 flex gap-1 rounded-md border border-border bg-muted/30 p-1">
                  <button
                    type="button"
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      tab === "link"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setTab("link")}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Link
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      tab === "api"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setTab("api")}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    API
                  </button>
                </div>

                {tab === "link" ? (
                  <ShareLinkForm
                    project={builder.project}
                    docs={builder.docs}
                    inferenceInputDocIds={builder.inferenceInputDocIds}
                    onCreated={() => setRefreshToken((n) => n + 1)}
                  />
                ) : (
                  <HostApiForm
                    project={builder.project}
                    docs={builder.docs}
                    inferenceInputDocIds={builder.inferenceInputDocIds}
                    onCreated={() => setRefreshToken((n) => n + 1)}
                  />
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <DeploymentsList refreshToken={refreshToken} />
              </section>
            </div>

            {runTabsBlocked ? null : (
              <p className="mx-auto mt-4 max-w-6xl font-mono text-[10px] text-muted-foreground">
                Tip: assign default inputs in Inference before publishing — they seed shared runs and API calls.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

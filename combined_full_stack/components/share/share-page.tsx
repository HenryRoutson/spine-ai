"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Boxes, Globe, LayoutTemplate, type LucideIcon, ScrollText, Store, User, Users } from "lucide-react"
import {
  DeploymentActivityPage,
  type ActivityFilter,
} from "@/components/share/deployment-activity-page"
import { DeploymentsList } from "@/components/share/deployments-list"
import { MarketplaceBrowsePanel } from "@/components/share/marketplace-browse-panel"
import { ShareSheet } from "@/components/share/share-sheet"
import { MyPipelinesPanel } from "@/components/share/my-pipelines-panel"
import { OwnPipelineRunner } from "@/components/share/own-pipeline-runner"
import { ShareLinkForm } from "@/components/share/share-link-form"
import { ShareSiteForm } from "@/components/share/share-site-form"
import { PipelineWebsitesPanel } from "@/components/share/pipeline-websites-panel"
import { PlatformShareHub } from "@/components/platform/platform-share-hub"
import { SharedLinkRunner } from "@/components/share/shared-link-runner"
import { SharedWithMePanel } from "@/components/share/shared-with-me-panel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useOptionalStore } from "@/lib/store"
import { isVibeWindow } from "@/lib/app-nav-config"
import { useAppShell } from "@/lib/app-shell"
import { consumePendingSharedRun } from "@/lib/pending-shared-run"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import {
  ShareSection,
  ShareTabLabel,
} from "@/lib/window-panel-meta"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import type { ProjectId } from "@/lib/types"

type ShareNavEntry = {
  id: ShareSection
  label: string
  icon: LucideIcon
}

// AI : Share inside a project publishes this project. Other pipelines live on All projects / Run.
const BUILDER_SHARE_NAV: ShareNavEntry[] = [
  { id: ShareSection.Publish, label: ShareTabLabel.Publish, icon: Globe },
  { id: ShareSection.Activity, label: ShareTabLabel.Activity, icon: ScrollText },
]

export function SharePage({ simple }: { simple?: boolean } = {}) {
  useMarkPrimarySectionReady(AppPrimarySection.Run)
  const builder = useOptionalStore()
  const isConsumer = !builder
  const { setActiveWindow, activeWindow, activeSharedLinkId, openSharedRun, editingWebsite } = useAppShell()
  const isVibe = isVibeWindow(activeWindow)
  // AI : vibe/simple — hosted page studio + mint; Link / API / Embed stay on the full Share page.
  const isSimple = simple === true || isVibe
  const { typesInvalid, pipelineInvalid, runTabsBlocked } = builder
    ? computeWorkspaceValidity(builder.modules, builder.models, builder.typeAliases)
    : { typesInvalid: false, pipelineInvalid: false, runTabsBlocked: false }
  const [section, setSection] = useState<ShareSection>(
    isConsumer ? ShareSection.MyPipelines : ShareSection.Publish,
  )
  const [refreshToken, setRefreshToken] = useState(0)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>(null)
  const [activeOwnProjectId, setActiveOwnProjectId] = useState<ProjectId | null>(null)

  useEffect(() => {
    const pending = consumePendingSharedRun()
    if (pending) {
      openSharedRun(pending)
      if (isConsumer) setSection(ShareSection.Shared)
    }
  }, [isConsumer, openSharedRun])

  if (activeSharedLinkId) {
    return <SharedLinkRunner linkId={activeSharedLinkId} />
  }

  if (activeOwnProjectId) {
    return (
      <OwnPipelineRunner
        projectId={activeOwnProjectId}
        onBack={() => setActiveOwnProjectId(null)}
      />
    )
  }

  if (isConsumer) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-5">
          <div className="mx-auto flex max-w-6xl gap-1 py-2">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                section === ShareSection.MyPipelines
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSection(ShareSection.MyPipelines)}
            >
              <User className="h-3.5 w-3.5" />
              {ShareTabLabel.MyPipelines}
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                section === ShareSection.Shared
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSection(ShareSection.Shared)}
            >
              <Users className="h-3.5 w-3.5" />
              {ShareTabLabel.SharedWithMe}
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                section === ShareSection.Marketplace
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSection(ShareSection.Marketplace)}
            >
              <Store className="h-3.5 w-3.5" />
              Marketplace
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {section === ShareSection.Marketplace ? (
            <MarketplaceBrowsePanel kind="pipeline" />
          ) : section === ShareSection.Shared ? (
            <div className="mx-auto max-w-2xl">
              <SharedWithMePanel onRun={openSharedRun} />
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              <MyPipelinesPanel onRun={setActiveOwnProjectId} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const publishBlocked = typesInvalid || pipelineInvalid
  const editingSiteOptions = editingWebsite?.siteOptions
  const visibleSection = BUILDER_SHARE_NAV.some((item) => item.id === section)
    ? section
    : ShareSection.Publish

  return (
    <div className="flex h-full flex-col">
      {isSimple || editingWebsite ? null : (
        <div className="border-b border-border px-5">
          <div className="mx-auto flex max-w-6xl gap-1 py-2">
            {BUILDER_SHARE_NAV.map((item) => (
              <ShareNavButton
                key={item.id}
                active={visibleSection === item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  if (item.id === ShareSection.Activity) setActivityFilter(null)
                  setSection(item.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className={cn("min-h-0 flex-1", editingWebsite ? "overflow-hidden" : "overflow-y-auto p-5")}>
        {visibleSection === ShareSection.Activity ? (
          <DeploymentActivityPage projectId={builder.project.id} initialFilter={activityFilter} />
        ) : editingWebsite ? (
          <ShareSiteForm
            project={builder.project}
            docs={builder.docs}
            inferenceInputDocIds={builder.inferenceInputDocIds}
            onCreated={() => setRefreshToken((n) => n + 1)}
          />
        ) : publishBlocked ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-6 py-8">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <p className="mt-4 text-sm font-medium text-destructive">
                {isSimple
                  ? "Ask in chat to fix this."
                  : typesInvalid
                    ? "Fix type errors in Structure before publishing."
                    : "Fix pipeline validation errors before publishing."}
              </p>
              {isSimple ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setActiveWindow(typesInvalid ? "structure" : "pipeline")}
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Go to {typesInvalid ? "Structure" : "Pipeline"}
                </Button>
              )}
            </div>
          </div>
        ) : isSimple ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-8">
            <section className="rounded-lg border border-border bg-card p-4">
              <ShareLinkForm
                project={builder.project}
                docs={builder.docs}
                inferenceInputDocIds={builder.inferenceInputDocIds}
                onCreated={() => setRefreshToken((n) => n + 1)}
                simple
              />
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <PlatformShareHub
                project={builder.project}
                siteOptions={editingSiteOptions}
                onShared={() => setRefreshToken((n) => n + 1)}
              />
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <PipelineWebsitesPanel project={builder.project} projects={builder.projects} />
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <DeploymentsList projectId={builder.project.id} refreshToken={refreshToken} simple />
            </section>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-5 max-w-6xl">
              <section className="rounded-lg border border-border bg-card p-4">
                <PlatformShareHub
                  project={builder.project}
                  siteOptions={editingSiteOptions}
                  onShared={() => setRefreshToken((n) => n + 1)}
                />
              </section>
            </div>
            <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card p-4">
                <ShareSheet
                  target={{ kind: "pipeline", project: builder.project }}
                  docs={builder.docs}
                  inferenceInputDocIds={builder.inferenceInputDocIds}
                  projects={builder.projects}
                  onCreated={() => setRefreshToken((n) => n + 1)}
                />
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <DeploymentsList
                  projectId={builder.project.id}
                  refreshToken={refreshToken}
                  onViewActivity={(filter) => {
                    setActivityFilter(filter)
                    setSection(ShareSection.Activity)
                  }}
                />
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

function ShareNavButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

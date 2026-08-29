"use client"

import { useState } from "react"
import { Globe, LayoutTemplate, PanelTop, Store, Zap } from "lucide-react"
import { HostApiForm } from "@/components/share/host-api-form"
import { MarketplacePublishForm } from "@/components/share/marketplace-publish-form"
import { PipelineWebsitesPanel } from "@/components/share/pipeline-websites-panel"
import { ShareEmbedForm } from "@/components/share/share-embed-form"
import { ShareLinkForm } from "@/components/share/share-link-form"
import { sharedLinkPublicPath } from "@/lib/hosted-site"
import { shareTargetShowsApi, type ShareTarget } from "@/lib/share-target"
import { PublishTab } from "@/lib/window-panel-meta"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"

// AI : generic share — same cards for pipelines and websites; API / website-attach are pipeline-only.

const SHARE_TAB_ACTION = {
  [PublishTab.Link]: "share.tab.link",
  [PublishTab.Api]: "share.tab.api",
  [PublishTab.Embed]: "share.tab.embed",
  [PublishTab.Site]: "share.tab.site",
  [PublishTab.Marketplace]: "share.tab.marketplace",
} as const

export function ShareSheet({
  target,
  docs,
  inferenceInputDocIds,
  projects = [],
  onCreated,
}: {
  target: ShareTarget
  docs: DocRef[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  projects?: Project[]
  onCreated?: () => void
}) {
  const project = target.kind === "pipeline" ? target.project : target.project ?? null
  const showsApi = shareTargetShowsApi(target)
  const showsWebsiteAttach = target.kind === "pipeline"
  const [tab, setTab] = useState<PublishTab>(PublishTab.Link)

  const tabs: { id: PublishTab; label: string; icon: typeof Globe; show: boolean }[] = [
    { id: PublishTab.Link, label: "Link", icon: Globe, show: true },
    { id: PublishTab.Api, label: "API", icon: Zap, show: showsApi },
    { id: PublishTab.Embed, label: "Embed", icon: PanelTop, show: true },
    { id: PublishTab.Site, label: "Website", icon: LayoutTemplate, show: showsWebsiteAttach },
    { id: PublishTab.Marketplace, label: "Marketplace", icon: Store, show: true },
  ]
  const visible = tabs.filter((t) => t.show)
  const active = visible.some((t) => t.id === tab) ? tab : visible[0]!.id

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Share a link, embed, or marketplace listing. API hosting is pipeline-only. You-pay / I-pay
        applies when a function can run.
      </p>
      <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
        {visible.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                active === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(item.id)}
              {...spineActionProps(SHARE_TAB_ACTION[item.id])}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {target.kind === "website" && !project ? (
        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-sm font-medium">Page-only site</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {typeof window !== "undefined"
              ? `${window.location.origin}${sharedLinkPublicPath(target.site.id)}`
              : sharedLinkPublicPath(target.site.id)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Attach a function to enable you-pay / I-pay. The page can still be listed on the marketplace.
          </p>
        </div>
      ) : null}

      {project && active === PublishTab.Link ? (
        <ShareLinkForm
          project={project}
          docs={docs}
          inferenceInputDocIds={inferenceInputDocIds}
          onCreated={onCreated}
        />
      ) : null}
      {project && showsApi && active === PublishTab.Api ? (
        <HostApiForm
          project={project}
          docs={docs}
          inferenceInputDocIds={inferenceInputDocIds}
          onCreated={onCreated}
        />
      ) : null}
      {project && active === PublishTab.Embed ? (
        <ShareEmbedForm
          project={project}
          docs={docs}
          inferenceInputDocIds={inferenceInputDocIds}
          onCreated={onCreated}
        />
      ) : null}
      {showsWebsiteAttach && project && active === PublishTab.Site ? (
        <PipelineWebsitesPanel project={project} projects={projects} />
      ) : null}
      {active === PublishTab.Marketplace ? (
        <MarketplacePublishForm
          project={project}
          kind={target.kind === "website" ? "website" : "pipeline"}
          siteOptions={target.kind === "website" ? target.site.siteOptions : undefined}
          onCreated={onCreated}
        />
      ) : null}
    </div>
  )
}

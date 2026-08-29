"use client"

// AI : TODO (spine-in-spine-bootstrap-S3-actions) — capture data-spine-id clicks on hosted HTML and
// AI :   dispatch SESSION_ACTIONS (zod parse of nearest form). Same ids as GUI/TUI/MCP.
// AI : TODO (spine-in-spine-bootstrap-S4-dag) — mount {{slot:pipeline-dag}} / type-expr / step-trace /
// AI :   code as HostedSlot widgets wrapping existing components (see roadmap S4).
// AI : TODO (spine-in-spine-bootstrap-S8-site) — spine_in_spine seed HostedSiteOptions.pages[] render
// AI :   here; nav links are hosted pages, not AppWindowId.

import { useMemo } from "react"
import { SharedRunViewer } from "@/components/shared-run-viewer"
import { HostedSiteAccountBar, HostedSiteSignInCard } from "@/components/share/hosted-site-sign-in"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import { HostedSiteReactPreview } from "@/components/share/hosted-site-react-preview"
import { HostedSiteSlotWidgets } from "@/components/share/hosted-site-slot-widgets"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { compileHostedSiteHtml, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import { HostedSiteActionButton } from "@/components/share/hosted-site-action-button"
import { HostedSiteSqlWidget } from "@/components/share/hosted-site-sql-widget"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import type { hosted_site_react_bundle } from "@/lib/hosted-site-react"
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session"
import { useSupabaseSession } from "@/lib/use-supabase-session"
import { hostedActionButtonLabel } from "@/lib/hosted-site-slots"
import { resolveWebsitePipelineBindings } from "@/lib/website-pipelines"
import { hostedTableSlotsForProject } from "@/components/platform/hosted-table-slot"
import type { Project, ProjectId, StructureModel } from "@/lib/types"
import type { ReactNode } from "react"

export function HostedSiteViewer({
  linkId,
  siteOptions,
  viewerMarkdown = "",
  projectId,
  reactBundle,
  reactCompileError,
  models = [],
  structureRows,
}: {
  linkId: string
  siteOptions?: HostedSiteOptions | null
  viewerMarkdown?: string
  projectId: ProjectId
  reactBundle?: hosted_site_react_bundle | null
  reactCompileError?: string | null
  models?: StructureModel[]
  structureRows?: Project["structureRows"]
}) {
  const options = normalizeHostedSiteOptions(siteOptions ?? DEFAULT_HOSTED_SITE_OPTIONS)
  const { email, isAuthenticated, signOut } = useSupabaseSession()
  const nextPath = `/site/${linkId}`
  const showSignIn = options.auth.enabled && !isAuthenticated
  const hasDocsSlot = useMemo(
    () => compileHostedSiteHtml(options).segments.some((s) => s.kind === "slot" && s.slot === "docs"),
    [options],
  )
  const widgets = HostedSiteSlotWidgets({
    projectName: options.brand.companyName,
    viewerMarkdown,
    modules: [],
    hideDocsInRun: hasDocsSlot,
  })
  const bindings = resolveWebsitePipelineBindings(projectId, options.pipelineBindings)
  const compiled = useMemo(() => compileHostedSiteHtml(options), [options])
  const sqlByTable = useMemo(() => {
    const map: Record<string, ReactNode> = {}
    for (const seg of compiled.segments) {
      if (seg.kind === "slot" && seg.slot === "sql" && seg.alias && !map[seg.alias]) {
        map[seg.alias] = <HostedSiteSqlWidget key={seg.alias} linkId={linkId} table={seg.alias} />
      }
    }
    return map
  }, [compiled.segments, linkId])
  const actionByAlias = useMemo(() => {
    const map: Record<string, ReactNode> = {}
    for (const seg of compiled.segments) {
      if (seg.kind !== "slot" || seg.slot !== "action") continue
      const alias = seg.alias || "run"
      if (map[alias]) continue
      map[alias] = (
        <HostedSiteActionButton
          key={alias}
          linkId={linkId}
          alias={alias === "run" ? undefined : alias}
          label={hostedActionButtonLabel(alias === "run" ? undefined : alias)}
        />
      )
    }
    return map
  }, [compiled.segments, linkId])
  const runByAlias = useMemo(() => {
    const map: Record<string, ReactNode> = {}
    for (const binding of bindings) {
      map[binding.alias] = (
        <SharedRunViewer
          key={binding.alias}
          linkId={linkId}
          variant="site"
          hideViewerMarkdown={hasDocsSlot}
          pipelineAlias={binding.alias}
        />
      )
    }
    if (!map.run) {
      map.run = (
        <SharedRunViewer linkId={linkId} variant="site" hideViewerMarkdown={hasDocsSlot} />
      )
    }
    return map
  }, [bindings, hasDocsSlot, linkId])
  const tableByAlias = useMemo(
    () => hostedTableSlotsForProject({ id: projectId, models, structureRows }),
    [projectId, models, structureRows],
  )

  const accountBar =
    options.auth.enabled && isAuthenticated && email ? (
      <HostedSiteAccountBar
        email={email}
        onSignOut={() =>
          void signOut().then(() => {
            clearWorkspaceClientSession()
            window.location.href = nextPath
          })
        }
      />
    ) : null

  if (showSignIn) {
    return (
      <HostedSiteChrome
        options={options}
        surface="signin"
        slots={{
          auth: (
            <HostedSiteSignInCard
              companyName={options.brand.companyName}
              nextPath={nextPath}
              provider={options.auth.provider}
            />
          ),
        }}
      />
    )
  }

  const runSlot = (
    <>
      {accountBar}
      {runByAlias.run}
    </>
  )

  if (options.runtime === "react") {
    return (
      <div>
        {accountBar}
        <HostedSiteReactPreview
          options={options}
          runByAlias={{ ...runByAlias, run: runSlot }}
          tableByAlias={tableByAlias}
          slots={widgets}
          bundle={reactBundle}
          compileError={reactCompileError}
        />
      </div>
    )
  }

  return (
    <HostedSiteChrome
      options={options}
      slots={{
        ...widgets,
        run: runSlot,
      }}
      runByAlias={{ ...runByAlias, run: runSlot }}
      sqlByTable={sqlByTable}
      actionByAlias={actionByAlias}
      tableByAlias={tableByAlias}
    />
  )
}

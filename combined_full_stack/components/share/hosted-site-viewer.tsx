"use client"

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
import { resolveWebsitePipelineBindings } from "@/lib/website-pipelines"
import type { ProjectId } from "@/lib/types"
import type { ReactNode } from "react"

export function HostedSiteViewer({
  linkId,
  siteOptions,
  viewerMarkdown = "",
  projectId,
  reactBundle,
  reactCompileError,
}: {
  linkId: string
  siteOptions?: HostedSiteOptions | null
  viewerMarkdown?: string
  projectId: ProjectId
  reactBundle?: hosted_site_react_bundle | null
  reactCompileError?: string | null
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
      const binding = bindings.find((b) => b.alias === alias)
      map[alias] = (
        <HostedSiteActionButton
          key={alias}
          linkId={linkId}
          alias={alias === "run" ? undefined : alias}
          label={binding ? "Double it" : "Run"}
        />
      )
    }
    return map
  }, [bindings, compiled.segments, linkId])
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
    />
  )
}

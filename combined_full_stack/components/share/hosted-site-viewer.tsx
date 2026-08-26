"use client"

import { useMemo } from "react"
import { SharedRunViewer } from "@/components/shared-run-viewer"
import { HostedSiteAccountBar, HostedSiteSignInCard } from "@/components/share/hosted-site-sign-in"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import { HostedSiteSlotWidgets } from "@/components/share/hosted-site-slot-widgets"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { compileHostedSiteHtml, normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session"
import { useSupabaseSession } from "@/lib/use-supabase-session"

export function HostedSiteViewer({
  linkId,
  siteOptions,
  viewerMarkdown = "",
}: {
  linkId: string
  siteOptions?: HostedSiteOptions | null
  viewerMarkdown?: string
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

  return (
    <HostedSiteChrome
      options={options}
      slots={{
        ...widgets,
        run: (
          <>
            {options.auth.enabled && isAuthenticated && email ? (
              <HostedSiteAccountBar
                email={email}
                onSignOut={() =>
                  void signOut().then(() => {
                    clearWorkspaceClientSession()
                    window.location.href = nextPath
                  })
                }
              />
            ) : null}
            <SharedRunViewer linkId={linkId} variant="site" hideViewerMarkdown={hasDocsSlot} />
          </>
        ),
      }}
    />
  )
}

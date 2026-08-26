"use client"

import { SharedRunViewer } from "@/components/shared-run-viewer"
import { HostedSiteAccountBar, HostedSiteSignInCard } from "@/components/share/hosted-site-sign-in"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session"
import { useSupabaseSession } from "@/lib/use-supabase-session"

export function HostedSiteViewer({
  linkId,
  siteOptions,
}: {
  linkId: string
  siteOptions?: HostedSiteOptions | null
}) {
  const options = normalizeHostedSiteOptions(siteOptions ?? DEFAULT_HOSTED_SITE_OPTIONS)
  const { email, isAuthenticated, signOut } = useSupabaseSession()
  const nextPath = `/site/${linkId}`
  const showSignIn = options.auth.enabled && !isAuthenticated

  if (showSignIn) {
    return (
      <HostedSiteChrome options={options} surface="signin">
        <HostedSiteSignInCard
          companyName={options.brand.companyName}
          nextPath={nextPath}
          provider={options.auth.provider}
        />
      </HostedSiteChrome>
    )
  }

  return (
    <HostedSiteChrome options={options}>
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
      <SharedRunViewer linkId={linkId} variant="site" />
    </HostedSiteChrome>
  )
}

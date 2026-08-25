"use client"

import { SharedRunViewer } from "@/components/shared-run-viewer"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { HostedSiteOptions } from "@/lib/shared-link-types"

export function HostedSiteViewer({
  linkId,
  siteOptions,
}: {
  linkId: string
  siteOptions?: HostedSiteOptions | null
}) {
  const options = normalizeHostedSiteOptions(siteOptions ?? DEFAULT_HOSTED_SITE_OPTIONS)
  return (
    <HostedSiteChrome options={options}>
      <SharedRunViewer linkId={linkId} variant="site" />
    </HostedSiteChrome>
  )
}

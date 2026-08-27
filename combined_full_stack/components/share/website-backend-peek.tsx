"use client"

import { BackendWorkspace } from "@/components/platform/backend-workspace"
import { useAppShell } from "@/lib/app-shell"

// AI : website Building → Data — same tables/rows workspace as the pipeline Data tab.
export function WebsiteBackendPeek() {
  const { editingWebsite, patchEditingWebsite } = useAppShell()
  return (
    <BackendWorkspace
      siteAuth={editingWebsite?.siteOptions.auth}
      onSiteAuthChange={
        editingWebsite
          ? (auth) =>
              patchEditingWebsite({
                ...editingWebsite,
                siteOptions: { ...editingWebsite.siteOptions, auth },
              })
          : undefined
      }
    />
  )
}

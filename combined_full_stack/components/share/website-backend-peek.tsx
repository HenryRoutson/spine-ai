"use client"

import { BackendWorkspace } from "@/components/platform/backend-workspace"
import { useAppShell } from "@/lib/app-shell"

// AI : website Building → Backend — same workspace as the pipeline Backend tab.
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

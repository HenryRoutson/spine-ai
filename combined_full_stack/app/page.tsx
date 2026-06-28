"use client"

import { StoreProvider } from "@/lib/store"
import { DocViewerProvider } from "@/lib/doc-viewer"
import { AppShellProvider } from "@/lib/app-shell"
import { ProjectAssistantProvider } from "@/lib/project-assistant-context"
import { AppShellLayout } from "@/components/app-shell-layout"

export default function Page() {
  return (
    <StoreProvider>
      <DocViewerProvider>
        <AppShellProvider>
          <ProjectAssistantProvider>
            <AppShellLayout />
          </ProjectAssistantProvider>
        </AppShellProvider>
      </DocViewerProvider>
    </StoreProvider>
  )
}

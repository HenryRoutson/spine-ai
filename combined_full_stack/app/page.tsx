"use client"

import { StoreProvider } from "@/lib/store"
import { DocViewerProvider } from "@/lib/doc-viewer"
import { AppShellProvider } from "@/lib/app-shell"
import { ProjectAssistantProvider } from "@/lib/project-assistant-context"
import { AppShellLayout } from "@/components/app-shell-layout"
import { WorkspaceGate } from "@/components/workspace-gate"

export default function Page() {
  return (
    <WorkspaceGate>
      <StoreProvider mode="workspace">
        <DocViewerProvider>
          <AppShellProvider>
            <ProjectAssistantProvider>
              <AppShellLayout />
            </ProjectAssistantProvider>
          </AppShellProvider>
        </DocViewerProvider>
      </StoreProvider>
    </WorkspaceGate>
  )
}

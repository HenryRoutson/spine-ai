"use client"

import { StoreProvider } from "@/lib/store"
import { DocViewerProvider } from "@/lib/doc-viewer"
import { AppShellProvider } from "@/lib/app-shell"
import { ProjectAssistantProvider } from "@/lib/project-assistant-context"
import { DiagnosisAgentProvider } from "@/lib/diagnosis-agent-context"
import { AppShellLayout } from "@/components/app-shell-layout"

export default function Page() {
  return (
    <StoreProvider mode="workspace">
      <DocViewerProvider>
        <AppShellProvider>
          <ProjectAssistantProvider>
            <DiagnosisAgentProvider>
              <AppShellLayout />
            </DiagnosisAgentProvider>
          </ProjectAssistantProvider>
        </AppShellProvider>
      </DocViewerProvider>
    </StoreProvider>
  )
}

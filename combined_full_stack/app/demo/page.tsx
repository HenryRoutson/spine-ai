"use client";

import { useLayoutEffect, useState } from "react";
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session";
import { StoreProvider, StoreMode } from "@/lib/store";
import { DocViewerProvider } from "@/lib/doc-viewer";
import { AppShellProvider } from "@/lib/app-shell";
import { ProjectAssistantProvider } from "@/lib/project-assistant-context";
import { DiagnosisAgentProvider } from "@/lib/diagnosis-agent-context";
import { AppShellKindProvider } from "@/lib/app-shell-kind";
import { AppShellLayout } from "@/components/app-shell-layout";
import { setDemoMode, setPreviewOnly } from "@/lib/demo-mode";

// AI : public preview route — embed=1 sizing; preview=1 disables runs; buildId loads landing-built pipeline.
export default function DemoPage() {
  const [, setPreviewGate] = useState(false)

  useLayoutEffect(() => {
    // AI : isolate landing iframe from a signed-in workspace tab in the same browser.
    clearWorkspaceClientSession();
    // AI : flags before paint — child effects would otherwise hit authed APIs and 401.
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1"
    setPreviewOnly(isPreview)
    setDemoMode(true)
    setPreviewGate(true)
    return () => {
      setPreviewOnly(false)
      setDemoMode(false)
    }
  }, []);

  return (
    <AppShellKindProvider>
      <StoreProvider mode={StoreMode.Demo}>
        <DocViewerProvider>
          <AppShellProvider>
            <ProjectAssistantProvider>
              <DiagnosisAgentProvider>
                <AppShellLayout variant="embed" />
              </DiagnosisAgentProvider>
            </ProjectAssistantProvider>
          </AppShellProvider>
        </DocViewerProvider>
      </StoreProvider>
    </AppShellKindProvider>
  );
}

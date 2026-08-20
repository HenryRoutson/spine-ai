"use client";

import { useLayoutEffect, useState } from "react";
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session";
import { StoreProvider, StoreMode } from "@/lib/store";
import { DocViewerProvider } from "@/lib/doc-viewer";
import { AppShellProvider } from "@/lib/app-shell";
import { ProjectAssistantProvider } from "@/lib/project-assistant-context";
import { DiagnosisAgentProvider } from "@/lib/diagnosis-agent-context";
import { AppShellKindProvider, AppShellKind } from "@/lib/app-shell-kind";
import { AppShellLayout } from "@/components/app-shell-layout";
import { RunJobsProvider } from "@/lib/run-jobs-context";
import { setDemoMode, setPreviewOnly } from "@/lib/demo-mode";

// AI : public preview route — embed=1 sizing; preview=1 disables runs; buildId loads landing-built pipeline.
export default function DemoPage() {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    // AI : isolate landing iframe from a signed-in workspace tab in the same browser.
    clearWorkspaceClientSession();
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1"
    setPreviewOnly(isPreview)
    setDemoMode(true)
    setReady(true)
    return () => {
      setPreviewOnly(false)
      setDemoMode(false)
    }
  }, []);

  if (!ready) return null

  return (
    // AI : provider above StoreProvider — /demo vibe mounts Inference; store skeleton used to skip AppShellLayout's wrap.
    <RunJobsProvider>
      <AppShellKindProvider initialKind={AppShellKind.Builder}>
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
    </RunJobsProvider>
  );
}

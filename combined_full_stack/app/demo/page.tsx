"use client";

import { useEffect } from "react";
import { StoreProvider } from "@/lib/store";
import { DocViewerProvider } from "@/lib/doc-viewer";
import { AppShellProvider } from "@/lib/app-shell";
import { ProjectAssistantProvider } from "@/lib/project-assistant-context";
import { AppShellLayout } from "@/components/app-shell-layout";
import { writeActiveProjectSession } from "@/lib/active-project-session";
import { DEMO_DEFAULT_PROJECT_ID } from "@/lib/demo-constants";
import { setPreviewOnly } from "@/lib/demo-mode";
import type { ProjectId } from "@/lib/types";

// AI : public preview route — embed=1 sizing; preview=1 disables runs; buildId loads landing-built pipeline.
export default function DemoPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPreviewOnly(params.get("preview") === "1");
    const buildId = params.get("buildId");
    writeActiveProjectSession((buildId ?? DEMO_DEFAULT_PROJECT_ID) as ProjectId);
    return () => setPreviewOnly(false);
  }, []);

  return (
    <StoreProvider mode="demo">
      <DocViewerProvider>
        <AppShellProvider>
          <ProjectAssistantProvider>
            <AppShellLayout variant="embed" />
          </ProjectAssistantProvider>
        </AppShellProvider>
      </DocViewerProvider>
    </StoreProvider>
  );
}

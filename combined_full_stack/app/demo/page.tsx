"use client";

import { useEffect } from "react";
import { StoreProvider } from "@/lib/store";
import { DocViewerProvider } from "@/lib/doc-viewer";
import { AppShellProvider } from "@/lib/app-shell";
import { ProjectAssistantProvider } from "@/lib/project-assistant-context";
import { AppShellLayout } from "@/components/app-shell-layout";
import { setPreviewOnly } from "@/lib/demo-mode";

// AI : public preview route — embed=1 sizing; preview=1 disables runs; buildId loads landing-built pipeline.
export default function DemoPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPreviewOnly(params.get("preview") === "1");
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

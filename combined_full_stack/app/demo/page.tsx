"use client";

import { useEffect } from "react";
import { StoreProvider } from "@/lib/store";
import { DocViewerProvider } from "@/lib/doc-viewer";
import { AppShellProvider } from "@/lib/app-shell";
import { ProjectAssistantProvider } from "@/lib/project-assistant-context";
import { AppShellLayout } from "@/components/app-shell-layout";
import { writeActiveProjectSession } from "@/lib/active-project-session";
import { DEMO_DEFAULT_PROJECT_ID } from "@/lib/demo-constants";

// AI : public preview route — always embed chrome; ?embed=1 only affects landing iframe sizing.
export default function DemoPage() {
  useEffect(() => {
    writeActiveProjectSession(DEMO_DEFAULT_PROJECT_ID);
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

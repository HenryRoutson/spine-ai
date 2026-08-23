import { AppWindowId } from "@/lib/app-window-id"
import { BUILDER_WORKSPACE_WINDOW_IDS } from "@/lib/app-nav-config"

const prefetched = new Set<AppWindowId>()

const PREFETCH_CHUNK: Record<AppWindowId, () => Promise<unknown>> = {
  [AppWindowId.Structure]: () => import("@/components/structure-builder"),
  [AppWindowId.Pipeline]: () => import("@/components/pipeline-builder"),
  [AppWindowId.Testing]: () => import("@/components/testing"),
  [AppWindowId.Inference]: () => import("@/components/inference"),
  [AppWindowId.Schedule]: () => import("@/components/schedule-page"),
  [AppWindowId.Share]: () => import("@/components/share/share-page"),
  [AppWindowId.Earnings]: () => import("@/components/earnings"),
  [AppWindowId.Logging]: () => import("@/components/logging"),
  [AppWindowId.Cache]: () => import("@/components/cache"),
  [AppWindowId.Documents]: () => import("@/components/documents"),
  [AppWindowId.Docs]: () => import("@/components/documentation"),
  [AppWindowId.ProjectBilling]: () => import("@/components/project-billing"),
  [AppWindowId.ProjectSettings]: () => import("@/components/project-settings"),
  [AppWindowId.Vibe]: () => import("@/components/vibe-panel"),
  [AppWindowId.Billing]: () => import("@/components/billing"),
  [AppWindowId.Settings]: () => import("@/components/settings"),
}

export function prefetchWorkspacePanel(windowId: AppWindowId): void {
  if (prefetched.has(windowId)) return
  prefetched.add(windowId)
  void PREFETCH_CHUNK[windowId]()
}

export function prefetchBuilderWorkspacePanels(priority?: AppWindowId): void {
  const ordered = priority
    ? [priority, ...BUILDER_WORKSPACE_WINDOW_IDS.filter((id) => id !== priority)]
    : BUILDER_WORKSPACE_WINDOW_IDS
  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[i]!
    if (i === 0) prefetchWorkspacePanel(id)
    else setTimeout(() => prefetchWorkspacePanel(id), i * 40)
  }
}

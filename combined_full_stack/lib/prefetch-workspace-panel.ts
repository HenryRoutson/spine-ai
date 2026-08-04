import type { AppWindowId } from "@/lib/app-shell"

const prefetched = new Set<AppWindowId>()

// AI : code-split chunk warmers — one import per workspace tab.
export function prefetchWorkspacePanel(windowId: AppWindowId): void {
  if (prefetched.has(windowId)) return
  prefetched.add(windowId)
  switch (windowId) {
    case "structure":
      void import("@/components/structure-builder")
      break
    case "pipeline":
      void import("@/components/pipeline-builder")
      break
    case "testing":
      void import("@/components/testing")
      break
    case "inference":
      void import("@/components/inference")
      break
    case "share":
      void import("@/components/share/share-page")
      break
    case "earnings":
      void import("@/components/earnings")
      break
    case "logging":
      void import("@/components/logging")
      break
    case "cache":
      void import("@/components/cache")
      break
    case "documents":
      void import("@/components/documents")
      break
    case "docs":
      void import("@/components/documentation")
      break
    case "billing":
      void import("@/components/billing")
      break
    case "settings":
      void import("@/components/settings")
      break
    default:
      prefetched.delete(windowId)
  }
}

const BUILDER_PANEL_ORDER: AppWindowId[] = [
  "structure",
  "pipeline",
  "testing",
  "inference",
  "share",
  "earnings",
  "logging",
  "cache",
  "documents",
  "docs",
]

// AI : warm the visible tab first, then stagger the rest so chunks don't compete on the wire.
export function prefetchBuilderWorkspacePanels(priority?: AppWindowId): void {
  const ordered = priority
    ? [priority, ...BUILDER_PANEL_ORDER.filter((id) => id !== priority)]
    : BUILDER_PANEL_ORDER
  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[i]!
    if (i === 0) prefetchWorkspacePanel(id)
    else setTimeout(() => prefetchWorkspacePanel(id), i * 40)
  }
}

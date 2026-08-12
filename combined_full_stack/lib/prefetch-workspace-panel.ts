import { AppWindowId } from "@/lib/app-window-id"

const prefetched = new Set<AppWindowId>()

// AI : code-split chunk warmers — one import per workspace tab.
export function prefetchWorkspacePanel(windowId: AppWindowId): void {
  if (prefetched.has(windowId)) return
  prefetched.add(windowId)
  switch (windowId) {
    case AppWindowId.Structure:
      void import("@/components/structure-builder")
      break
    case AppWindowId.Pipeline:
      void import("@/components/pipeline-builder")
      break
    case AppWindowId.Testing:
      void import("@/components/testing")
      break
    case AppWindowId.Inference:
      void import("@/components/inference")
      break
    case AppWindowId.Share:
      void import("@/components/share/share-page")
      break
    case AppWindowId.Earnings:
      void import("@/components/earnings")
      break
    case AppWindowId.Logging:
      void import("@/components/logging")
      break
    case AppWindowId.Cache:
      void import("@/components/cache")
      break
    case AppWindowId.Documents:
      void import("@/components/documents")
      break
    case AppWindowId.Docs:
      void import("@/components/documentation")
      break
    case AppWindowId.ProjectBilling:
      void import("@/components/project-billing")
      break
    case AppWindowId.ProjectSettings:
      void import("@/components/project-settings")
      break
    case AppWindowId.Vibe:
      void import("@/components/vibe-panel")
      break
    case AppWindowId.Billing:
      void import("@/components/billing")
      break
    case AppWindowId.Settings:
      void import("@/components/settings")
      break
    default:
      prefetched.delete(windowId)
  }
}

const BUILDER_PANEL_ORDER: AppWindowId[] = [
  AppWindowId.Structure,
  AppWindowId.Pipeline,
  AppWindowId.Testing,
  AppWindowId.Inference,
  AppWindowId.Share,
  AppWindowId.Earnings,
  AppWindowId.Logging,
  AppWindowId.Cache,
  AppWindowId.Documents,
  AppWindowId.Docs,
  AppWindowId.ProjectBilling,
  AppWindowId.ProjectSettings,
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

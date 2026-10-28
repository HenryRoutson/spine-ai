import { prefetchBuilderWorkspacePanels } from "@/lib/prefetch-workspace-panel"

// AI : warm builder workspace chunks before the user clicks Build in primary nav.
export function prefetchBuildPanel(): void {
  prefetchBuilderWorkspacePanels("structure")
}

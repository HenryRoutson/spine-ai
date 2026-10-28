import { isDemoMode } from "@/lib/demo-mode"
import { prefetchBillingPanel } from "@/lib/prefetch-billing-panel"
import { prefetchBuildPanel } from "@/lib/prefetch-build-panel"
import { prefetchRunPanel } from "@/lib/prefetch-run-panel"
import { prefetchSettingsPanel } from "@/lib/prefetch-settings-panel"

// AI : warm account panels first — build prefetch staggers many heavy chunks.
export function prefetchShellPanels(): void {
  // AI : /demo is public — billing/marketplace/settings APIs 401 and used to crash live preview.
  if (isDemoMode()) {
    prefetchBuildPanel()
    return
  }
  prefetchBillingPanel()
  prefetchSettingsPanel()
  prefetchRunPanel()
  prefetchBuildPanel()
}

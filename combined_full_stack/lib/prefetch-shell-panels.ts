import { prefetchBillingPanel } from "@/lib/prefetch-billing-panel"
import { prefetchBuildPanel } from "@/lib/prefetch-build-panel"
import { prefetchRunPanel } from "@/lib/prefetch-run-panel"
import { prefetchSettingsPanel } from "@/lib/prefetch-settings-panel"

// AI : warm account panels first — build prefetch staggers many heavy chunks.
export function prefetchShellPanels(): void {
  prefetchBillingPanel()
  prefetchSettingsPanel()
  prefetchRunPanel()
  prefetchBuildPanel()
}

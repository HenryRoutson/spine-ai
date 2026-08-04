import type { AppPrimarySection } from "@/components/app-primary-nav"
import type { AppMode } from "@/lib/app-mode-nav"
import { isAccountWindow } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"

export function resolvePrimarySection(mode: AppMode, activeWindow: AppWindowId): AppPrimarySection {
  if (activeWindow === "billing") return "billing"
  if (activeWindow === "settings") return "settings"
  return mode
}

export function handlePrimarySectionChange(
  section: AppPrimarySection,
  mode: AppMode,
  activeWindow: AppWindowId,
  setActiveWindow: (window: AppWindowId) => void,
  navigateToRun: () => void,
  navigateToBuild: () => void,
): void {
  if (section === "run") {
    if (mode === "run" && isAccountWindow(activeWindow)) setActiveWindow("share")
    else {
      navigateToRun()
      if (mode === "build") setActiveWindow("share")
    }
    return
  }
  if (section === "build") {
    if (mode === "build") {
      if (isAccountWindow(activeWindow)) setActiveWindow("structure")
    } else {
      navigateToBuild()
    }
    return
  }
  setActiveWindow(section)
}

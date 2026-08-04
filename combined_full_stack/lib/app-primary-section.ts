import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { AppMode } from "@/lib/app-mode-nav"
import { isAccountWindow } from "@/lib/app-nav-config"
import type { AppWindowId } from "@/lib/app-shell"

export function resolvePrimarySection(mode: AppMode, activeWindow: AppWindowId): AppPrimarySection {
  if (activeWindow === "billing") return AppPrimarySection.Billing
  if (activeWindow === "settings") return AppPrimarySection.Settings
  return mode === AppMode.Run ? AppPrimarySection.Run : AppPrimarySection.Build
}

export function handlePrimarySectionChange(
  section: AppPrimarySection,
  mode: AppMode,
  activeWindow: AppWindowId,
  setActiveWindow: (window: AppWindowId) => void,
  navigateToRun: () => void,
  navigateToBuild: () => void,
): void {
  if (section === AppPrimarySection.Run) {
    if (mode === AppMode.Run && isAccountWindow(activeWindow)) setActiveWindow("share")
    else {
      navigateToRun()
      if (mode === AppMode.Build) setActiveWindow("share")
    }
    return
  }
  if (section === AppPrimarySection.Build) {
    if (mode === AppMode.Build) {
      if (isAccountWindow(activeWindow)) setActiveWindow("structure")
    } else {
      navigateToBuild()
    }
    return
  }
  setActiveWindow(section)
}

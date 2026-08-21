import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { AppMode } from "@/lib/app-mode-nav"
import { isAccountWindow } from "@/lib/app-nav-config"
import { AppWindowId, type AppWindowId as AppWindowIdType } from "@/lib/app-shell"
import { readHideDeveloperTools } from "@/lib/developer-tools-settings"

export function resolvePrimarySection(mode: AppMode, activeWindow: AppWindowIdType): AppPrimarySection {
  if (activeWindow === AppWindowId.Billing) return AppPrimarySection.Billing
  if (activeWindow === AppWindowId.Settings) return AppPrimarySection.Settings
  // AI : Vibe lives inside the open project — keep L0 on Build so picker / Run still treat it as project work.
  if (activeWindow === AppWindowId.Vibe) return AppPrimarySection.Build
  return mode === AppMode.Run ? AppPrimarySection.Run : AppPrimarySection.Build
}

export function handlePrimarySectionChange(
  section: AppPrimarySection,
  mode: AppMode,
  activeWindow: AppWindowIdType,
  setActiveWindow: (window: AppWindowIdType) => void,
  navigateToRun: () => void,
  navigateToBuild: () => void,
): void {
  if (section === AppPrimarySection.Run) {
    if (mode === AppMode.Run && isAccountWindow(activeWindow)) setActiveWindow(AppWindowId.Share)
    else {
      navigateToRun()
      if (mode === AppMode.Build) setActiveWindow(AppWindowId.Share)
    }
    return
  }
  if (section === AppPrimarySection.Build) {
    if (mode === AppMode.Build) {
      // AI : L0 Build covers Vibe + editors — leaving account returns to the active build surface.
      if (isAccountWindow(activeWindow)) {
        setActiveWindow(readHideDeveloperTools() ? AppWindowId.Vibe : AppWindowId.Structure)
      }
      // AI : already on Build (vibe or editors) — sub-toggle switches surface, not L0.
    } else {
      navigateToBuild()
    }
    return
  }
  if (section === AppPrimarySection.Vibe) {
    // AI : legacy L0 Vibe → Build sub-surface (nav no longer exposes Vibe at L0).
    if (mode === AppMode.Build) {
      setActiveWindow(AppWindowId.Vibe)
    } else {
      navigateToBuild()
      setActiveWindow(AppWindowId.Vibe)
    }
    return
  }
  setActiveWindow(section)
}

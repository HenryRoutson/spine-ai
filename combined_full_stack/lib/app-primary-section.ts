import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { AppMode } from "@/lib/app-mode-nav"
import { isAccountWindow, isVibeWindow } from "@/lib/app-nav-config"
import { AppWindowId, type AppWindowId as AppWindowIdType } from "@/lib/app-shell"

export function resolvePrimarySection(mode: AppMode, activeWindow: AppWindowIdType): AppPrimarySection {
  if (activeWindow === AppWindowId.Billing) return AppPrimarySection.Billing
  if (activeWindow === AppWindowId.Settings) return AppPrimarySection.Settings
  if (activeWindow === AppWindowId.Vibe) return AppPrimarySection.Vibe
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
      // AI : leaving Vibe / account overlays returns to the technical workspace tabs.
      // AI : TODO (vibe) — restore last Build workspace tab instead of always Structure.
      if (isAccountWindow(activeWindow) || isVibeWindow(activeWindow)) {
        setActiveWindow(AppWindowId.Structure)
      }
    } else {
      navigateToBuild()
    }
    return
  }
  if (section === AppPrimarySection.Vibe) {
    // AI : TODO (vibe) — remember last vibe project / open agent chat on enter.
    // AI : TODO (vibe) — close Build agent dock when entering Vibe (avoid duplicate agent UI).
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

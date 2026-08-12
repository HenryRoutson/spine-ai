import { AppWindowId, type AppWindowId as AppWindowIdType } from "@/lib/app-window-id"
import { isVibeWindow } from "@/lib/app-nav-config"
import { APP_PRIMARY_SECTION_NAV, AppPrimarySection } from "@/lib/app-primary-section-labels"

// AI : Build L0 sub-decision — Vibe (agent) vs Build (visual editors); share one project selector.
export enum BuildSurface {
  Vibe = "vibe",
  Editors = "editors",
}

export function resolveBuildSurface(activeWindow: AppWindowIdType): BuildSurface {
  return isVibeWindow(activeWindow) ? BuildSurface.Vibe : BuildSurface.Editors
}

export function windowForBuildSurface(surface: BuildSurface): AppWindowIdType {
  return surface === BuildSurface.Vibe ? AppWindowId.Vibe : AppWindowId.Structure
}

export const BUILD_SURFACE_NAV: Record<
  BuildSurface,
  { label: string; title: string }
> = {
  [BuildSurface.Vibe]: APP_PRIMARY_SECTION_NAV[AppPrimarySection.Vibe],
  // AI : "dev" not "Build" — L0 header already owns Build; no explanatory tooltip.
  [BuildSurface.Editors]: {
    label: "dev",
    title: "dev",
  },
}

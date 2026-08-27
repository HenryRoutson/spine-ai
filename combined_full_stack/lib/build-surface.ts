import { AppWindowId, type AppWindowId as AppWindowIdType } from "@/lib/app-window-id"
import { isVibeWindow } from "@/lib/app-nav-config"
import { APP_PRIMARY_SECTION_NAV, AppPrimarySection } from "@/lib/app-primary-section-labels"

// AI : Build L0 sub-decision — Vibe (agent) vs Build (visual editors); share one selector.
// AI : On a website, Editors is page code (or the Data tab when developer tools are hidden), not Structure.
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
  [BuildSurface.Editors]: {
    label: "Building",
    title: "Visual editors — structure, pipeline, testing",
  },
}

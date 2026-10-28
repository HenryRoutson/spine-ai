// AI : persist Vibe vs Building preference across reloads.
import { BuildSurface } from "@/lib/build-surface"
import { stringBrowserPref } from "@/lib/browser-storage-pref"

export const BUILD_SURFACE_SETTINGS_CHANGED_EVENT = "spine-build-surface-changed" as const

function isBuildSurface(raw: string): raw is BuildSurface {
  return raw === BuildSurface.Vibe || raw === BuildSurface.Editors
}

const buildSurfacePref = stringBrowserPref<BuildSurface>({
  keySuffix: "build-surface",
  defaultValue: BuildSurface.Vibe,
  changedEvent: BUILD_SURFACE_SETTINGS_CHANGED_EVENT,
  isValid: isBuildSurface,
})

export function readBuildSurfacePreference(): BuildSurface {
  return buildSurfacePref.read()
}

export function writeBuildSurfacePreference(surface: BuildSurface): void {
  buildSurfacePref.write(surface)
}

import { AppWindowId } from "@/lib/app-window-id"

export enum AppArea {
  Build = "build",
  Deploy = "deploy",
  Observe = "observe",
  Library = "library",
  Account = "account",
  Run = "run",
}

export type BuilderAreaId = Exclude<AppArea, AppArea.Run>

export const BUILDER_AREA_WINDOWS: Record<BuilderAreaId, readonly AppWindowId[]> = {
  // AI : Data (id backend) sits next to Structures — tables/rows, not the pipeline compute.
  [AppArea.Build]: [
    AppWindowId.Structure,
    AppWindowId.Backend,
    AppWindowId.Pipeline,
    AppWindowId.Testing,
    AppWindowId.Inference,
    AppWindowId.Schedule,
    AppWindowId.Vibe,
  ],
  [AppArea.Deploy]: [AppWindowId.Share, AppWindowId.Earnings],
  [AppArea.Observe]: [AppWindowId.Logging, AppWindowId.Cache],
  [AppArea.Library]: [
    AppWindowId.Documents,
    AppWindowId.Docs,
    AppWindowId.Secrets,
    AppWindowId.ProjectBilling,
    AppWindowId.ProjectSettings,
  ],
  [AppArea.Account]: [AppWindowId.Billing, AppWindowId.Settings],
}

export const BUILDER_AREA_DEFAULT: Record<BuilderAreaId, AppWindowId> = {
  [AppArea.Build]: AppWindowId.Structure,
  [AppArea.Deploy]: AppWindowId.Share,
  [AppArea.Observe]: AppWindowId.Logging,
  [AppArea.Library]: AppWindowId.Documents,
  [AppArea.Account]: AppWindowId.Billing,
}

export const BUILDER_AREA_LABEL: Record<BuilderAreaId, string> = {
  [AppArea.Build]: "Build",
  [AppArea.Deploy]: "Deploy",
  [AppArea.Observe]: "Observe",
  [AppArea.Library]: "Library",
  [AppArea.Account]: "Account",
}

export const TUI_AREA_IDS: BuilderAreaId[] = [
  AppArea.Build,
  AppArea.Deploy,
  AppArea.Observe,
  AppArea.Library,
  AppArea.Account,
]

export function areaIdForWindow(window: AppWindowId): BuilderAreaId | undefined {
  for (const id of TUI_AREA_IDS) {
    if (BUILDER_AREA_WINDOWS[id].includes(window)) return id
  }
  return undefined
}

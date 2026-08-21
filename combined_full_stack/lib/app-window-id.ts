// AI : workspace tab ids — shared by shell, nav, and panel prefetch (avoid app-shell ↔ nav cycles).
// AI : TUI_TABS is Object.values(AppWindowId); area grouping lives in lib/app-area-windows.ts.
export const AppWindowId = {
  Structure: "structure",
  Pipeline: "pipeline",
  Testing: "testing",
  Inference: "inference",
  Share: "share",
  Earnings: "earnings",
  Logging: "logging",
  Cache: "cache",
  Documents: "documents",
  Docs: "docs",
  ProjectBilling: "project-billing",
  ProjectSettings: "project-settings",
  // AI : L0 Vibe — chat left (full project control); inference / share / logging observe on the right.
  Vibe: "vibe",
  Billing: "billing",
  Settings: "settings",
} as const

export type AppWindowId = (typeof AppWindowId)[keyof typeof AppWindowId]

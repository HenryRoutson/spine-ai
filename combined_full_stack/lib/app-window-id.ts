// AI : workspace tab ids — shared by shell, nav, and panel prefetch (avoid app-shell ↔ nav cycles).
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
  Billing: "billing",
  Settings: "settings",
} as const

export type AppWindowId = (typeof AppWindowId)[keyof typeof AppWindowId]

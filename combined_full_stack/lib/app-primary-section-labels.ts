// AI : L0 primary nav ids — Run / Build / Billing / Settings (Vibe is Build sub-surface copy only).
export enum AppPrimarySection {
  Run = "run",
  Build = "build",
  Vibe = "vibe",
  Billing = "billing",
  Settings = "settings",
}

// AI : L0 + Build-surface copy — Vibe label reused by BuildSurfaceNav, not L0.
export enum AppPrimarySectionTitle {
  Run = "Run",
  Build = "Build",
  Vibe = "Vibe",
  Billing = "Billing",
  Settings = "Settings",
}

export const APP_PRIMARY_SECTION_NAV: Record<
  AppPrimarySection,
  { label: AppPrimarySectionTitle; title: string }
> = {
  [AppPrimarySection.Run]: {
    label: AppPrimarySectionTitle.Run,
    title: "Run your pipelines and shared links",
  },
  [AppPrimarySection.Build]: {
    label: AppPrimarySectionTitle.Build,
    title: "Create and edit your own pipelines",
  },
  [AppPrimarySection.Vibe]: {
    label: AppPrimarySectionTitle.Vibe,
    title: "Agent-first build — full project control via chat",
  },
  [AppPrimarySection.Billing]: {
    label: AppPrimarySectionTitle.Billing,
    title: "Usage, credits, and cost attribution",
  },
  [AppPrimarySection.Settings]: {
    label: AppPrimarySectionTitle.Settings,
    title: "Account and workspace settings",
  },
}

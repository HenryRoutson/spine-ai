// AI : L0 primary nav ids — single source for Run / Build / Billing / Settings routing.
export enum AppPrimarySection {
  Run = "run",
  Build = "build",
  Billing = "billing",
  Settings = "settings",
}

// AI : L0 nav copy — single source for Run / Build / Billing / Settings titles.
export enum AppPrimarySectionTitle {
  Run = "Run",
  Build = "Build",
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
  [AppPrimarySection.Billing]: {
    label: AppPrimarySectionTitle.Billing,
    title: "Usage, credits, and cost attribution",
  },
  [AppPrimarySection.Settings]: {
    label: AppPrimarySectionTitle.Settings,
    title: "Account and workspace settings",
  },
}

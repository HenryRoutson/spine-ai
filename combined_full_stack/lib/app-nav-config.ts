import {
  Boxes,
  Play,
  ScrollText,
  Database,
  Files,
  CreditCard,
  BookOpen,
  SquareCheck,
  SquareArrowUp,
  Users,
  Wallet,
  Hammer,
  Rocket,
  Eye,
  Library,
  UserCircle,
  Settings2,
} from "lucide-react"
import { SpineNavIcon } from "@/components/spine-mark"
import { AppWindowId } from "@/lib/app-window-id"
import { AppPrimarySectionTitle } from "@/lib/app-primary-section-labels"

// AI : marketing site lives on a separate deploy from the app
export const LANDING_PAGE_URL = "https://www.spine-ai.dev/"

type NavIcon = React.ComponentType<{ className?: string }>

export enum AppArea {
  Build = "build",
  Deploy = "deploy",
  Observe = "observe",
  Library = "library",
  Account = "account",
  Run = "run",
}

export const BuildStepId = {
  Structure: AppWindowId.Structure,
  Pipeline: AppWindowId.Pipeline,
  Testing: AppWindowId.Testing,
  Inference: AppWindowId.Inference,
} as const

export type BuildStepId = (typeof BuildStepId)[keyof typeof BuildStepId]

export type AppNavItem = {
  id: AppWindowId
  label: string
  hint: string
  icon: NavIcon
}

export type AppAreaConfig = {
  id: AppArea
  label: string
  icon: NavIcon
  windows: AppWindowId[]
  defaultWindow: AppWindowId
}

export type BuildStepConfig = {
  id: BuildStepId
  label: string
  hint: string
  icon: NavIcon
}

export const BUILD_STEPS: BuildStepConfig[] = [
  { id: BuildStepId.Structure, label: "Structure", hint: "01", icon: Boxes },
  { id: BuildStepId.Pipeline, label: "Pipeline", hint: "02", icon: SpineNavIcon },
  { id: BuildStepId.Testing, label: "Testing", hint: "03", icon: SquareCheck },
  { id: BuildStepId.Inference, label: "Inference", hint: "04", icon: Play },
]

export const BUILD_STEP_IDS = new Set<BuildStepId>(BUILD_STEPS.map((s) => s.id))

export const BUILDER_AREAS: AppAreaConfig[] = [
  {
    id: AppArea.Build,
    label: "Build",
    icon: Hammer,
    windows: [AppWindowId.Structure, AppWindowId.Pipeline, AppWindowId.Testing, AppWindowId.Inference],
    defaultWindow: AppWindowId.Structure,
  },
  {
    id: AppArea.Deploy,
    label: "Deploy",
    icon: Rocket,
    windows: [AppWindowId.Share, AppWindowId.Earnings],
    defaultWindow: AppWindowId.Share,
  },
  {
    id: AppArea.Observe,
    label: "Observe",
    icon: Eye,
    windows: [AppWindowId.Logging, AppWindowId.Cache],
    defaultWindow: AppWindowId.Logging,
  },
  {
    id: AppArea.Library,
    label: "Library",
    icon: Library,
    windows: [AppWindowId.Documents, AppWindowId.Docs, AppWindowId.ProjectBilling, AppWindowId.ProjectSettings],
    defaultWindow: AppWindowId.Documents,
  },
  {
    id: AppArea.Account,
    label: "Account",
    icon: UserCircle,
    windows: [AppWindowId.Billing, AppWindowId.Settings],
    defaultWindow: AppWindowId.Billing,
  },
]

export const CONSUMER_AREAS: AppAreaConfig[] = [
  {
    id: AppArea.Run,
    label: "Run",
    icon: Users,
    windows: [AppWindowId.Share],
    defaultWindow: AppWindowId.Share,
  },
  {
    id: AppArea.Account,
    label: "Account",
    icon: UserCircle,
    windows: [AppWindowId.Billing, AppWindowId.Settings],
    defaultWindow: AppWindowId.Billing,
  },
]

export const AREA_SUB_NAV: Partial<Record<AppArea, AppNavItem[]>> = {
  [AppArea.Deploy]: [
    { id: AppWindowId.Share, label: "Share", hint: "05", icon: SquareArrowUp },
    { id: AppWindowId.Earnings, label: "Earnings", hint: "06", icon: Wallet },
  ],
  [AppArea.Observe]: [
    { id: AppWindowId.Logging, label: "Logging", hint: "07", icon: ScrollText },
    { id: AppWindowId.Cache, label: "Cache", hint: "08", icon: Database },
  ],
  [AppArea.Library]: [
    { id: AppWindowId.Documents, label: "Documents", hint: "09", icon: Files },
    { id: AppWindowId.Docs, label: "Docs", hint: "10", icon: BookOpen },
    { id: AppWindowId.ProjectBilling, label: "Billing", hint: "11", icon: CreditCard },
    { id: AppWindowId.ProjectSettings, label: "Settings", hint: "12", icon: Settings2 },
  ],
  [AppArea.Account]: [
    { id: AppWindowId.Billing, label: "Billing", hint: "", icon: CreditCard },
    { id: AppWindowId.Settings, label: "Settings", hint: "", icon: UserCircle },
  ],
}

// AI : legacy flat list — kept for validity helpers and deep links
export const BUILDER_NAV_ITEMS: AppNavItem[] = [
  { id: AppWindowId.Structure, label: "Structures", hint: "01", icon: Boxes },
  { id: AppWindowId.Pipeline, label: "Pipeline", hint: "02", icon: SpineNavIcon },
  { id: AppWindowId.Testing, label: "Testing", hint: "03", icon: SquareCheck },
  { id: AppWindowId.Inference, label: "Inference", hint: "04", icon: Play },
  { id: AppWindowId.Share, label: "Share", hint: "05", icon: SquareArrowUp },
  { id: AppWindowId.Earnings, label: "Earnings", hint: "06", icon: Wallet },
  { id: AppWindowId.Logging, label: "Logging", hint: "07", icon: ScrollText },
  { id: AppWindowId.Cache, label: "Cache", hint: "08", icon: Database },
  { id: AppWindowId.Documents, label: "Documents", hint: "09", icon: Files },
  { id: AppWindowId.Docs, label: "Docs", hint: "10", icon: BookOpen },
  { id: AppWindowId.ProjectBilling, label: "Billing", hint: "11", icon: CreditCard },
  { id: AppWindowId.ProjectSettings, label: "Settings", hint: "12", icon: Settings2 },
]

export const ACCOUNT_WINDOW_IDS = new Set<AppWindowId>([AppWindowId.Billing, AppWindowId.Settings])

// AI : workspace tabs include project-billing (11); account billing/settings are L0 only.
export const BUILDER_WORKSPACE_NAV_ITEMS: AppNavItem[] = BUILDER_NAV_ITEMS.filter(
  (item) => !ACCOUNT_WINDOW_IDS.has(item.id),
)

export function isAccountWindow(window: AppWindowId): boolean {
  return ACCOUNT_WINDOW_IDS.has(window)
}

export function isVibeWindow(window: AppWindowId): boolean {
  return window === AppWindowId.Vibe
}

// AI : L0 overlays that replace workspace tabs (account + non-technical vibe).
export function hidesWorkspaceNav(window: AppWindowId): boolean {
  return isAccountWindow(window) || isVibeWindow(window)
}

export const CONSUMER_NAV_ITEMS: AppNavItem[] = [
  { id: AppWindowId.Share, label: AppPrimarySectionTitle.Run, hint: "01", icon: Users },
]

export function windowToArea(window: AppWindowId, consumer = false): AppArea {
  if (consumer) {
    if (window === AppWindowId.Share) return AppArea.Run
    return AppArea.Account
  }
  switch (window) {
    case AppWindowId.Structure:
    case AppWindowId.Pipeline:
    case AppWindowId.Testing:
    case AppWindowId.Inference:
    case AppWindowId.Vibe:
      return AppArea.Build
    case AppWindowId.Share:
    case AppWindowId.Earnings:
      return AppArea.Deploy
    case AppWindowId.Logging:
    case AppWindowId.Cache:
      return AppArea.Observe
    case AppWindowId.Documents:
    case AppWindowId.Docs:
    case AppWindowId.ProjectBilling:
    case AppWindowId.ProjectSettings:
      return AppArea.Library
    default:
      return AppArea.Account
  }
}

export function isBuildStep(window: AppWindowId): window is BuildStepId {
  return BUILD_STEP_IDS.has(window as BuildStepId)
}

export function areaForWindow(
  window: AppWindowId,
  areas: AppAreaConfig[] = BUILDER_AREAS,
): AppAreaConfig | undefined {
  return areas.find((a) => a.windows.includes(window))
}

export function defaultWindowForArea(
  area: AppArea,
  areas: AppAreaConfig[] = BUILDER_AREAS,
): AppWindowId {
  return areas.find((a) => a.id === area)?.defaultWindow ?? AppWindowId.Structure
}

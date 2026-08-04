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
} from "lucide-react"
import { SpineNavIcon } from "@/components/spine-mark"
import type { AppWindowId } from "@/lib/app-shell"
import { ShareTabLabel } from "@/lib/window-panel-meta"

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

export enum BuildStepId {
  Structure = "structure",
  Pipeline = "pipeline",
  Testing = "testing",
  Inference = "inference",
}

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
    windows: [BuildStepId.Structure, BuildStepId.Pipeline, BuildStepId.Testing, BuildStepId.Inference],
    defaultWindow: BuildStepId.Structure,
  },
  {
    id: AppArea.Deploy,
    label: "Deploy",
    icon: Rocket,
    windows: ["share", "earnings"],
    defaultWindow: "share",
  },
  {
    id: AppArea.Observe,
    label: "Observe",
    icon: Eye,
    windows: ["logging", "cache"],
    defaultWindow: "logging",
  },
  {
    id: AppArea.Library,
    label: "Library",
    icon: Library,
    windows: ["documents", "docs"],
    defaultWindow: "documents",
  },
  {
    id: AppArea.Account,
    label: "Account",
    icon: UserCircle,
    windows: ["billing", "settings"],
    defaultWindow: "billing",
  },
]

export const CONSUMER_AREAS: AppAreaConfig[] = [
  {
    id: AppArea.Run,
    label: "Run",
    icon: Users,
    windows: ["share"],
    defaultWindow: "share",
  },
  {
    id: AppArea.Account,
    label: "Account",
    icon: UserCircle,
    windows: ["billing", "settings"],
    defaultWindow: "billing",
  },
]

export const AREA_SUB_NAV: Partial<Record<AppArea, AppNavItem[]>> = {
  [AppArea.Deploy]: [
    { id: "share", label: "Share", hint: "05", icon: SquareArrowUp },
    { id: "earnings", label: "Earnings", hint: "06", icon: Wallet },
  ],
  [AppArea.Observe]: [
    { id: "logging", label: "Logging", hint: "07", icon: ScrollText },
    { id: "cache", label: "Cache", hint: "08", icon: Database },
  ],
  [AppArea.Library]: [
    { id: "documents", label: "Documents", hint: "09", icon: Files },
    { id: "docs", label: "Docs", hint: "10", icon: BookOpen },
  ],
  [AppArea.Account]: [
    { id: "billing", label: "Billing", hint: "11", icon: CreditCard },
    { id: "settings", label: "Settings", hint: "", icon: UserCircle },
  ],
}

// AI : legacy flat list — kept for validity helpers and deep links
export const BUILDER_NAV_ITEMS: AppNavItem[] = [
  { id: "structure", label: "Structures", hint: "01", icon: Boxes },
  { id: "pipeline", label: "Pipeline", hint: "02", icon: SpineNavIcon },
  { id: "testing", label: "Testing", hint: "03", icon: SquareCheck },
  { id: "inference", label: "Inference", hint: "04", icon: Play },
  { id: "share", label: "Share", hint: "05", icon: SquareArrowUp },
  { id: "earnings", label: "Earnings", hint: "06", icon: Wallet },
  { id: "logging", label: "Logging", hint: "07", icon: ScrollText },
  { id: "cache", label: "Cache", hint: "08", icon: Database },
  { id: "documents", label: "Documents", hint: "09", icon: Files },
  { id: "docs", label: "Docs", hint: "10", icon: BookOpen },
  { id: "billing", label: "Billing", hint: "11", icon: CreditCard },
]

export const ACCOUNT_WINDOW_IDS = new Set<AppWindowId>(["billing", "settings"])

// AI : builder horizontal nav — billing lives in L0 primary nav only.
export const BUILDER_WORKSPACE_NAV_ITEMS: AppNavItem[] = BUILDER_NAV_ITEMS.filter(
  (item) => !ACCOUNT_WINDOW_IDS.has(item.id),
)

export function isAccountWindow(window: AppWindowId): boolean {
  return ACCOUNT_WINDOW_IDS.has(window)
}

export const CONSUMER_NAV_ITEMS: AppNavItem[] = [
  { id: "share", label: ShareTabLabel.SharedWithMe, hint: "01", icon: Users },
  { id: "billing", label: "Billing", hint: "02", icon: CreditCard },
]

export function windowToArea(window: AppWindowId, consumer = false): AppArea {
  if (consumer) {
    if (window === "share") return AppArea.Run
    return AppArea.Account
  }
  switch (window) {
    case BuildStepId.Structure:
    case BuildStepId.Pipeline:
    case BuildStepId.Testing:
    case BuildStepId.Inference:
      return AppArea.Build
    case "share":
    case "earnings":
      return AppArea.Deploy
    case "logging":
    case "cache":
      return AppArea.Observe
    case "documents":
    case "docs":
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
  return areas.find((a) => a.id === area)?.defaultWindow ?? BuildStepId.Structure
}

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
import { AppWindowStepLabel, windowStepHint } from "@/lib/window-panel-meta"
import {
  AppArea,
  BUILDER_AREA_DEFAULT,
  BUILDER_AREA_LABEL,
  BUILDER_AREA_WINDOWS,
  TUI_AREA_IDS,
  areaIdForWindow,
  type BuilderAreaId,
} from "@/lib/app-area-windows"

export { AppArea } from "@/lib/app-area-windows"
export type { BuilderAreaId } from "@/lib/app-area-windows"

// AI : marketing site lives on a separate deploy from the app
export const LANDING_PAGE_URL = "https://www.spine-ai.dev/"

type NavIcon = React.ComponentType<{ className?: string }>

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
  { id: BuildStepId.Structure, label: "Structure", hint: windowStepHint(AppWindowStepLabel.Structure), icon: Boxes },
  { id: BuildStepId.Pipeline, label: "Pipeline", hint: windowStepHint(AppWindowStepLabel.Pipeline), icon: SpineNavIcon },
  { id: BuildStepId.Testing, label: "Testing", hint: windowStepHint(AppWindowStepLabel.Testing), icon: SquareCheck },
  { id: BuildStepId.Inference, label: "Inference", hint: windowStepHint(AppWindowStepLabel.Inference), icon: Play },
]

export const BUILD_STEP_IDS = new Set<BuildStepId>(BUILD_STEPS.map((s) => s.id))

const BUILDER_AREA_ICONS: Record<BuilderAreaId, NavIcon> = {
  [AppArea.Build]: Hammer,
  [AppArea.Deploy]: Rocket,
  [AppArea.Observe]: Eye,
  [AppArea.Library]: Library,
  [AppArea.Account]: UserCircle,
}

export const BUILDER_AREAS: AppAreaConfig[] = TUI_AREA_IDS.map((id) => ({
  id,
  label: BUILDER_AREA_LABEL[id],
  icon: BUILDER_AREA_ICONS[id],
  windows: [...BUILDER_AREA_WINDOWS[id]],
  defaultWindow: BUILDER_AREA_DEFAULT[id],
}))

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
    { id: AppWindowId.Share, label: "Share", hint: windowStepHint(AppWindowStepLabel.Share), icon: SquareArrowUp },
    { id: AppWindowId.Earnings, label: "Earnings", hint: windowStepHint(AppWindowStepLabel.Earnings), icon: Wallet },
  ],
  [AppArea.Observe]: [
    { id: AppWindowId.Logging, label: "Logging", hint: windowStepHint(AppWindowStepLabel.Logging), icon: ScrollText },
    { id: AppWindowId.Cache, label: "Cache", hint: windowStepHint(AppWindowStepLabel.Cache), icon: Database },
  ],
  [AppArea.Library]: [
    { id: AppWindowId.Documents, label: "Documents", hint: windowStepHint(AppWindowStepLabel.Documents), icon: Files },
    { id: AppWindowId.Docs, label: "Docs", hint: windowStepHint(AppWindowStepLabel.Docs), icon: BookOpen },
    { id: AppWindowId.ProjectBilling, label: "Billing", hint: windowStepHint(AppWindowStepLabel.ProjectBilling), icon: CreditCard },
    { id: AppWindowId.ProjectSettings, label: "Settings", hint: windowStepHint(AppWindowStepLabel.ProjectSettings), icon: Settings2 },
  ],
  [AppArea.Account]: [
    { id: AppWindowId.Billing, label: "Billing", hint: windowStepHint(AppWindowStepLabel.Billing), icon: CreditCard },
    { id: AppWindowId.Settings, label: "Settings", hint: windowStepHint(AppWindowStepLabel.Settings), icon: UserCircle },
  ],
}

// AI : legacy flat list — kept for validity helpers and deep links
export const BUILDER_NAV_ITEMS: AppNavItem[] = [
  { id: AppWindowId.Structure, label: "Structures", hint: windowStepHint(AppWindowStepLabel.Structure), icon: Boxes },
  { id: AppWindowId.Pipeline, label: "Pipeline", hint: windowStepHint(AppWindowStepLabel.Pipeline), icon: SpineNavIcon },
  { id: AppWindowId.Testing, label: "Testing", hint: windowStepHint(AppWindowStepLabel.Testing), icon: SquareCheck },
  { id: AppWindowId.Inference, label: "Inference", hint: windowStepHint(AppWindowStepLabel.Inference), icon: Play },
  { id: AppWindowId.Share, label: "Share", hint: windowStepHint(AppWindowStepLabel.Share), icon: SquareArrowUp },
  { id: AppWindowId.Earnings, label: "Earnings", hint: windowStepHint(AppWindowStepLabel.Earnings), icon: Wallet },
  { id: AppWindowId.Logging, label: "Logging", hint: windowStepHint(AppWindowStepLabel.Logging), icon: ScrollText },
  { id: AppWindowId.Cache, label: "Cache", hint: windowStepHint(AppWindowStepLabel.Cache), icon: Database },
  { id: AppWindowId.Documents, label: "Documents", hint: windowStepHint(AppWindowStepLabel.Documents), icon: Files },
  { id: AppWindowId.Docs, label: "Docs", hint: windowStepHint(AppWindowStepLabel.Docs), icon: BookOpen },
  { id: AppWindowId.ProjectBilling, label: "Billing", hint: windowStepHint(AppWindowStepLabel.ProjectBilling), icon: CreditCard },
  { id: AppWindowId.ProjectSettings, label: "Settings", hint: windowStepHint(AppWindowStepLabel.ProjectSettings), icon: Settings2 },
]

export const ACCOUNT_WINDOW_IDS = new Set<AppWindowId>([AppWindowId.Billing, AppWindowId.Settings])

// AI : workspace tabs include project-billing (11); account billing/settings are L0 only.
export const BUILDER_WORKSPACE_NAV_ITEMS: AppNavItem[] = BUILDER_NAV_ITEMS.filter(
  (item) => !ACCOUNT_WINDOW_IDS.has(item.id),
)

export const BUILDER_WORKSPACE_WINDOW_IDS: AppWindowId[] = BUILDER_WORKSPACE_NAV_ITEMS.map((item) => item.id)

export const BUILDER_PANEL_IDS: AppWindowId[] = Object.values(AppWindowId)

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
  return areaIdForWindow(window) ?? AppArea.Account
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

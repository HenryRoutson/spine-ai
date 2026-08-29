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
  Clock,
  KeyRound,
} from "lucide-react"
import { SpineNavIcon } from "@/components/spine-mark"
import { AppWindowId } from "@/lib/app-window-id"
import { AppPrimarySectionTitle } from "@/lib/app-primary-section-labels"
import { AppWindowStepLabel, windowNavHint, windowStepHint } from "@/lib/window-panel-meta"
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
  Schedule: AppWindowId.Schedule,
  Backend: AppWindowId.Backend,
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
  { id: BuildStepId.Structure, label: "Structure", hint: windowNavHint(BuildStepId.Structure), icon: Boxes },
  { id: BuildStepId.Pipeline, label: "Pipeline", hint: windowNavHint(BuildStepId.Pipeline), icon: SpineNavIcon },
  { id: BuildStepId.Testing, label: "Testing", hint: windowNavHint(BuildStepId.Testing), icon: SquareCheck },
  { id: BuildStepId.Inference, label: "Inference", hint: windowNavHint(BuildStepId.Inference), icon: Play },
  { id: BuildStepId.Schedule, label: "Schedule", hint: windowNavHint(BuildStepId.Schedule), icon: Clock },
]

export const BUILD_STEP_IDS = new Set<BuildStepId>(BUILD_STEPS.map((s) => s.id))

// AI : Structures stay shared — selector is for every operate surface after that, including Vibe.
export const PIPELINE_FUNCTION_WINDOWS: AppWindowId[] = [
  AppWindowId.Pipeline,
  AppWindowId.Testing,
  AppWindowId.Inference,
  AppWindowId.Schedule,
  AppWindowId.Vibe,
  AppWindowId.Share,
]

export function showsPipelineFunctionSelect(window: AppWindowId): boolean {
  return PIPELINE_FUNCTION_WINDOWS.includes(window)
}

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
    { id: AppWindowId.Share, label: "Share", hint: windowNavHint(AppWindowId.Share), icon: SquareArrowUp },
    { id: AppWindowId.Earnings, label: "Earnings", hint: windowNavHint(AppWindowId.Earnings), icon: Wallet },
  ],
  [AppArea.Observe]: [
    { id: AppWindowId.Logging, label: "Logging", hint: windowNavHint(AppWindowId.Logging), icon: ScrollText },
    { id: AppWindowId.Cache, label: "Cache", hint: windowNavHint(AppWindowId.Cache), icon: Database },
  ],
  [AppArea.Library]: [
    { id: AppWindowId.Documents, label: "Documents", hint: windowNavHint(AppWindowId.Documents), icon: Files },
    { id: AppWindowId.Docs, label: "Docs", hint: windowNavHint(AppWindowId.Docs), icon: BookOpen },
    { id: AppWindowId.Secrets, label: "Secrets", hint: windowNavHint(AppWindowId.Secrets), icon: KeyRound },
    { id: AppWindowId.ProjectBilling, label: "Billing", hint: windowNavHint(AppWindowId.ProjectBilling), icon: CreditCard },
    { id: AppWindowId.ProjectSettings, label: "Settings", hint: windowNavHint(AppWindowId.ProjectSettings), icon: Settings2 },
  ],
  [AppArea.Account]: [
    { id: AppWindowId.Billing, label: "Billing", hint: windowNavHint(AppWindowId.Billing), icon: CreditCard },
    { id: AppWindowId.Settings, label: "Settings", hint: windowNavHint(AppWindowId.Settings), icon: UserCircle },
  ],
}

// AI : legacy flat list — kept for validity helpers and deep links
export const BUILDER_NAV_ITEMS: AppNavItem[] = [
  { id: AppWindowId.Structure, label: "Structures", hint: windowNavHint(AppWindowId.Structure), icon: Boxes },
  { id: AppWindowId.Pipeline, label: "Pipeline", hint: windowNavHint(AppWindowId.Pipeline), icon: SpineNavIcon },
  { id: AppWindowId.Testing, label: "Testing", hint: windowNavHint(AppWindowId.Testing), icon: SquareCheck },
  { id: AppWindowId.Inference, label: "Inference", hint: windowNavHint(AppWindowId.Inference), icon: Play },
  { id: AppWindowId.Schedule, label: "Schedule", hint: windowNavHint(AppWindowId.Schedule), icon: Clock },
  { id: AppWindowId.Share, label: "Share", hint: windowNavHint(AppWindowId.Share), icon: SquareArrowUp },
  { id: AppWindowId.Earnings, label: "Earnings", hint: windowNavHint(AppWindowId.Earnings), icon: Wallet },
  { id: AppWindowId.Logging, label: "Logging", hint: windowNavHint(AppWindowId.Logging), icon: ScrollText },
  { id: AppWindowId.Cache, label: "Cache", hint: windowNavHint(AppWindowId.Cache), icon: Database },
  { id: AppWindowId.Documents, label: "Documents", hint: windowNavHint(AppWindowId.Documents), icon: Files },
  { id: AppWindowId.Docs, label: "Docs", hint: windowNavHint(AppWindowId.Docs), icon: BookOpen },
  { id: AppWindowId.Secrets, label: "Secrets", hint: windowNavHint(AppWindowId.Secrets), icon: KeyRound },
  { id: AppWindowId.ProjectBilling, label: "Billing", hint: windowNavHint(AppWindowId.ProjectBilling), icon: CreditCard },
  { id: AppWindowId.ProjectSettings, label: "Settings", hint: windowNavHint(AppWindowId.ProjectSettings), icon: Settings2 },
]

export const ACCOUNT_WINDOW_IDS = new Set<AppWindowId>([AppWindowId.Billing, AppWindowId.Settings])

// AI : workspace tabs include project-billing; account billing/settings are L0 only.
export const BUILDER_WORKSPACE_NAV_ITEMS: AppNavItem[] = BUILDER_NAV_ITEMS.filter(
  (item) => !ACCOUNT_WINDOW_IDS.has(item.id),
)

export const BUILDER_WORKSPACE_WINDOW_IDS: AppWindowId[] = BUILDER_WORKSPACE_NAV_ITEMS.map((item) => item.id)

// AI : Simplified chrome — hide Testing and library/observe developer pages; keep build + run surfaces.
export const SIMPLIFIED_WORKSPACE_WINDOW_IDS: AppWindowId[] = [
  AppWindowId.Structure,
  AppWindowId.Pipeline,
  AppWindowId.Inference,
  AppWindowId.Schedule,
  AppWindowId.Share,
]

export const SIMPLIFIED_WORKSPACE_NAV_ITEMS: AppNavItem[] = BUILDER_WORKSPACE_NAV_ITEMS.filter((item) =>
  SIMPLIFIED_WORKSPACE_WINDOW_IDS.includes(item.id),
)

export function isSimplifiedHiddenWindow(window: AppWindowId): boolean {
  return BUILDER_WORKSPACE_WINDOW_IDS.includes(window) && !SIMPLIFIED_WORKSPACE_WINDOW_IDS.includes(window)
}

export function guiDefaultWorkspaceWindow(simplified: boolean, editingWebsite: boolean): AppWindowId {
  if (editingWebsite) return AppWindowId.Share
  return simplified ? AppWindowId.Inference : AppWindowId.Structure
}

export function guiWindowAfterSimplified(
  window: AppWindowId,
  simplified: boolean,
  editingWebsite: boolean,
): AppWindowId {
  // AI : Billing/Settings stay reachable from a website; everything else is the page studio.
  if (ACCOUNT_WINDOW_IDS.has(window)) return window
  // AI : A website is a Lovable frontend — never sit on Inference/Schedule/Pipeline while editing a site.
  if (editingWebsite) return AppWindowId.Share
  if (window === AppWindowId.Vibe) return guiDefaultWorkspaceWindow(true, false)
  if (simplified && isSimplifiedHiddenWindow(window)) return guiDefaultWorkspaceWindow(true, false)
  return window
}

export const BUILDER_PANEL_IDS: AppWindowId[] = Object.values(AppWindowId)

// AI : Vibe right pane — observe-only (run / share / logs); chat owns project edits.
export const VIBE_OBSERVE_WINDOW_IDS = [
  AppWindowId.Inference,
  AppWindowId.Schedule,
  AppWindowId.Share,
  AppWindowId.Logging,
] as const
export type VibeObserveTab = (typeof VIBE_OBSERVE_WINDOW_IDS)[number]

export function isVibeObserveTab(window: AppWindowId): window is VibeObserveTab {
  return (VIBE_OBSERVE_WINDOW_IDS as readonly AppWindowId[]).includes(window)
}

export const VIBE_OBSERVE_NAV_ITEMS: AppNavItem[] = BUILDER_NAV_ITEMS.filter((item) =>
  isVibeObserveTab(item.id),
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
  { id: AppWindowId.Share, label: AppPrimarySectionTitle.Run, hint: windowStepHint(AppWindowStepLabel.Run), icon: Users },
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

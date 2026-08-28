import { AppWindowId } from "@/lib/app-window-id"
import { AppPrimarySectionTitle } from "@/lib/app-primary-section-labels"

// AI : numbered workspace tabs — name is the key, number is the value. Insert a member to shift later tabs; do not assign values after Structure.
export enum AppWindowStep {
  Structure = 1,
  Pipeline,
  Testing,
  Inference,
  Schedule,
  Share,
  Earnings,
  Logging,
  Cache,
  Documents,
  Docs,
  Secrets,
  ProjectBilling,
  ProjectSettings,
}

type AppWindowStepKey = {
  [K in keyof typeof AppWindowStep]: (typeof AppWindowStep)[K] extends number ? K : never
}[keyof typeof AppWindowStep]

// AI : every numbered step must exist on AppWindowId (Vibe / Billing / Settings stay unnumbered).
const _stepKeysOnWindowId: { [K in AppWindowStepKey]: (typeof AppWindowId)[K] } = AppWindowId
void _stepKeysOnWindowId

export const APP_WINDOW_STEPS: AppWindowStep[] = (
  Object.values(AppWindowStep).filter((v): v is AppWindowStep => typeof v === "number")
).sort((a, b) => a - b)

// AI : one hotkey slot per numbered step (1–9, 0, then extras). Append a key when adding a tab past this list.
export const APP_WINDOW_STEP_HOTKEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "[", "]", "\\", "-"] as const

if (APP_WINDOW_STEP_HOTKEYS.length < APP_WINDOW_STEPS.length) {
  throw new Error("APP_WINDOW_STEP_HOTKEYS is shorter than AppWindowStep — append a key")
}

const STEP_BADGE_NAME: Partial<Record<AppWindowStep, string>> = {
  [AppWindowStep.ProjectBilling]: "Billing",
  [AppWindowStep.ProjectSettings]: "Settings",
}

export function padAppWindowStep(step: AppWindowStep): string {
  return String(step).padStart(2, "0")
}

export function appWindowStepBadgeName(step: AppWindowStep): string {
  return STEP_BADGE_NAME[step] ?? AppWindowStep[step]
}

export function formatAppWindowStepLabel(step: AppWindowStep): string {
  return `${padAppWindowStep(step)} / ${appWindowStepBadgeName(step)}`
}

export function appWindowIdForStep(step: AppWindowStep): AppWindowId {
  return AppWindowId[AppWindowStep[step] as AppWindowStepKey]
}

export function appWindowStepForId(id: AppWindowId): AppWindowStep | undefined {
  const key = (Object.keys(AppWindowId) as (keyof typeof AppWindowId)[]).find((k) => AppWindowId[k] === id)
  if (!key) return undefined
  const step = AppWindowStep[key as AppWindowStepKey]
  return typeof step === "number" ? step : undefined
}

export function hotkeyForAppWindowStep(step: AppWindowStep): string {
  const key = APP_WINDOW_STEP_HOTKEYS[step - 1]
  if (!key) throw new Error(`AppWindowStep ${step} has no hotkey — append APP_WINDOW_STEP_HOTKEYS`)
  return key
}

function numberedStepLabels(): Record<AppWindowStepKey, string> {
  return Object.fromEntries(
    APP_WINDOW_STEPS.map((step) => [AppWindowStep[step], formatAppWindowStepLabel(step)]),
  ) as Record<AppWindowStepKey, string>
}

// AI : GUI / TUI badge copy. Numbered values come from AppWindowStep — unnumbered overlays stay dotted.
export const AppWindowStepLabel = {
  ...numberedStepLabels(),
  Vibe: "· / Vibe",
  Backend: "· / Function",
  Billing: "· / Billing",
  Settings: "· / Settings",
  Run: `${padAppWindowStep(AppWindowStep.Structure)} / Run`,
  ProjectPicker: "Project",
  AbTest: `${padAppWindowStep(AppWindowStep.Testing)} / A/B Test`,
  LlmProviders: "Settings / LLM providers",
} as const

export type AppWindowStepLabel = (typeof AppWindowStepLabel)[keyof typeof AppWindowStepLabel]

export enum AppWindowTitle {
  Structure = "Structures",
  Pipeline = "Linear Pipeline",
  Testing = "Pipeline Tests",
  Inference = "Run Pipeline",
  Schedule = "Schedule",
  Share = "Share & Monetize",
  Logging = "Run History",
  Documents = "Document Store",
  Docs = "Documentation",
  Secrets = "Secrets",
  ProjectBilling = "Project spend",
  ProjectSettings = "Project settings",
  Vibe = "Vibe",
  Backend = "Functions (TUI)",
  Billing = "Account billing",
  Settings = "Settings",
  Earnings = "Earnings account",
  Cache = "Step cache",
}

export enum ShareTabLabel {
  MyPipelines = "My pipelines",
  SharedWithMe = "Shared with me",
  Marketplace = "Marketplace",
  Publish = "Publish",
  Activity = "Activity",
  ShareALink = "Share a link",
}

export enum ShareSection {
  MyPipelines = "my-pipelines",
  Publish = "publish",
  Shared = "shared",
  Marketplace = "marketplace",
  Activity = "activity",
}

export enum PublishTab {
  Link = "link",
  Api = "api",
  Embed = "embed",
  Site = "site",
  Marketplace = "marketplace",
}

export interface WindowHeaderCopy {
  step: AppWindowStepLabel
  title: string
  description: string
}

export const CONSUMER_RUN_PANEL_HEADER: WindowHeaderCopy = {
  step: AppWindowStepLabel.Run,
  title: AppPrimarySectionTitle.Run,
  description: "Run your own pipelines, open shared links, or browse the marketplace.",
}

export const PROJECT_PICKER_PANEL_HEADER: WindowHeaderCopy = {
  step: AppWindowStepLabel.ProjectPicker,
  title: "Choose a project",
  description: "Pick a pipeline to open, or create a new one below.",
}

export const AB_TEST_PANEL_HEADER: WindowHeaderCopy = {
  step: AppWindowStepLabel.AbTest,
  title: "Strategy Comparison",
  description: "Benchmark approaches on the same pipeline task. Pick the best accuracy/cost trade-off.",
}

export const LLM_PROVIDERS_PANEL_HEADER: WindowHeaderCopy = {
  step: AppWindowStepLabel.LlmProviders,
  title: "LLM providers",
  description: "TypeScript runtime for Spine inference — optional export snippets for other languages.",
}

const BUILDER_WINDOW_HEADERS: Record<AppWindowId, WindowHeaderCopy> = {
  structure: {
    step: AppWindowStepLabel.Structure,
    title: AppWindowTitle.Structure,
    description: "Shared types for this project — each structure is a SQL table. View SQL, stored rows, and which functions use the type.",
  },
  pipeline: {
    step: AppWindowStepLabel.Pipeline,
    title: AppWindowTitle.Pipeline,
    description: "Build the selected function. Every function in the project shares these structures; mismatched I/O is flagged on the step.",
  },
  testing: {
    step: AppWindowStepLabel.Testing,
    title: AppWindowTitle.Testing,
    description: "Pin exact per-step outputs in *_testing.json files, then run to pinpoint failures.",
  },
  inference: {
    step: AppWindowStepLabel.Inference,
    title: AppWindowTitle.Inference,
    description: "Save named input setups, then run the pipeline. Final output appears when the run finishes.",
  },
  schedule: {
    step: AppWindowStepLabel.Schedule,
    title: AppWindowTitle.Schedule,
    description: "Run this pipeline automatically — every few minutes, hourly, daily, or weekly.",
  },
  share: {
    step: AppWindowStepLabel.Share,
    title: AppWindowTitle.Share,
    description: "Publish run links, APIs, or marketplace copies — viewer billing uses the Billing tab.",
  },
  earnings: {
    step: AppWindowStepLabel.Earnings,
    title: AppWindowTitle.Earnings,
    description: "Markup from viewer-funded shared links and hosted APIs — separate from your LLM credit balance.",
  },
  logging: {
    step: AppWindowStepLabel.Logging,
    title: AppWindowTitle.Logging,
    description: "Every inference run is recorded with a full per-step trace, token counts, and cost.",
  },
  cache: {
    step: AppWindowStepLabel.Cache,
    title: AppWindowTitle.Cache,
    description: "Disk-cached pipeline steps — search entries and see reuse counts.",
  },
  documents: {
    step: AppWindowStepLabel.Documents,
    title: AppWindowTitle.Documents,
    description: "Content-addressed storage — upload, view, and fork-edit JSON as a new named file.",
  },
  docs: {
    step: AppWindowStepLabel.Docs,
    title: AppWindowTitle.Docs,
    description: "Project rules and context — prepended to every agent prompt to prevent regressions.",
  },
  secrets: {
    step: AppWindowStepLabel.Secrets,
    title: AppWindowTitle.Secrets,
    description:
      "Project secrets — set on this project (name-prefixed), link personal keys like files, or load from the team without seeing values.",
  },
  "project-billing": {
    step: AppWindowStepLabel.ProjectBilling,
    title: AppWindowTitle.ProjectBilling,
    description: "LLM spend for this pipeline only — credit balance and top-ups live in account Billing.",
  },
  "project-settings": {
    step: AppWindowStepLabel.ProjectSettings,
    title: AppWindowTitle.ProjectSettings,
    description: "Rename, review, or permanently delete this project.",
  },
  vibe: {
    step: AppWindowStepLabel.Vibe,
    title: AppWindowTitle.Vibe,
    description: "Talk to the agent to build the project — shared structures, functions, docs, and run. Pick which function to infer on the right.",
  },
  backend: {
    step: AppWindowStepLabel.Backend,
    title: AppWindowTitle.Backend,
    description:
      "TUI list of structures in this project. In the GUI, types, SQL, and rows live on Structures; functions live on Pipeline.",
  },
  billing: {
    step: AppWindowStepLabel.Billing,
    title: AppWindowTitle.Billing,
    description: "Credit balance, top-ups, and spend across all projects.",
  },
  settings: {
    step: AppWindowStepLabel.Settings,
    title: AppWindowTitle.Settings,
    description: "App preferences — stored locally in your browser.",
  },
}

export function windowPanelHeader(windowId: AppWindowId): WindowHeaderCopy {
  return BUILDER_WINDOW_HEADERS[windowId]
}

// AI : "07 / Logging" → "07". Dotted overlays (· / Vibe) return "".
export function windowStepHint(step: AppWindowStepLabel): string {
  const match = /^(\d{2})/.exec(step)
  return match?.[1] ?? ""
}

export function windowNavHint(id: AppWindowId): string {
  const step = appWindowStepForId(id)
  return step != null ? padAppWindowStep(step) : ""
}

export function windowStepHotkey(step: AppWindowStepLabel): string | null {
  const hint = windowStepHint(step)
  if (!hint) return null
  const n = Number(hint)
  if (!Number.isInteger(n) || n < 1) return null
  return APP_WINDOW_STEP_HOTKEYS[n - 1] ?? null
}

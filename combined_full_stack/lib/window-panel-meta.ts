import type { AppWindowId } from "@/lib/app-shell"
import { AppPrimarySectionTitle } from "@/lib/app-primary-section-labels"

// AI : canonical WindowHeader step badges — single source for panels + skeletons.
export enum AppWindowStepLabel {
  Structure = "01 / Structure",
  Pipeline = "02 / Pipeline",
  Testing = "03 / Testing",
  Inference = "04 / Inference",
  Share = "05 / Share",
  Logging = "06 / Logging",
  Documents = "08 / Documents",
  Docs = "· / Docs",
  Billing = "11 / Billing",
  Settings = "11 / Settings",
  Earnings = "Earnings",
  Cache = "cache",
  SharedWithMe = "Shared with me",
  ProjectPicker = "Project",
  AbTest = "03 / A/B Test",
  LlmProviders = "Settings / LLM providers",
}

export enum AppWindowTitle {
  Structure = "Structures",
  Pipeline = "Linear Pipeline",
  Testing = "Pipeline Tests",
  Inference = "Run Pipeline",
  Share = "Share & Monetize",
  Logging = "Run History",
  Documents = "Document Store",
  Docs = "Documentation",
  Billing = "LLM credit & spend",
  Settings = "Settings",
  Earnings = "Earnings account",
  Cache = "Step cache",
}

export enum ShareTabLabel {
  SharedWithMe = "Shared with me",
  Marketplace = "Marketplace",
  Publish = "Publish",
  Activity = "Activity",
}

export enum ShareSection {
  Publish = "publish",
  Shared = "shared",
  Marketplace = "marketplace",
  Activity = "activity",
}

export enum PublishTab {
  Link = "link",
  Api = "api",
  Marketplace = "marketplace",
}

export interface WindowHeaderCopy {
  step: AppWindowStepLabel
  title: string
  description: string
}

export const CONSUMER_RUN_PANEL_HEADER: WindowHeaderCopy = {
  step: AppWindowStepLabel.SharedWithMe,
  title: AppPrimarySectionTitle.Run,
  description: "Paste a link someone shared with you, browse the marketplace, or top up in Billing.",
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
    description: "Define the pydantic models your LLM must output to. Schema validation is implicit on every step's I/O.",
  },
  pipeline: {
    step: AppWindowStepLabel.Pipeline,
    title: AppWindowTitle.Pipeline,
    description: "Each step declares its input and output model. Mismatched I/O is flagged — there is no explicit validation step.",
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
    description: "Content-addressed storage for this pipeline — upload, share, and manage inference inputs.",
  },
  docs: {
    step: AppWindowStepLabel.Docs,
    title: AppWindowTitle.Docs,
    description: "Project rules and context — prepended to every agent prompt to prevent regressions.",
  },
  billing: {
    step: AppWindowStepLabel.Billing,
    title: AppWindowTitle.Billing,
    description: "Credit for pipeline runs — subscribe or top up here.",
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

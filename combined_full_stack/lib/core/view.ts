// AI : (snapshot) -> ViewModel — React and CLI render; they do not derive.

import { computeInvalid, invalidIssuesForModule } from "@/lib/validity"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { invalidStepMessage } from "@/lib/server/validity-messages"
import { withSharedModels } from "@/lib/structure"
import { quoteHref, type QuoteMatch } from "@/lib/quotes"
import { isTestingFileName, lastTestRunVerdictForDoc, testReportPassed } from "@/lib/testing-files"
import { derivePipelineMermaid } from "@/lib/pipeline-mermaid"
import { formatTypeExprPy } from "@/lib/type-expr-parse"
import { formatCostCents, formatMs } from "@/lib/format"
import { timeAgo } from "@/lib/time-ago"
import { runBilledCents, runSavedCents, runTotalMs } from "@/lib/run-metrics"
import { runHasErrors } from "@/lib/run-error-log"
import { formatRunErrorForDisplay } from "@/lib/run-errors"
import { orderedInputModules } from "@/lib/inference-input-core"
import { runInputDocsSummary } from "@/lib/inference-input-assignment"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"
import { RunStepStatus, type ModuleId } from "@/lib/types"
import type { SessionChatTurn, SessionSnapshot } from "@/lib/core/types"

export type PipelineStepView = {
  id: string
  label: string
  kind: string
  invalid: string[]
  selected: boolean
}

export type PipelineView = {
  title: string
  projectId: string
  steps: PipelineStepView[]
}

export type ValidationIssueView = {
  level: "error"
  where: string
  message: string
}

export type ValidationView = {
  ok: boolean
  issues: ValidationIssueView[]
}

export type QuoteView = {
  text: string
  docId: string
  start: number
  end: number
  href: string
  exact: boolean
  score: number
}

export function toPipelineView(snap: SessionSnapshot): PipelineView | null {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  if (!project) return null
  const invalid = computeInvalid(project.modules, project.models, { typeAliases: project.typeAliases ?? [] })
  const models = withSharedModels(project.models)
  return {
    title: project.name,
    projectId: project.id,
    steps: project.modules.map((m) => ({
      id: m.id,
      label: m.label,
      kind: m.kind,
      invalid: invalidIssuesForModule(invalid, m.id).map((issue) =>
        issue.kind === "structure-field"
          ? (issue.structureMessage ?? "structure field error")
          : invalidStepMessage(issue, models, project.modules),
      ),
      selected: false,
    })),
  }
}

export function toValidationView(snap: SessionSnapshot): ValidationView {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  if (!project) return { ok: true, issues: [] }
  const models = project.models
  const typeAliases = project.typeAliases ?? []
  const issues: ValidationIssueView[] = computeStructureIssues(models, typeAliases).map((issue) => ({
    level: "error",
    where: issue.modelId ?? "structure",
    message: structureIssueMessage(issue, models),
  }))
  const invalid = computeInvalid(project.modules, models, { typeAliases })
  const modelsForMessages = withSharedModels(models)
  for (const m of project.modules) {
    for (const issue of invalidIssuesForModule(invalid, m.id)) {
      issues.push({
        level: "error",
        where: m.label,
        message:
          issue.kind === "structure-field"
            ? (issue.structureMessage ?? "structure field error")
            : invalidStepMessage(issue, modelsForMessages, project.modules),
      })
    }
  }
  return { ok: issues.length === 0, issues }
}

export type StructureView = {
  models: { name: string; fields: string[] }[]
  aliases: string[]
}

export type InferenceSlotView = {
  moduleId: string
  moduleLabel: string
  docIds: string[]
  docNames: string[]
  ready: boolean
}

export type InferenceView = {
  assignments: InferenceSlotView[]
  ready: boolean
}

export type ShareView = {
  shareLinkIds: string[]
  hostedApiIds: string[]
}

export type AccountMoneyView = {
  balanceCents: number
  label: string
  totalBilledCents?: number
  totalUsageCents?: number
  totalEarnedCents?: number
  totalWithdrawnCents?: number
}

export type CacheView = {
  entries: { key: string; stepLabel?: string }[]
  count: number
}

export type SettingsView = {
  model: string
  saveError: string | null
  modelOptionCount: number
}

export type DocsView = {
  markdown: string
  preview: string
  docs: { name: string; type: string; label: string; sizeKb: number; preview?: string }[]
}

export type TestVerdict = "pass" | "fail" | "unrun"

export type TestingView = {
  tests: { name: string; label: string; verdict: TestVerdict }[]
}

export type AgentView = {
  turns: SessionChatTurn[]
  pendingChanged: string[]
  pendingName?: string
  lastMessage: string
  proposedActions: string[]
}

export type LogStepView = {
  label: string
  kind: string
  status: string
  ms: string
  cost: string
  preview: string
  error?: string
  cached: boolean
  llmCalls: number
}

export type LogRunView = {
  id: string
  status: string
  source: string
  notes?: string
  testDoc?: string
  testPassed?: boolean | null
  langfuse?: string
  steps: number
  duration: string
  cost: string
  saved: string
  ago: string
  model: string
  hasErrors: boolean
  inputLabel: string
  errorSummary?: string
  stepRows: LogStepView[]
}

export type LogsView = {
  runs: LogRunView[]
  errorCount: number
}

export type TuiTab =
  | "structure"
  | "pipeline"
  | "testing"
  | "inference"
  | "share"
  | "earnings"
  | "logging"
  | "cache"
  | "documents"
  | "docs"
  | "billing"
  | "settings"
  | "vibe"

export const TUI_TABS: TuiTab[] = [
  "structure",
  "pipeline",
  "testing",
  "inference",
  "share",
  "earnings",
  "logging",
  "cache",
  "documents",
  "docs",
  "billing",
  "settings",
  "vibe",
]

export const TUI_TAB_ALIASES: Record<string, TuiTab> = {
  build: "pipeline",
  agent: "vibe",
  tests: "testing",
  logs: "logging",
}

export type TuiArea = "build" | "deploy" | "observe" | "library" | "account" | "vibe"

export const TUI_AREAS: { id: TuiArea; label: string; tabs: TuiTab[] }[] = [
  { id: "build", label: "Build", tabs: ["structure", "pipeline", "testing", "inference"] },
  { id: "deploy", label: "Deploy", tabs: ["share", "earnings"] },
  { id: "observe", label: "Observe", tabs: ["logging", "cache"] },
  { id: "library", label: "Library", tabs: ["documents", "docs"] },
  { id: "account", label: "Account", tabs: ["billing", "settings"] },
  { id: "vibe", label: "Vibe", tabs: ["vibe"] },
]

// AI : number keys match the web UI 01–10 hints; b opens account billing.
export const TUI_TAB_HOTKEY: Record<TuiTab, string> = {
  structure: "1",
  pipeline: "2",
  testing: "3",
  inference: "4",
  share: "5",
  earnings: "6",
  logging: "7",
  cache: "8",
  documents: "9",
  docs: "0",
  billing: "b",
  settings: ",",
  vibe: "a",
}

export type TuiTabMeta = {
  title: string
  step: string
  description: string
  empty: string
}

// AI : usability annotations — same copy as the full UI window headers, plus empty-state next steps.
export const TUI_TAB_META: Record<TuiTab, TuiTabMeta> = {
  structure: {
    title: "Structures",
    step: "01 / Structure",
    description: "Define the pydantic models your LLM must output to. Schema validation is implicit on every step's I/O.",
    empty: "no models — press m to add one (fixes Input / Output)",
  },
  pipeline: {
    title: "Linear Pipeline",
    step: "02 / Pipeline",
    description: "Each step declares its input and output model. Mismatched I/O is flagged — there is no explicit validation step.",
    empty: "no project — press n to create one",
  },
  testing: {
    title: "Pipeline Tests",
    step: "03 / Testing",
    description: "Pin exact per-step outputs in *_testing.json files, then run to pinpoint failures.",
    empty: "no *_testing.json files — add one in Documents, then press t to run",
  },
  inference: {
    title: "Run Pipeline",
    step: "04 / Inference",
    description: "Save named input setups, then run the pipeline. Final output appears when the run finishes.",
    empty: "no documents assigned — add a file in Documents, then press i to run",
  },
  share: {
    title: "Share & Monetize",
    step: "05 / Share",
    description: "Publish run links, APIs, or marketplace copies — viewer billing uses the Billing tab.",
    empty: "no published links — create them in the web UI, then session pull",
  },
  earnings: {
    title: "Earnings account",
    step: "Earnings",
    description: "Markup from viewer-funded shared links and hosted APIs — separate from your LLM credit balance.",
    empty: "no account — session pull / SPINE_API_URL",
  },
  logging: {
    title: "Run History",
    step: "07 / Logging",
    description: "Every inference run is recorded with a full per-step trace, token counts, and cost.",
    empty: "no runs yet — press i to run inference, or t to run a test",
  },
  cache: {
    title: "Step cache",
    step: "cache",
    description: "Disk-cached pipeline steps — search entries and see reuse counts.",
    empty: "no cache entries — they appear after inference (session pull)",
  },
  documents: {
    title: "Document Store",
    step: "09 / Documents",
    description: "Content-addressed storage — upload, view, and fork-edit JSON as a new named file.",
    empty: "no documents — spine session add-doc, or import a seed",
  },
  docs: {
    title: "Documentation",
    step: "10 / Docs",
    description: "Project rules and context — prepended to every agent prompt to prevent regressions.",
    empty: "no markdown — press e to write project docs",
  },
  billing: {
    title: "Account billing",
    step: "· / Billing",
    description: "Credit balance, top-ups, and spend across all projects.",
    empty: "no account — session pull / SPINE_API_URL",
  },
  settings: {
    title: "Settings",
    step: "· / Settings",
    description: "App preferences — stored in this session (model, save status).",
    empty: "default model",
  },
  vibe: {
    title: "Vibe",
    step: "· / Vibe",
    description: "Talk to the agent to build the full project — structures, pipeline, docs, and run.",
    empty: "no chat yet — press a to ask vibe",
  },
}

export function areaForTuiTab(tab: TuiTab): TuiArea {
  return TUI_AREAS.find((a) => a.tabs.includes(tab))?.id ?? "build"
}

export function tabsInTuiArea(area: TuiArea): TuiTab[] {
  return TUI_AREAS.find((a) => a.id === area)?.tabs ?? []
}

export function resolveTuiTab(raw?: string): TuiTab {
  if (!raw) return "pipeline"
  const mapped = TUI_TAB_ALIASES[raw] ?? raw
  return (TUI_TABS as readonly string[]).includes(mapped) ? (mapped as TuiTab) : "pipeline"
}

export function tuiTabFromHotkey(input: string): TuiTab | undefined {
  const hit = (Object.entries(TUI_TAB_HOTKEY) as [TuiTab, string][]).find(([, key]) => key === input)
  return hit?.[0]
}

export function toDocsView(snap: SessionSnapshot): DocsView {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  const markdown = project?.documentation ?? ""
  return {
    markdown,
    preview: markdown.slice(0, 800),
    docs: snap.docs.map((d) => ({
      name: d.name,
      type: d.type,
      label: d.label,
      sizeKb: d.sizeKb,
      preview: d.preview,
    })),
  }
}

export function toTestingView(snap: SessionSnapshot): TestingView {
  return {
    tests: snap.docs
      .filter((d) => isTestingFileName(d.name))
      .map((d) => {
        const passed = lastTestRunVerdictForDoc(snap.runs, d.name)
        const verdict: TestVerdict = passed == null ? "unrun" : passed ? "pass" : "fail"
        return { name: d.name, label: d.label, verdict }
      }),
  }
}

export function toAgentView(snap: SessionSnapshot): AgentView {
  const pending = snap.pendingProposal
  const pendingChanged = pending
    ? (Object.entries(pending.changed) as [string, boolean | undefined][])
        .filter(([, v]) => v)
        .map(([k]) => k)
    : []
  const last = [...snap.chat].reverse().find((t) => t.role === "assistant")
  return {
    turns: snap.chat,
    pendingChanged,
    pendingName: pending?.projectName,
    lastMessage: last?.content ?? "",
    proposedActions: pending?.proposedActions?.map((a) => a.type) ?? [],
  }
}

export function toLogsView(snap: SessionSnapshot): LogsView {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  const runs = [...snap.runs].sort((a, b) => b.startedAt - a.startedAt).map((r) => {
    const err = formatRunErrorForDisplay(r)
    const saved = runSavedCents(r)
    return {
      id: r.id,
      status: r.status,
      source: String(r.source ?? ""),
      notes: r.notes,
      testDoc: r.test?.testDocName,
      testPassed: r.test ? testReportPassed(r.test, r) : null,
      langfuse: r.langfuseTraceUrl,
      steps: r.steps?.length ?? 0,
      duration: formatMs(runTotalMs(r)),
      cost: formatCostCents(runBilledCents(r)),
      saved: saved > 0 ? formatCostCents(saved) : "",
      ago: timeAgo(r.startedAt),
      model: String(r.model ?? ""),
      hasErrors: runHasErrors(r),
      inputLabel: project ? runInputDocsSummary(snap.docs, project, r) : (r.test?.testDocName ?? "—"),
      errorSummary: err ? `${err.title}: ${err.message}` : undefined,
      stepRows: (r.steps ?? []).map((s) => {
        const failed = s.status === RunStepStatus.Error
        const previewSrc = failed ? s.outputPreview : (s.outputJson ?? s.outputPreview)
        return {
          label: s.label,
          kind: String(s.kind),
          status: s.status,
          ms: formatMs(s.ms ?? 0),
          cost: formatCostCents(s.costCents ?? 0),
          preview: compactPreview(previewSrc || "", PREVIEW_STEP_IO_CHARS),
          error: failed ? compactPreview(s.outputPreview || "", 160) : undefined,
          cached: s.status === RunStepStatus.Cached,
          llmCalls: s.llmCalls?.length ?? 0,
        }
      }),
    }
  })
  return { runs, errorCount: runs.filter((r) => r.hasErrors).length }
}

export function toStructureView(snap: SessionSnapshot): StructureView {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  return {
    models: (project?.models ?? []).map((m) => ({
      name: m.name,
      fields: m.fields.map((f) => `${f.name}:${f.type}${f.optional ? "?" : ""}`),
    })),
    aliases: (project?.typeAliases ?? []).map((a) => `${a.name}=${formatTypeExprPy(a.expr, project?.models ?? [])}`),
  }
}

export function toInferenceView(snap: SessionSnapshot): InferenceView {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  const inputs = project ? orderedInputModules(project.modules) : []
  const slots: { id: string; label: string }[] = inputs.length
    ? inputs.map((m) => ({ id: m.id, label: m.label }))
    : Object.keys(snap.inferenceInputDocIds).map((moduleId) => ({ id: moduleId, label: moduleId }))
  const assignments = slots.map((mod) => {
    const raw = snap.inferenceInputDocIds[mod.id as ModuleId]
    const docIds = Array.isArray(raw) ? raw : raw ? [raw] : []
    const docNames = docIds.map((id) => snap.docs.find((d) => d.id === id)?.name ?? id)
    return {
      moduleId: mod.id,
      moduleLabel: mod.label,
      docIds,
      docNames,
      ready: docIds.length > 0,
    }
  })
  return { assignments, ready: assignments.length > 0 && assignments.every((a) => a.ready) }
}

export function toShareView(snap: SessionSnapshot): ShareView {
  return { shareLinkIds: snap.shareLinkIds, hostedApiIds: snap.hostedApiIds }
}

export function toBillingView(snap: SessionSnapshot): AccountMoneyView | null {
  if (!snap.billingAccount) return null
  return {
    balanceCents: snap.billingAccount.balanceCents,
    label: "billing",
    totalBilledCents: snap.billingAccount.totalBilledCents,
    totalUsageCents: snap.billingAccount.totalUsageCents,
  }
}

export function toEarningsView(snap: SessionSnapshot): AccountMoneyView | null {
  if (!snap.earningsAccount) return null
  return {
    balanceCents: snap.earningsAccount.balanceCents,
    label: "earnings",
    totalEarnedCents: snap.earningsAccount.totalEarnedCents,
    totalWithdrawnCents: snap.earningsAccount.totalWithdrawnCents,
  }
}

export function toCacheView(snap: SessionSnapshot): CacheView {
  return { entries: snap.cacheEntries, count: snap.cacheEntries.length }
}

export function toSettingsView(snap: SessionSnapshot): SettingsView {
  return {
    model: snap.model,
    saveError: snap.saveError,
    modelOptionCount: snap.modelOptions.length,
  }
}

export function toMermaidView(snap: SessionSnapshot): string {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  if (!project) return "flowchart LR\n  empty[No project]"
  return derivePipelineMermaid(project.modules, project.models)
}

export function toQuoteView(match: QuoteMatch): QuoteView {
  return {
    text: match.text,
    docId: match.docId,
    start: match.start,
    end: match.end,
    href: quoteHref(match),
    exact: match.exact,
    score: match.score,
  }
}

export function toSessionSummary(snap: SessionSnapshot): {
  projectCount: number
  activeProjectId: string
  activeName: string | null
  docCount: number
  runCount: number
  pendingCreates: number
  deletedProjectIds: string[]
  chatTurns: number
  hasPendingProposal: boolean
} {
  const active = snap.projects.find((p) => p.id === snap.activeProjectId)
  return {
    projectCount: snap.projects.length,
    activeProjectId: snap.activeProjectId,
    activeName: active?.name ?? null,
    docCount: snap.docs.length,
    runCount: snap.runs.length,
    pendingCreates: snap.pendingCreates.length,
    deletedProjectIds: snap.deletedProjectIds,
    chatTurns: snap.chat.length,
    hasPendingProposal: snap.pendingProposal != null,
  }
}

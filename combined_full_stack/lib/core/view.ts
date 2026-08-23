// AI : (snapshot) -> ViewModel — React and CLI render; they do not derive.
// AI : TODO (opt-browser-tui-snapshot) — optional GUI terminal mode renders these same to*View models;
// AI :   map useStore → SessionSnapshot (also arch-gui-viewmodels).

import { computeInvalid, invalidIssuesForModule } from "@/lib/validity"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { collectSqlIdTypes, fieldRelationLabel, fieldSqlIdType } from "@/lib/sql-id-types"
import { invalidStepMessage } from "@/lib/server/validity-messages"
import { withSharedModels, formatTypeExpr, stepSpineInType, stepSpineOutType } from "@/lib/structure"
import { quoteHref, type QuoteMatch } from "@/lib/quotes"
import { isTestingFileName, lastTestRunVerdictForDoc, testReportPassed } from "@/lib/testing-files"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { derivePipelineMermaid } from "@/lib/pipeline-mermaid"
import { formatTypeExprPy } from "@/lib/type-expr-parse"
import { formatParametricName } from "@/lib/type-params"
import { formatCostCents, formatMs } from "@/lib/format"
import { timeAgo } from "@/lib/time-ago"
import { runBilledCents, runSavedCents, runTotalMs } from "@/lib/run-metrics"
import { runHasErrors } from "@/lib/run-error-log"
import { formatRunErrorForDisplay } from "@/lib/run-errors"
import { inputMinCountForModule, orderedInputModules } from "@/lib/inference-input-core"
import { docMatchesInputModule } from "@/lib/inference-input-picker"
import { runInputDocsSummary } from "@/lib/inference-input-assignment"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"
import { DocLabel, RunStepStatus, type DocRef, type ModuleId, type PipelineModule, type StructureModel } from "@/lib/types"
import type { SessionChatTurn, SessionSnapshot } from "@/lib/core/types"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import { mergeDocsByName, overlayProposalOnProject } from "@/lib/project-proposal-overlay"
import { chatForActiveProject } from "@/lib/core/types"
import { AppWindowId } from "@/lib/app-window-id"
import {
  AppArea,
  BUILDER_AREA_LABEL,
  BUILDER_AREA_WINDOWS,
  TUI_AREA_IDS,
  areaIdForWindow,
  type BuilderAreaId,
} from "@/lib/app-area-windows"
import { windowPanelHeader, windowStepHotkey } from "@/lib/window-panel-meta"

export type PipelineStepView = {
  id: string
  label: string
  kind: string
  invalid: string[]
  selected: boolean
  parentForkId?: string
  indent?: number
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
  const invalid = computeInvalid(project.modules, project.models, {
    typeAliases: project.typeAliases ?? [],
    ...snapDocInvalidOpts(snap),
  })
  const models = withSharedModels(project.models)
  return {
    title: project.name,
    projectId: project.id,
    steps: pipelineStepViews(project.modules, invalid, models, project.modules),
  }
}

function pipelineStepViews(
  modules: PipelineModule[],
  invalid: ReturnType<typeof computeInvalid>,
  models: StructureModel[],
  root: PipelineModule[],
  parentForkId?: string,
  indent = 0,
): PipelineStepView[] {
  return modules.flatMap((m) => {
    const view: PipelineStepView = {
      id: m.id,
      label: m.label,
      kind: m.kind,
      invalid: invalidIssuesForModule(invalid, m.id).map((issue) =>
        issue.kind === "structure-field"
          ? (issue.structureMessage ?? "structure field error")
          : invalidStepMessage(issue, models, root),
      ),
      selected: false,
      parentForkId,
      indent,
    }
    if (m.kind !== "fork") return [view]
    return [
      view,
      ...((m.forkBranches ?? []).flatMap((b) =>
        pipelineStepViews(b.modules, invalid, models, root, m.id, indent + 1),
      )),
    ]
  })
}

function snapDocInvalidOpts(snap: SessionSnapshot) {
  const inferenceDocs = snap.docs
    .filter((d) => d.label === DocLabel.Inference)
    .map((d) => ({ name: d.name, type: d.type }))
  const assignedDocTypes: Partial<Record<ModuleId, string[]>> = {}
  for (const [id, raw] of Object.entries(snap.inferenceInputDocIds)) {
    const ids = (Array.isArray(raw) ? raw : [raw]).filter(Boolean)
    const types = ids.flatMap((docId) => {
      const t = snap.docs.find((d) => d.id === docId)?.type
      return t ? [t] : []
    })
    if (types.length) assignedDocTypes[id as ModuleId] = types
  }
  return { inferenceDocs, assignedDocTypes }
}

export function toValidationView(snap: SessionSnapshot): ValidationView {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  if (!project) return { ok: true, issues: [] }
  const viewed = overlayProposalOnProject(project, snap.pendingProposal)
  const models = viewed.models
  const typeAliases = viewed.typeAliases ?? []
  const issues: ValidationIssueView[] = computeStructureIssues(models, typeAliases).map((issue) => ({
    level: "error",
    where: issue.modelId ?? "structure",
    message: structureIssueMessage(issue, models),
  }))
  const invalid = computeInvalid(viewed.modules, models, { typeAliases, ...snapDocInvalidOpts(snap) })
  const modelsForMessages = withSharedModels(models)
  for (const m of flattenPipelineModules(viewed.modules)) {
    for (const issue of invalidIssuesForModule(invalid, m.id)) {
      issues.push({
        level: "error",
        where: m.label,
        message:
          issue.kind === "structure-field"
            ? (issue.structureMessage ?? "structure field error")
            : invalidStepMessage(issue, modelsForMessages, viewed.modules),
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

export type TuiTab = AppWindowId

export const TUI_TABS: TuiTab[] = Object.values(AppWindowId)

export const TUI_TAB_ALIASES: Record<string, TuiTab> = {
  build: AppWindowId.Pipeline,
  agent: AppWindowId.Vibe,
  tests: AppWindowId.Testing,
  logs: AppWindowId.Logging,
}

export type TuiArea = BuilderAreaId

export const TUI_AREAS: { id: TuiArea; label: string; tabs: TuiTab[] }[] = TUI_AREA_IDS.map((id) => ({
  id,
  label: BUILDER_AREA_LABEL[id],
  tabs: [...BUILDER_AREA_WINDOWS[id]],
}))

const TUI_TAB_HOTKEY_OVERRIDE: Partial<Record<TuiTab, string>> = {
  billing: "b",
  settings: ",",
  vibe: "a",
}

function tuiHotkey(tab: TuiTab): string {
  const override = TUI_TAB_HOTKEY_OVERRIDE[tab]
  if (override) return override
  const key = windowStepHotkey(windowPanelHeader(tab).step)
  if (!key) throw new Error(`TUI tab ${tab} has no digit hotkey — add TUI_TAB_HOTKEY_OVERRIDE`)
  return key
}

export const TUI_TAB_HOTKEY: Record<TuiTab, string> = Object.fromEntries(
  TUI_TABS.map((tab) => [tab, tuiHotkey(tab)]),
) as Record<TuiTab, string>

export type TuiTabMeta = {
  title: string
  step: string
  description: string
  empty: string
}

// AI : TUI-only empty states — title/step/description come from windowPanelHeader (GUI).
const TUI_TAB_EMPTY: Record<TuiTab, string> = {
  structure: "no models — press m to add one (fixes Input / Output)",
  pipeline: "no project — press n to create one",
  testing: "no *_testing.json files — add one in Documents, then press t to run",
  inference: "no documents assigned — add a file in Documents, then press i to run",
  share: "no published links — create them in the web UI, then session pull",
  earnings: "no account — session pull / SPINE_API_URL",
  logging: "no runs yet — press i to run inference, or t to run a test",
  cache: "no cache entries — they appear after inference (session pull)",
  documents: "no documents — spine session add-doc, or import a seed",
  docs: "no markdown — press e to write project docs",
  "project-billing": "no account — session pull / SPINE_API_URL",
  "project-settings": "no project — press n to create one",
  billing: "no account — session pull / SPINE_API_URL",
  settings: "default model",
  vibe: "no chat yet — press a to ask vibe",
}

const TUI_TAB_DESCRIPTION_OVERRIDE: Partial<Record<TuiTab, string>> = {
  settings: "App preferences — stored in this session (model, save status).",
}

export const TUI_TAB_META: Record<TuiTab, TuiTabMeta> = Object.fromEntries(
  TUI_TABS.map((tab) => {
    const header = windowPanelHeader(tab)
    return [
      tab,
      {
        title: header.title,
        step: header.step,
        description: TUI_TAB_DESCRIPTION_OVERRIDE[tab] ?? header.description,
        empty: TUI_TAB_EMPTY[tab],
      },
    ]
  }),
) as Record<TuiTab, TuiTabMeta>

export function areaForTuiTab(tab: TuiTab): TuiArea {
  return areaIdForWindow(tab) ?? AppArea.Build
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
  const turns = chatForActiveProject(snap)
  const last = [...turns].reverse().find((t) => t.role === "assistant")
  return {
    turns,
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
      name: formatParametricName(m.name, m.params),
      fields: m.fields.map((f) => `${f.name}:${f.type}${f.optional ? "?" : ""}`),
    })),
    aliases: (project?.typeAliases ?? []).map(
      (a) => `${formatParametricName(a.name, a.params)}=${formatTypeExprPy(a.expr, project?.models ?? [])}`,
    ),
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
    const input = inputs.find((m) => m.id === mod.id)
    const assigned = docIds
      .map((id) => snap.docs.find((d) => d.id === id))
      .filter((d): d is DocRef => Boolean(d))
    const typeOk = input ? assigned.every((d) => docMatchesInputModule(d, input)) : assigned.length > 0
    const countOk = input ? assigned.length >= inputMinCountForModule(input) : docIds.length > 0
    return {
      moduleId: mod.id,
      moduleLabel: mod.label,
      docIds,
      docNames,
      ready: typeOk && countOk,
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
    chatTurns: chatForActiveProject(snap).length,
    hasPendingProposal: snap.pendingProposal != null,
  }
}

export type McpModelReview = { name: string; fields: string[] }
export type McpStepReview = {
  id: string
  kind: string
  label: string
  inputType?: string | string[]
  structureIn?: string
  structureOut?: string
  n8nNodeType?: string
  branches?: { id: string; label: string; steps: McpStepReview[] }[]
}

function mcpFieldReview(model: StructureModel, field: StructureModel["fields"][number], models: StructureModel[]): string {
  const branded = fieldSqlIdType(model, field, models)
  const rel = field.relation ? fieldRelationLabel(field, models).replace(/\s+/g, "") : ""
  const opt = field.optional ? "?" : ""
  if (branded && rel) return `${field.name}:${branded}${opt}!${rel}`
  if (branded) return `${field.name}:${branded}${opt}`
  return `${field.name}:${field.type}${opt}`
}

function mcpModelReview(models: StructureModel[]): McpModelReview[] {
  return models.map((m) => ({
    name: m.name,
    fields: m.fields.map((f) => mcpFieldReview(m, f, models)),
  }))
}

function mcpStepReview(modules: PipelineModule[], models: StructureModel[]): McpStepReview[] {
  const named = withSharedModels(models)
  return modules.map((m) => {
    const structureIn = stepSpineInType(m)
    const structureOut = stepSpineOutType(m)
    const branches =
      m.kind === "fork"
        ? (m.forkBranches ?? []).map((b) => ({
            id: b.id,
            label: b.label,
            steps: mcpStepReview(b.modules, models),
          }))
        : undefined
    return {
      id: m.id,
      kind: m.kind,
      label: m.label,
      ...(m.inputType ? { inputType: m.inputType } : {}),
      ...(structureIn ? { structureIn: formatTypeExpr(structureIn, named) } : {}),
      ...(structureOut ? { structureOut: formatTypeExpr(structureOut, named) } : {}),
      ...(m.kind === "n8n" && m.n8nNodeType ? { n8nNodeType: m.n8nNodeType } : {}),
      ...(branches ? { branches } : {}),
    }
  })
}

export function compactProposalReview(proposal: ProjectProposal) {
  return {
    changed: (Object.entries(proposal.changed) as [string, boolean | undefined][])
      .filter(([, v]) => v)
      .map(([k]) => k),
    ...(proposal.projectName ? { projectName: proposal.projectName } : {}),
    models: proposal.models.map((m) => m.name),
    steps: proposal.modules.map((m) => ({ kind: m.kind, label: m.label })),
    docs: proposal.docs.map((d) => d.name),
  }
}

export function toMcpProjectReview(snap: SessionSnapshot) {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  if (!project) throw new Error("no active project — session add-project first")
  const pending = snap.pendingProposal
  const viewed = overlayProposalOnProject(project, pending)
  const snapForView: SessionSnapshot = {
    ...snap,
    projects: snap.projects.map((p) => (p.id === project.id ? viewed : p)),
  }
  const validation = toValidationView(snapForView)
  const pendingChanged = pending
    ? (Object.entries(pending.changed) as [string, boolean | undefined][])
        .filter(([, v]) => v)
        .map(([k]) => k)
    : []
  const pendingDocs = (pending?.docs ?? []).map((d) => ({ name: d.name, type: d.type, label: d.label }))
  return {
    ok: validation.ok,
    issues: validation.issues.map((i) => `${i.where}: ${i.message}`),
    pendingChanged,
    assistantInFlight: snap.assistantInFlight,
    pendingProposal: pending ? compactProposalReview(pending) : null,
    id: viewed.id,
    name: viewed.name,
    kind: viewed.kind,
    models: mcpModelReview(viewed.models),
    idTypes: collectSqlIdTypes(viewed.models).map((t) => ({
      name: t.name,
      pk: `${t.pkModelName}.${t.pkField}`,
      fkFields: t.fkFields.map((f) => `${f.modelName}.${f.field}`),
    })),
    steps: mcpStepReview(viewed.modules, viewed.models),
    docs: mergeDocsByName(
      snap.docs.map((d) => ({ name: d.name, type: d.type, label: d.label })),
      pendingDocs,
    ),
  }
}

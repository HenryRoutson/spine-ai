// AI : (snapshot) -> ViewModel — React and CLI render; they do not derive.

import { computeInvalid, invalidIssuesForModule } from "@/lib/validity"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { invalidStepMessage } from "@/lib/server/validity-messages"
import { withSharedModels } from "@/lib/structure"
import { quoteHref, type QuoteMatch } from "@/lib/quotes"
import { isTestingFileName } from "@/lib/testing-files"
import { derivePipelineMermaid } from "@/lib/pipeline-mermaid"
import { formatTypeExprPy } from "@/lib/type-expr-parse"
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

export type InferenceView = {
  assignments: { moduleId: string; docIds: string[] }[]
}

export type ShareView = {
  shareLinkIds: string[]
  hostedApiIds: string[]
}

export type AccountMoneyView = {
  balanceCents: number
  label: string
}

export type CacheView = {
  entries: { key: string; stepLabel?: string }[]
}

export type SettingsView = {
  model: string
  saveError: string | null
  modelOptionCount: number
}

export type DocsView = {
  markdown: string
  preview: string
  docs: { name: string; type: string; label: string; sizeKb: number }[]
}

export type TestingView = {
  tests: { name: string; label: string }[]
}

export type AgentView = {
  turns: SessionChatTurn[]
  pendingChanged: string[]
  pendingName?: string
  lastMessage: string
  proposedActions: string[]
}

export type LogsView = {
  runs: { id: string; status: string; source: string; notes?: string; testDoc?: string; langfuse?: string; steps: number }[]
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

export function resolveTuiTab(raw?: string): TuiTab {
  if (!raw) return "pipeline"
  const mapped = TUI_TAB_ALIASES[raw] ?? raw
  return (TUI_TABS as readonly string[]).includes(mapped) ? (mapped as TuiTab) : "pipeline"
}

export function toDocsView(snap: SessionSnapshot): DocsView {
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  const markdown = project?.documentation ?? ""
  return {
    markdown,
    preview: markdown.slice(0, 400),
    docs: snap.docs.map((d) => ({
      name: d.name,
      type: d.type,
      label: d.label,
      sizeKb: d.sizeKb,
    })),
  }
}

export function toTestingView(snap: SessionSnapshot): TestingView {
  return {
    tests: snap.docs
      .filter((d) => isTestingFileName(d.name))
      .map((d) => ({ name: d.name, label: d.label })),
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
  return {
    runs: snap.runs.map((r) => ({
      id: r.id,
      status: r.status,
      source: String(r.source ?? ""),
      notes: r.notes,
      testDoc: r.test?.testDocName,
      langfuse: r.langfuseTraceUrl,
      steps: r.steps?.length ?? 0,
    })),
  }
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
  return {
    assignments: Object.entries(snap.inferenceInputDocIds).map(([moduleId, ids]) => ({
      moduleId,
      docIds: Array.isArray(ids) ? ids : ids ? [ids] : [],
    })),
  }
}

export function toShareView(snap: SessionSnapshot): ShareView {
  return { shareLinkIds: snap.shareLinkIds, hostedApiIds: snap.hostedApiIds }
}

export function toBillingView(snap: SessionSnapshot): AccountMoneyView | null {
  if (!snap.billingAccount) return null
  return { balanceCents: snap.billingAccount.balanceCents, label: "billing" }
}

export function toEarningsView(snap: SessionSnapshot): AccountMoneyView | null {
  if (!snap.earningsAccount) return null
  return { balanceCents: snap.earningsAccount.balanceCents, label: "earnings" }
}

export function toCacheView(snap: SessionSnapshot): CacheView {
  return { entries: snap.cacheEntries }
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

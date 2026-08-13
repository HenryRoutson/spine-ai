// AI : (snapshot) -> ViewModel — React and CLI render; they do not derive.

import { computeInvalid, invalidIssuesForModule } from "@/lib/validity"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { invalidStepMessage } from "@/lib/server/validity-messages"
import { withSharedModels } from "@/lib/structure"
import { quoteHref, type QuoteMatch } from "@/lib/quotes"
import { isTestingFileName } from "@/lib/testing-files"
import { derivePipelineMermaid } from "@/lib/pipeline-mermaid"
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

export type DocsView = {
  markdown: string
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
  runs: { id: string; status: string; source: string }[]
}

export type TuiTab = "build" | "docs" | "tests" | "agent" | "logs"

// AI : TODO (cli-parity vs React tabs) — add structure, inference, share, earnings, cache,
// AI :   documents, billing, settings (and consumer Run). build ≈ projects+pipeline; agent ≈ Vibe;
// AI :   tests validate only; logs has no step traces / cache / billing charts.
export const TUI_TABS: TuiTab[] = ["build", "docs", "tests", "agent", "logs"]

export function toDocsView(snap: SessionSnapshot): DocsView {
  // AI : TODO (cli-parity vs Docs tab) — no markdown preview/split editor.
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  return {
    markdown: project?.documentation ?? "",
    docs: snap.docs.map((d) => ({
      name: d.name,
      type: d.type,
      label: d.label,
      sizeKb: d.sizeKb,
    })),
  }
}

// AI : TODO (cli-parity) — Testing tab also runs suites, diffs expected vs actual, LLM-judges probabilistic fields.
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

// AI : TODO (cli-parity) — Logging tab: per-step traces, cache hits, Langfuse links, test verdicts, run notes.
export function toLogsView(snap: SessionSnapshot): LogsView {
  return {
    runs: snap.runs.map((r) => ({
      id: r.id,
      status: r.status,
      source: String(r.source ?? ""),
    })),
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

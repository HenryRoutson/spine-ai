// AI : (snapshot) -> ViewModel — React and CLI render; they do not derive.

import { computeInvalid, invalidIssuesForModule } from "@/lib/validity"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { invalidStepMessage } from "@/lib/server/validity-messages"
import { withSharedModels } from "@/lib/structure"
import { quoteHref, type QuoteMatch } from "@/lib/quotes"
import type { SessionSnapshot } from "@/lib/core/types"

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
  }
}

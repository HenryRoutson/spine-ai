import type { Project } from "@/lib/types"
import type { ProjectProposal } from "@/lib/project-assistant-types"

export type ProposalChanged = ProjectProposal["changed"]

// AI : follow-up Vibe turns replace docs by name, not the whole catalog.
export function mergeDocsByName<T extends { name: string }>(prev: readonly T[], next: readonly T[]): T[] {
  const byName = new Map<string, T>()
  for (const d of prev) byName.set(d.name, d)
  for (const d of next) byName.set(d.name, d)
  return [...byName.values()]
}

export function overlayProposalOnProject(
  project: Project,
  proposal: ProjectProposal | null | undefined,
): Project {
  if (!proposal) return project
  return {
    ...project,
    ...(proposal.changed.name && proposal.projectName ? { name: proposal.projectName } : {}),
    ...(proposal.changed.models ? { models: proposal.models } : {}),
    ...(proposal.changed.modules ? { modules: proposal.modules } : {}),
    ...(proposal.changed.typeAliases ? { typeAliases: proposal.typeAliases } : {}),
    ...(proposal.changed.documentation ? { documentation: proposal.documentation } : {}),
  }
}

export function mergePendingProposals(
  prev: ProjectProposal | null | undefined,
  next: ProjectProposal,
): ProjectProposal {
  if (!prev) return next
  const changed: ProposalChanged = {
    modules: Boolean(prev.changed.modules || next.changed.modules),
    models: Boolean(prev.changed.models || next.changed.models),
    typeAliases: Boolean(prev.changed.typeAliases || next.changed.typeAliases),
    docs: Boolean(prev.changed.docs || next.changed.docs),
    documentation: Boolean(prev.changed.documentation || next.changed.documentation),
    name: Boolean(prev.changed.name || next.changed.name),
    actions: Boolean(prev.changed.actions || next.changed.actions),
  }
  return {
    modules: next.changed.modules ? next.modules : prev.modules,
    models: next.changed.models ? next.models : prev.models,
    typeAliases: next.changed.typeAliases ? next.typeAliases : prev.typeAliases,
    docs: next.changed.docs ? mergeDocsByName(prev.docs, next.docs) : prev.docs,
    documentation: next.changed.documentation ? next.documentation : prev.documentation,
    projectName: next.changed.name ? next.projectName : prev.projectName,
    proposedActions: next.changed.actions ? next.proposedActions : prev.proposedActions,
    reviewFrom: next.reviewFrom ?? prev.reviewFrom,
    changed,
  }
}

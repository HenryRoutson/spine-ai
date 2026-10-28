import type { ProjectProposal } from "@/lib/project-assistant-types"
import type { PipelineModule, StructureModel, TypeAlias } from "@/lib/types"

export type ProposalReviewFrom = NonNullable<ProjectProposal["reviewFrom"]>

export function withProposalReviewFrom(
  proposal: ProjectProposal,
  reviewFrom: ProposalReviewFrom,
): ProjectProposal {
  return {
    ...proposal,
    typeAliases: proposal.typeAliases ?? [],
    docs: proposal.docs ?? [],
    documentation: proposal.documentation ?? "",
    reviewFrom,
    changed: proposal.changed ?? {
      modules: true,
      models: true,
      typeAliases: (proposal.typeAliases?.length ?? 0) > 0,
      docs: (proposal.docs?.length ?? 0) > 0,
      documentation: false,
      name: !!proposal.projectName,
      actions: (proposal.proposedActions?.length ?? 0) > 0,
    },
    proposedActions: proposal.proposedActions,
  }
}

export function liveProposalReviewFrom(project: {
  models: StructureModel[]
  modules: PipelineModule[]
  typeAliases: TypeAlias[]
}): ProposalReviewFrom {
  return {
    models: project.models,
    modules: project.modules,
    typeAliases: project.typeAliases,
  }
}

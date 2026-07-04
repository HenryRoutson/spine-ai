// AI : client UI — structure/type-alias integrity gates pipeline editing and downstream tabs.
import {
  computeStructureIssues,
  structureIssueMessage,
  type StructureIssue,
} from "@/lib/structure-validity"
import type { StructureModel, TypeAlias } from "@/lib/types"

export function structureIssuesForUi(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): StructureIssue[] {
  return computeStructureIssues(models, typeAliases)
}

export function typesInvalidForUi(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): boolean {
  return structureIssuesForUi(models, typeAliases).length > 0
}

export function structureIssueMessagesForUi(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string[] {
  return structureIssuesForUi(models, typeAliases).map((issue) =>
    structureIssueMessage(issue, models),
  )
}

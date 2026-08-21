// AI : client UI validity — applies local Settings prefs (e.g. mandatory input descriptions).
import { readRequireInputDescriptions } from "@/lib/logging-settings"
import { computeInvalid, type ComputeInvalidOpts, type InvalidMap } from "@/lib/validity"
import { DocLabel, type DocId, type DocRef, type ModuleId, type PipelineModule, type StructureModel, type TypeAlias } from "@/lib/types"

export function invalidOptsForDocs(
  docs: DocRef[],
  assigned?: Partial<Record<ModuleId, DocId | DocId[]>>,
): Pick<ComputeInvalidOpts, "inferenceDocs" | "assignedDocTypes"> {
  const inferenceDocs = docs
    .filter((d) => d.label === DocLabel.Inference)
    .map((d) => ({ name: d.name, type: d.type }))
  const assignedDocTypes: NonNullable<ComputeInvalidOpts["assignedDocTypes"]> = {}
  if (assigned) {
    for (const [id, raw] of Object.entries(assigned)) {
      const ids = (Array.isArray(raw) ? raw : [raw]).filter(Boolean)
      const types = ids
        .map((docId) => docs.find((d) => d.id === docId)?.type)
        .filter((t): t is NonNullable<typeof t> => t != null)
      if (types.length) assignedDocTypes[id as ModuleId] = types as string[]
    }
  }
  return { inferenceDocs, assignedDocTypes }
}

export function computeInvalidForUi(
  modules: PipelineModule[],
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
  extra?: Pick<ComputeInvalidOpts, "inferenceDocs" | "assignedDocTypes">,
): InvalidMap {
  return computeInvalid(modules, models, {
    requireInputDescriptions: readRequireInputDescriptions(),
    typeAliases,
    ...extra,
  })
}

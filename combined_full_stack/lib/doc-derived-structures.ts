import type { DerivedDocStructure } from "@/lib/doc-structure-infer"
import type { DocId, ModelField, StructureModel, StructureModelId } from "@/lib/types"

function remapFields(fields: ModelField[], idMap: Map<StructureModelId, StructureModelId>): ModelField[] {
  return fields.map((f) => ({
    ...f,
    ref: f.ref ? idMap.get(f.ref) : undefined,
  }))
}

type CloneOpts = {
  sharedName?: string
  description?: string
}

export function cloneDerivedForProject(
  derived: DerivedDocStructure,
  idGen: () => StructureModelId,
  opts: CloneOpts = {},
): StructureModel[] {
  const all = [...derived.companionModels, derived.model]
  const idMap = new Map<StructureModelId, StructureModelId>(
    all.map((m) => [m.id, idGen()]),
  )
  return all.map((m) => {
    const isRoot = m.id === derived.model.id
    return {
      ...m,
      id: idMap.get(m.id)!,
      name: isRoot && opts.sharedName ? opts.sharedName : m.name,
      sourceDocId: undefined,
      auto: true,
      description: isRoot
        ? opts.description ?? m.description ?? "Inferred document shape."
        : m.description || "Inferred from document.",
      fields: remapFields(m.fields, idMap),
    }
  })
}

export function findExistingDerivedModel(
  models: StructureModel[],
  docId: DocId,
  name: string,
): StructureModel | undefined {
  return models.find((m) => m.sourceDocId === docId && m.name === name)
}

export function alreadyAdded(models: StructureModel[], docId: DocId, name: string): boolean {
  return findExistingDerivedModel(models, docId, name) !== undefined
}

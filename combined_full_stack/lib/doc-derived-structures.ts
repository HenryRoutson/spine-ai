import type { DerivedDocStructure } from "@/lib/doc-structure-infer"
import type { DocId, ModelField, StructureModel, StructureModelId } from "@/lib/types"

function remapFields(fields: ModelField[], idMap: Map<StructureModelId, StructureModelId>): ModelField[] {
  return fields.map((f) => ({
    ...f,
    ref: f.ref ? idMap.get(f.ref) : undefined,
  }))
}

export function cloneDerivedForProject(
  derived: DerivedDocStructure,
  docId: DocId,
  idGen: () => StructureModelId,
): StructureModel[] {
  const all = [...derived.companionModels, derived.model]
  const idMap = new Map<StructureModelId, StructureModelId>(
    all.map((m) => [m.id, idGen()]),
  )
  return all.map((m) => ({
    ...m,
    id: idMap.get(m.id)!,
    sourceDocId: docId,
    auto: true,
    description: m.description || "Inferred from document.",
    fields: remapFields(m.fields, idMap),
  }))
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

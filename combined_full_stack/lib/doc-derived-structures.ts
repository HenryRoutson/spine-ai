import type { DerivedDocStructure } from "@/lib/doc-structure-infer"
import type { DocId, StructureModel, StructureModelId } from "@/lib/types"

export function cloneDerivedForProject(
  derived: DerivedDocStructure,
  docId: DocId,
  idGen: () => StructureModelId,
): StructureModel {
  return {
    ...derived.model,
    id: idGen(),
    sourceDocId: docId,
    auto: true,
    description: derived.model.description || `Inferred from document.`,
  }
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

export function openOrAddDerivedStructure(
  derived: DerivedDocStructure,
  docId: DocId,
  models: StructureModel[],
  idGen: () => StructureModelId,
  setModels: (next: StructureModel[]) => void,
  openStructure: (modelId: StructureModelId) => void,
): void {
  const existing = findExistingDerivedModel(models, docId, derived.model.name)
  if (existing) {
    openStructure(existing.id)
    return
  }
  const next = cloneDerivedForProject(derived, docId, idGen)
  setModels([...models, next])
  openStructure(next.id)
}

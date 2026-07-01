import {
  alreadyAdded,
  cloneDerivedForProject,
} from "@/lib/doc-derived-structures"
import { inferStructuresFromDocContent } from "@/lib/doc-structure-infer"
import {
  dedupeInferredModelsByShape,
  findModelByBundleShape,
  nextSharedStructureName,
} from "@/lib/structure-shape"
import { repairOrphanModelRefs } from "@/lib/structure-ref"
import { tabularRowSetsFromContent } from "@/lib/tabular-row-sets"
import type { DocId, DocRef, StructureModel, StructureModelId } from "@/lib/types"

// AI : TODO bug — after manual structure edits, re-validate inferred models against stored doc text.
function shapeAlreadyPresent(
  models: StructureModel[],
  root: StructureModel,
  companions: StructureModel[],
): boolean {
  return findModelByBundleShape(models, root, companions) !== undefined
}

// AI : auto-add inferred structures — dedupe identical shapes as numbered Structure N models.
export function mergeInferredStructuresForDoc(
  models: StructureModel[],
  doc: Pick<DocRef, "id" | "name" | "type">,
  content: string,
  idGen: () => StructureModelId,
): StructureModel[] {
  const trimmed = content.trim()
  if (!trimmed) return models

  const rowSets = tabularRowSetsFromContent(trimmed, doc.name, doc.type)
  const derived = inferStructuresFromDocContent(trimmed, doc.name, doc.type, idGen, rowSets)
  if (!derived.length) return repairOrphanModelRefs(dedupeInferredModelsByShape(models), idGen)

  let next = models
  for (const d of derived) {
    if (alreadyAdded(next, doc.id as DocId, d.model.name)) continue
    if (shapeAlreadyPresent(next, d.model, d.companionModels)) continue

    const sharedName = nextSharedStructureName(next)
    const cloned = cloneDerivedForProject(d, idGen, {
      sharedName,
      description: "Inferred document shape.",
    })
    if (cloned.length) next = [...next, ...cloned]
  }
  return repairOrphanModelRefs(dedupeInferredModelsByShape(next), idGen)
}

export function modelsChanged(before: StructureModel[], after: StructureModel[]): boolean {
  // AI : TODO bug — ignores field renames/reorder; doc-shape drift can slip through without re-inference.
  if (before.length !== after.length) return true
  const beforeById = new Map(before.map((m) => [m.id, m]))
  return after.some((m) => {
    const prev = beforeById.get(m.id)
    if (!prev) return true
    if (prev.name !== m.name || prev.sourceDocId !== m.sourceDocId) return true
    return prev.fields.some((f, i) => {
      const next = m.fields[i]
      return !next || f.ref !== next.ref || f.type !== next.type
    })
  })
}

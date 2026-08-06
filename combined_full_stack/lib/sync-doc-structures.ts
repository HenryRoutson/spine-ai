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
import { fieldToTypeExpr } from "@/lib/server/type_expr"
import { stableJson } from "@/lib/run-fingerprint"
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
  if (before.length !== after.length) return true
  const beforeById = new Map(before.map((m) => [m.id, m]))
  return after.some((m) => {
    const prev = beforeById.get(m.id)
    if (!prev) return true
    if (prev.name !== m.name || prev.sourceDocId !== m.sourceDocId) return true
    if (prev.fields.length !== m.fields.length) return true
    const prevByFieldId = new Map(prev.fields.map((f) => [f.id, f]))
    return m.fields.some((f) => {
      const old = prevByFieldId.get(f.id)
      if (!old) return true
      return (
        old.name !== f.name ||
        old.type !== f.type ||
        old.ref !== f.ref ||
        old.optional !== f.optional ||
        old.minItems !== f.minItems ||
        old.maxItems !== f.maxItems ||
        old.minLength !== f.minLength ||
        old.maxLength !== f.maxLength ||
        stableJson(fieldToTypeExpr(old)) !== stableJson(fieldToTypeExpr(f))
      )
    })
  })
}

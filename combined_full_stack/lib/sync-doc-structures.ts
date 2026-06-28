import {
  alreadyAdded,
  cloneDerivedForProject,
} from "@/lib/doc-derived-structures"
import { inferStructuresFromDocContent } from "@/lib/doc-structure-infer"
import { tabularRowSetsFromContent } from "@/lib/tabular-row-sets"
import type { DocId, DocRef, StructureModel, StructureModelId } from "@/lib/types"

function modelFieldSignature(m: StructureModel): string {
  return m.fields
    .map((f) => `${f.name}:${f.type}${f.ref ? `@${f.ref}` : ""}`)
    .sort()
    .join("|")
}

function hasGlobalDuplicate(models: StructureModel[], candidate: StructureModel): boolean {
  const sig = modelFieldSignature(candidate)
  return models.some((m) => m.name === candidate.name && modelFieldSignature(m) === sig)
}

// AI : auto-add inferred structures from stored doc text — dedupe by doc+name and identical global name+fields.
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
  if (!derived.length) return models

  let next = models
  for (const d of derived) {
    if (alreadyAdded(next, doc.id as DocId, d.model.name)) continue

    const cloned = cloneDerivedForProject(d, doc.id as DocId, idGen)
    const toAdd = cloned.filter((m) => {
      if (next.some((x) => x.sourceDocId === doc.id && x.name === m.name)) return false
      if (hasGlobalDuplicate(next, m)) return false
      return true
    })
    if (toAdd.length) next = [...next, ...toAdd]
  }
  return next
}

export function modelsChanged(before: StructureModel[], after: StructureModel[]): boolean {
  if (before.length !== after.length) return true
  const beforeIds = new Set(before.map((m) => m.id))
  return after.some((m) => !beforeIds.has(m.id))
}

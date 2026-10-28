import { inferStructuresFromDocContent, isInferrableDocContent } from "@/lib/doc-structure-infer"
import { tryParseJson } from "@/lib/json-utils"
import { findMatchingStructures, type StructureMatch } from "@/lib/structure-match"
import { findModelByBundleShape } from "@/lib/structure-shape"
import { tabularRowSetsFromContent } from "@/lib/tabular-row-sets"
import type { DocRef, StructureModel, StructureModelId, TypeAlias } from "@/lib/types"

export function parseAndMatchStructures(
  json: string,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): { matches: StructureMatch[]; error: string | null } {
  if (!models.length) return { matches: [], error: null }
  const parsed = tryParseJson(json)
  if (!parsed.ok) return { matches: [], error: parsed.error.message }
  return { matches: findMatchingStructures(parsed.value, models, typeAliases), error: null }
}

function dedupeMatches(matches: StructureMatch[]): StructureMatch[] {
  const seen = new Set<string>()
  return matches.filter((m) => {
    const key = `${m.modelId}:${m.matchKind}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortMatches(matches: StructureMatch[]): StructureMatch[] {
  return [...matches].sort(
    (a, b) => b.fieldCount - a.fieldCount || a.modelName.localeCompare(b.modelName),
  )
}

// AI : full-doc validate + derived samples + sourceDocId models — auto-sync should always surface a match.
export function findStructureMatchesForDoc(
  json: string,
  models: StructureModel[],
  doc?: Pick<DocRef, "id" | "name" | "type">,
  typeAliases: TypeAlias[] = [],
): { matches: StructureMatch[]; error: string | null; expectMatches: boolean } {
  if (!models.length) return { matches: [], error: null, expectMatches: false }

  const parsed = tryParseJson(json.trim())
  if (!parsed.ok) return { matches: [], error: parsed.error.message, expectMatches: false }

  const expectMatches = doc ? isInferrableDocContent(json, doc.name, doc.type) : false
  let matches = findMatchingStructures(parsed.value, models, typeAliases)

  if (!doc) {
    return { matches, error: null, expectMatches: false }
  }

  const rowSets = tabularRowSetsFromContent(json, doc.name, doc.type)
  const derived = inferStructuresFromDocContent(
    json,
    doc.name,
    doc.type,
    () => "match_probe" as StructureModelId,
    rowSets,
  )

  for (const d of derived) {
    matches = [...matches, ...findMatchingStructures(d.sample, models, typeAliases)]
  }

  for (const d of derived) {
    const existing = findModelByBundleShape(models, d.model, d.companionModels)
    if (existing) {
      const kind = d.matchKind
      matches.push({
        modelId: existing.id,
        modelName: existing.name,
        fieldCount: existing.fields.length,
        matchKind: kind,
      })
    }
  }

  for (const m of models.filter((x) => x.sourceDocId === doc.id)) {
    const validated = findMatchingStructures(parsed.value, models, typeAliases).find((match) => match.modelId === m.id);
    if (validated) matches.push(validated);
  }

  return {
    matches: sortMatches(dedupeMatches(matches)),
    error: null,
    expectMatches,
  }
}

export function firstMatchingModelName(
  content: string,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string {
  const { matches } = parseAndMatchStructures(content, models, typeAliases)
  return matches[0]?.modelName ?? "general"
}

export { isInferrableDocContent }

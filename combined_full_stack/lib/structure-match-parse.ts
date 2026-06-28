import { tryParseJson } from "@/lib/json-utils"
import { findMatchingStructures, type StructureMatch } from "@/lib/structure-match"
import type { StructureModel } from "@/lib/types"

export function parseAndMatchStructures(
  json: string,
  models: StructureModel[],
): { matches: StructureMatch[]; error: string | null } {
  if (!models.length) return { matches: [], error: null }
  const parsed = tryParseJson(json)
  if (!parsed.ok) return { matches: [], error: parsed.error.message }
  return { matches: findMatchingStructures(parsed.value, models), error: null }
}

export function firstMatchingModelName(content: string, models: StructureModel[]): string {
  const { matches } = parseAndMatchStructures(content, models)
  return matches[0]?.modelName ?? "general"
}

import { validate } from "@/lib/structure"
import type { StructureModel, StructureModelId, TypeAlias } from "@/lib/types"

export type StructureMatchKind = "object" | "list"

export type StructureMatch = {
  modelId: StructureModelId
  modelName: string
  fieldCount: number
  matchKind: StructureMatchKind
}

// AI : try every declared model — bare arrays match when every row validates (llm-batch output).
export function findMatchingStructures(
  value: unknown,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): StructureMatch[] {
  const matches: StructureMatch[] = []

  for (const model of models) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      const allOk = value.every((row) => validate(row, model, models, typeAliases).ok)
      if (allOk) {
        matches.push({
          modelId: model.id,
          modelName: model.name,
          fieldCount: model.fields.length,
          matchKind: "list",
        })
      }
      continue
    }

    if (validate(value, model, models, typeAliases).ok) {
      matches.push({
        modelId: model.id,
        modelName: model.name,
        fieldCount: model.fields.length,
        matchKind: "object",
      })
    }
  }

  return matches.sort((a, b) => b.fieldCount - a.fieldCount || a.modelName.localeCompare(b.modelName))
}

// AI : client UI validity — applies local Settings prefs (e.g. mandatory input descriptions).
import { readRequireInputDescriptions } from "@/lib/logging-settings"
import { computeInvalid, type InvalidMap } from "@/lib/validity"
import type { PipelineModule, StructureModel } from "@/lib/types"

export function computeInvalidForUi(
  modules: PipelineModule[],
  models: StructureModel[] = [],
): InvalidMap {
  return computeInvalid(modules, models, { requireInputDescriptions: readRequireInputDescriptions() })
}

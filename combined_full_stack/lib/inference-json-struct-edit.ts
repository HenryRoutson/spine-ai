// AI : inference JSON inputs with a typed structureOut — guided form schema (not Document).

import { z } from "zod"
import { isBuiltinDocumentModel } from "@/lib/server/builtin_models"
import { zodFromModel } from "@/lib/server/structure"
import { stepEmitsList } from "@/lib/server/type_expr"
import { inputTypesForModule } from "@/lib/inference-input-core"
import { InputType, type PipelineModule, type StructureModel, type TypeAlias } from "@/lib/types"

export type InferenceJsonStructSchema = {
  schema: Record<string, unknown>
  modelName: string
}

export function inputModuleJsonStructSchema(
  inputModule: PipelineModule,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): InferenceJsonStructSchema | null {
  if (inputModule.kind !== "input") return null
  if (!inputTypesForModule(inputModule).includes(InputType.Json)) return null
  const outId = inputModule.outStructureId
  if (!outId) return null
  const model = models.find((m) => m.id === outId)
  if (!model || isBuiltinDocumentModel(model)) return null
  let schemaZod = zodFromModel(model, models, typeAliases)
  // AI : list forms start with one empty item so the visitor sees fields immediately.
  if (stepEmitsList(inputModule)) schemaZod = z.array(schemaZod).min(1)
  return {
    schema: z.toJSONSchema(schemaZod) as Record<string, unknown>,
    modelName: model.name,
  }
}

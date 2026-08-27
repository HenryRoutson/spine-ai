// AI : feed a typed database row into a pipeline input when TypeExpr matches.
import { inputTypesForModule } from "@/lib/inference-input-core"
import { JSON_NATIVE_INPUT_TYPES } from "@/lib/inference-input-core"
import {
  findPortConnections,
  portCompatStatus,
  structureTypeExprForModel,
  type port_compat_status,
} from "@/lib/platform-type-ports"
import { ModuleKind, InputType, type ModuleId, type PipelineModule, type StructureModel, type TypeAlias } from "@/lib/types"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { TypeExprKind, stepSpineOutType } from "@/lib/server/type_expr"
import type { structure_row } from "@/lib/platform-row-store"

export type feedable_input = {
  moduleId: ModuleId
  label: string
  status: port_compat_status
  inputType: InputType
}

export function feedableInputsForModel(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[],
  modelId: StructureModel["id"],
): feedable_input[] {
  const model = models.find((m) => m.id === modelId)
  if (!model) return []
  const source = structureTypeExprForModel(model.id, false)
  const out: feedable_input[] = []
  for (const m of flattenPipelineModules(modules)) {
    if (m.kind !== ModuleKind.Input) continue
    const types = inputTypesForModule(m)
    const jsonNative = types.some((t) => (JSON_NATIVE_INPUT_TYPES as readonly InputType[]).includes(t))
    if (!jsonNative && !types.includes(InputType.Text)) continue
    const target = m.outStructureId
      ? structureTypeExprForModel(m.outStructureId, false)
      : undefined
    const status = portCompatStatus(source, target, models, typeAliases)
    if (status === "incompatible") continue
    out.push({
      moduleId: m.id,
      label: m.label,
      status,
      inputType: jsonNative ? InputType.Json : InputType.Text,
    })
  }
  return out
}

export function feedFileName(modelName: string, rowId: string): string {
  const slug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "row"
  return `${slug}_${rowId.slice(0, 8)}.json`
}

export function feedRowJson(row: structure_row, module?: PipelineModule): string {
  // AI : list-typed inputs ingest a JSON array — wrap the single row so Feed still type-checks.
  const outType = module ? stepSpineOutType(module) : undefined
  const data = outType?.kind === TypeExprKind.List ? [row.data] : row.data
  return `${JSON.stringify(data, null, 2)}\n`
}

export function connectionsForModel(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[],
  modelId: StructureModel["id"],
) {
  return findPortConnections(modules, models, typeAliases).filter((c) => c.structureId === modelId)
}

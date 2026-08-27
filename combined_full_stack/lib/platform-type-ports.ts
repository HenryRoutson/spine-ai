// AI : typed port compatibility — structures ↔ pipeline inputs/outputs.
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { typeExprAssignable } from "@/lib/assemble-type-expr"
import {
  fieldToTypeExpr,
  formatTypeExpr,
  modelName,
  stepSpineInType,
  stepSpineOutType,
  typeExprEqual,
  typeExprItemRef,
  TypeExprKind,
  type TypeExpr,
} from "@/lib/server/type_expr"
import {
  ModuleKind,
  type ModuleId,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
  type TypeAlias,
} from "@/lib/types"

export type port_direction = "in" | "out"

export type port_compat_status = "exact" | "assignable" | "incompatible" | "untyped"

export type pipeline_port = {
  moduleId: ModuleId
  label: string
  direction: port_direction
  typeExpr: TypeExpr | undefined
  typeLabel: string
  structureId: StructureModelId | undefined
  kind: PipelineModule["kind"]
}

export type structure_port = {
  modelId: StructureModelId
  name: string
  typeExpr: TypeExpr
  typeLabel: string
}

export type port_connection = {
  structureId: StructureModelId
  structureName: string
  pipelineModuleId: ModuleId
  pipelineLabel: string
  direction: port_direction
  status: port_compat_status
}

export function structureTypeExprForModel(
  modelId: StructureModelId,
  list: boolean,
): TypeExpr {
  const ref: TypeExpr = { kind: TypeExprKind.Ref, modelId }
  return list ? { kind: TypeExprKind.List, item: ref } : ref
}

export function structurePorts(
  models: StructureModel[],
  _typeAliases: TypeAlias[],
): structure_port[] {
  return models
    .filter((m) => !m.auto)
    .map((m) => {
      const typeExpr = structureTypeExprForModel(m.id, false)
      return {
        modelId: m.id,
        name: m.name,
        typeExpr,
        typeLabel: formatTypeExpr(typeExpr, models),
      }
    })
}

export function pipelinePorts(
  modules: PipelineModule[],
  models: StructureModel[],
  _typeAliases: TypeAlias[],
): pipeline_port[] {
  const ports: pipeline_port[] = []
  for (const m of flattenPipelineModules(modules)) {
    if (m.kind === ModuleKind.Input) {
      const typeExpr = stepSpineOutType(m) ?? (m.outStructureId ? structureTypeExprForModel(m.outStructureId, false) : undefined)
      ports.push({
        moduleId: m.id,
        label: m.label,
        direction: "in",
        typeExpr,
        typeLabel: typeExpr ? formatTypeExpr(typeExpr, models) : "untyped",
        structureId: typeExpr ? typeExprItemRef(typeExpr) ?? m.outStructureId : m.outStructureId,
        kind: m.kind,
      })
    }
    if (m.kind === ModuleKind.Output || m.kind === ModuleKind.Llm || m.kind === ModuleKind.Transform) {
      const typeExpr = stepSpineOutType(m)
      if (typeExpr) {
        ports.push({
          moduleId: m.id,
          label: m.label,
          direction: "out",
          typeExpr,
          typeLabel: formatTypeExpr(typeExpr, models),
          structureId: typeExprItemRef(typeExpr) ?? m.outStructureId,
          kind: m.kind,
        })
      }
    }
    const inType = stepSpineInType(m)
    if (inType && m.kind !== ModuleKind.Input) {
      ports.push({
        moduleId: m.id,
        label: `${m.label} (in)`,
        direction: "in",
        typeExpr: inType,
        typeLabel: formatTypeExpr(inType, models),
        structureId: typeExprItemRef(inType) ?? m.inStructureId,
        kind: m.kind,
      })
    }
  }
  return ports
}

export function portCompatStatus(
  source: TypeExpr | undefined,
  target: TypeExpr | undefined,
  models: StructureModel[],
  typeAliases: TypeAlias[],
): port_compat_status {
  if (!source || !target) return "untyped"
  if (typeExprEqual(source, target)) return "exact"
  if (typeExprAssignable(target, source, typeAliases, models)) return "assignable"
  return "incompatible"
}

export function findPortConnections(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[],
): port_connection[] {
  const structures = structurePorts(models, typeAliases)
  const pipelines = pipelinePorts(modules, models, typeAliases)
  const connections: port_connection[] = []

  for (const pipe of pipelines) {
    if (pipe.direction !== "in" || !pipe.typeExpr) continue
    for (const struct of structures) {
      const status = portCompatStatus(struct.typeExpr, pipe.typeExpr, models, typeAliases)
      if (status === "incompatible") continue
      connections.push({
        structureId: struct.modelId,
        structureName: struct.name,
        pipelineModuleId: pipe.moduleId,
        pipelineLabel: pipe.label,
        direction: "in",
        status,
      })
    }
  }

  for (const pipe of pipelines) {
    if (pipe.direction !== "out" || !pipe.typeExpr) continue
    for (const struct of structures) {
      const status = portCompatStatus(pipe.typeExpr, struct.typeExpr, models, typeAliases)
      if (status === "incompatible") continue
      connections.push({
        structureId: struct.modelId,
        structureName: struct.name,
        pipelineModuleId: pipe.moduleId,
        pipelineLabel: pipe.label,
        direction: "out",
        status,
      })
    }
  }

  return connections
}

export function compatStatusLabel(status: port_compat_status): string {
  switch (status) {
    case "exact":
      return "Exact match"
    case "assignable":
      return "Compatible"
    case "incompatible":
      return "Incompatible"
    case "untyped":
      return "Untyped"
  }
}

export function compatStatusColor(status: port_compat_status): string {
  switch (status) {
    case "exact":
      return "text-emerald-600"
    case "assignable":
      return "text-blue-600"
    case "incompatible":
      return "text-destructive"
    case "untyped":
      return "text-muted-foreground"
  }
}

export function wireStructureToInput(
  modules: PipelineModule[],
  moduleId: ModuleId,
  structureId: StructureModelId,
): PipelineModule[] {
  return modules.map((m) => {
    if (m.id !== moduleId || m.kind !== ModuleKind.Input) return m
    return { ...m, outStructureId: structureId }
  })
}

export function structureFieldCount(model: StructureModel): number {
  return model.fields?.length ?? 0
}

export function structureSummary(
  model: StructureModel,
  models: StructureModel[],
  _typeAliases: TypeAlias[],
): string {
  const fields = model.fields ?? []
  if (!fields.length) return "Empty structure"
  const preview = fields
    .slice(0, 4)
    .map((f) => {
      const expr = fieldToTypeExpr(f)
      const label = expr ? formatTypeExpr(expr, models) : f.type
      return `${f.name}: ${label}`
    })
    .join(", ")
  const more = fields.length > 4 ? ` +${fields.length - 4} more` : ""
  return preview + more
}

export function modelDisplayName(
  models: StructureModel[],
  id: StructureModelId | undefined,
): string {
  if (!id) return "—"
  return modelName(models, id) ?? id
}

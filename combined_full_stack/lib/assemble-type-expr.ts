// AI : assemble — resolve binding TypeExprs, derive auto out model, validate vs out fields.
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import {
  expandNamedTypeExpr,
  fieldToTypeExpr,
  formatTypeExpr,
  stepSpineOutType,
  typeExprEqual,
  type TypeExpr,
} from "@/lib/server/type_expr"
import { legacyFieldFromTypeExpr } from "@/lib/type-expr-parse"
import {
  FieldType,
  ModuleKind,
  type AssembleSource,
  type ModelField,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
  type TypeAlias,
} from "@/lib/types"

export type assemble_field_name = string

export function assembleAutoModelId(moduleId: string): StructureModelId {
  return `sm_assemble_${moduleId}` as StructureModelId
}

export function isAssembleAutoModelId(id: string | undefined, moduleId: string): boolean {
  return !!id && id === assembleAutoModelId(moduleId)
}

export function usesAssembleAutoOut(m: PipelineModule, models: StructureModel[]): boolean {
  if (!m.outStructureId) return true
  if (isAssembleAutoModelId(m.outStructureId, m.id)) return true
  const out = models.find((x) => x.id === m.outStructureId)
  return !!out?.auto && isAssembleAutoModelId(out.id, m.id)
}

export function resolveAssembleSourceType(
  source: AssembleSource,
  prev: PipelineModule | undefined,
  modules: PipelineModule[],
  beforeIndex: number,
): TypeExpr | undefined {
  if (source.kind === "spine") return prev ? stepSpineOutType(prev) : undefined
  const label = labelAsStateKey(source.label)
  if (!label) return undefined
  for (let i = 0; i < beforeIndex; i++) {
    const mod = modules[i]!
    if (labelAsStateKey(mod.label) === label) return stepSpineOutType(mod)
  }
  return undefined
}

// AI : Stage B — expand aliases; optional[T] accepts T; otherwise structural equality.
export function typeExprAssignable(
  expected: TypeExpr,
  actual: TypeExpr,
  typeAliases: TypeAlias[] = [],
): boolean {
  const e = expandNamedTypeExpr(expected, typeAliases)
  const a = expandNamedTypeExpr(actual, typeAliases)
  if (typeExprEqual(e, a)) return true
  if (e.kind === "optional" && typeExprAssignable(e.inner, a, typeAliases)) return true
  return false
}

export function modelFieldFromTypeExpr(name: assemble_field_name, expr: TypeExpr): ModelField {
  const legacy = legacyFieldFromTypeExpr(expr)
  if (legacy) {
    return {
      id: `f_${name}`,
      name,
      type: legacy.type,
      ref: legacy.ref,
      optional: false,
      description: "",
    }
  }
  return {
    id: `f_${name}`,
    name,
    type: FieldType.Json,
    optional: false,
    description: "",
    typeExpr: expr,
  }
}

export function deriveAssembleOutModel(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  modules: PipelineModule[],
  moduleIndex: number,
  existing?: StructureModel,
): StructureModel | undefined {
  const bindings = m.assembleBindings ?? {}
  const names = Object.keys(bindings).filter((n) => n.trim())
  if (!names.length) return undefined
  const fields: ModelField[] = []
  for (const name of names) {
    const source = bindings[name]!
    const expr = resolveAssembleSourceType(source, prev, modules, moduleIndex)
    if (!expr) continue
    fields.push(modelFieldFromTypeExpr(name, expr))
  }
  if (!fields.length) return undefined
  const id = assembleAutoModelId(m.id)
  const labelBits = names.slice(0, 3).join("_")
  return {
    id,
    name: existing?.name ?? `Assemble_${labelBits || m.label.replace(/\s+/g, "_")}`,
    description: existing?.description ?? "Auto-derived assemble product (flat zip of step outputs).",
    auto: true,
    fields,
  }
}

export type AssembleBindingIssue = {
  field?: assemble_field_name
  message: string
  missingLabel?: string
}

export function validateAssembleBindings(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  modules: PipelineModule[],
  moduleIndex: number,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): AssembleBindingIssue[] {
  const issues: AssembleBindingIssue[] = []
  const bindings = m.assembleBindings ?? {}
  const names = Object.keys(bindings)
  if (!names.length) {
    issues.push({ message: "add assemble bindings — map each output field to spine or a prior step label" })
    return issues
  }

  let spineUsed = false
  for (const name of names) {
    const source = bindings[name]!
    if (source.kind === "spine") spineUsed = true
    if (source.kind === "state") {
      const label = labelAsStateKey(source.label)
      if (!label) {
        issues.push({ field: name, message: `binding "${name}" needs a prior step label` })
        continue
      }
      const inScope = modules.slice(0, moduleIndex).some((mod) => labelAsStateKey(mod.label) === label)
      if (!inScope) {
        issues.push({ field: name, missingLabel: label, message: `state label "${label}" is not in scope` })
        continue
      }
      const srcMod = modules.slice(0, moduleIndex).find((mod) => labelAsStateKey(mod.label) === label)
      if (srcMod?.kind === ModuleKind.Assemble) {
        issues.push({
          field: name,
          message: `prefer original step labels over nesting assemble "${label}" — keep pipeline state flat`,
        })
      }
    }
    const sourceType = resolveAssembleSourceType(source, prev, modules, moduleIndex)
    if (!sourceType) {
      issues.push({ field: name, message: `binding "${name}" source type could not be resolved` })
    }
  }
  if (!spineUsed) {
    issues.push({ message: "at least one binding must use spine (previous step output)" })
  }

  const out = models.find((x) => x.id === m.outStructureId)
  if (!out) return issues

  const bound = new Set(names)
  for (const f of out.fields) {
    if (!f.name.trim()) continue
    if (f.optional) continue
    if (!bound.has(f.name)) {
      issues.push({ field: f.name, message: `required field "${f.name}" has no assemble binding` })
    }
  }
  for (const name of names) {
    const field = out.fields.find((f) => f.name === name)
    if (!field) {
      issues.push({ field: name, message: `binding "${name}" is not a field on ${out.name}` })
      continue
    }
    const source = bindings[name]!
    const sourceType = resolveAssembleSourceType(source, prev, modules, moduleIndex)
    if (!sourceType) continue
    const expected = fieldToTypeExpr(field)
    if (!typeExprAssignable(expected, sourceType, typeAliases)) {
      issues.push({
        field: name,
        message: `field "${name}" expects ${formatTypeExpr(expected, models)}, got ${formatTypeExpr(sourceType, models)}`,
      })
    }
  }
  return issues
}

export function deriveAssembleStepTypes(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  modules: PipelineModule[],
  moduleIndex: number,
  models: StructureModel[],
): { module: PipelineModule; models: StructureModel[] } {
  if (m.kind !== ModuleKind.Assemble) return { module: m, models }

  const spineType = prev ? stepSpineOutType(prev) : m.inType
  let nextModels = models
  let next = { ...m }

  if (usesAssembleAutoOut(m, models)) {
    const existing = models.find((x) => x.id === assembleAutoModelId(m.id))
    const derived = deriveAssembleOutModel(m, prev, modules, moduleIndex, existing)
    if (derived) {
      const byId = new Map(nextModels.map((x) => [x.id, x]))
      byId.set(derived.id, derived)
      nextModels = [...byId.values()]
      next = {
        ...next,
        outStructureId: derived.id,
        outType: { kind: "ref", modelId: derived.id },
      }
    }
  }

  if (spineType) {
    next = {
      ...next,
      inType: spineType,
      inStructureId:
        spineType.kind === "ref"
          ? spineType.modelId
          : spineType.kind === "list" && spineType.item.kind === "ref"
            ? spineType.item.modelId
            : next.inStructureId,
    }
  }
  if (next.outStructureId && !next.outType) {
    next = { ...next, outType: { kind: "ref", modelId: next.outStructureId } }
  }
  return { module: next, models: nextModels }
}

export function syncAssembleModules(
  modules: PipelineModule[],
  models: StructureModel[],
): { modules: PipelineModule[]; models: StructureModel[] } {
  let scratch = models
  const nextModules = modules.map((m, i) => {
    if (m.kind !== ModuleKind.Assemble) return m
    const prev = i > 0 ? modules[i - 1] : undefined
    const synced = deriveAssembleStepTypes(m, prev, modules, i, scratch)
    scratch = synced.models
    return synced.module
  })
  return { modules: nextModules, models: scratch }
}

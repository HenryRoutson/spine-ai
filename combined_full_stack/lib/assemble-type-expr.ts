// AI : assemble — resolve binding TypeExprs, derive auto out model, validate vs out fields.
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import {
  fieldToTypeExpr,
  formatTypeExpr,
  stepSpineOutType,
  type TypeExpr,
} from "@/lib/server/type_expr"
import { legacyFieldFromTypeExpr } from "@/lib/type-expr-parse"
import {
  readDotPathValue,
  typeExprAssignable,
  typeExprAtPath,
} from "@/lib/type-expr-polymorph"
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
export { typeExprAssignable, readDotPathValue, typeExprAtPath }

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

function baseValueType(
  source: AssembleSource,
  prev: PipelineModule | undefined,
  modules: PipelineModule[],
  beforeIndex: number,
): TypeExpr | undefined {
  if (source.kind === "spine") return prev ? stepSpineOutType(prev) : undefined
  if (source.kind === "state") {
    const label = labelAsStateKey(source.label)
    if (!label) return undefined
    for (let i = 0; i < beforeIndex; i++) {
      const mod = modules[i]!
      if (labelAsStateKey(mod.label) === label) return stepSpineOutType(mod)
    }
    return undefined
  }
  // path
  if (source.from === "spine") return prev ? stepSpineOutType(prev) : undefined
  const label = labelAsStateKey(source.from.label)
  if (!label) return undefined
  for (let i = 0; i < beforeIndex; i++) {
    const mod = modules[i]!
    if (labelAsStateKey(mod.label) === label) return stepSpineOutType(mod)
  }
  return undefined
}

export function resolveAssembleSourceType(
  source: AssembleSource,
  prev: PipelineModule | undefined,
  modules: PipelineModule[],
  beforeIndex: number,
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
): TypeExpr | undefined {
  const base = baseValueType(source, prev, modules, beforeIndex)
  if (!base) return undefined
  if (source.kind !== "path") return base
  return typeExprAtPath(base, source.path, models, typeAliases)
}

export function resolveAssembleSourceValue(
  source: AssembleSource,
  spine: unknown,
  byLabel: Record<string, unknown>,
): unknown {
  if (source.kind === "spine") return spine
  if (source.kind === "state") {
    const label = labelAsStateKey(source.label)
    return byLabel[label]
  }
  const root =
    source.from === "spine"
      ? spine
      : byLabel[labelAsStateKey(source.from.label)]
  return readDotPathValue(root, source.path)
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
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
): StructureModel | undefined {
  const bindings = m.assembleBindings ?? {}
  const names = Object.keys(bindings).filter((n) => n.trim())
  if (!names.length) return undefined
  const fields: ModelField[] = []
  for (const name of names) {
    const source = bindings[name]!
    const expr = resolveAssembleSourceType(source, prev, modules, moduleIndex, models, typeAliases)
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

function sourceUsesSpine(source: AssembleSource): boolean {
  if (source.kind === "spine") return true
  if (source.kind === "path" && source.from === "spine") return true
  return false
}

function sourceStateLabel(source: AssembleSource): string | undefined {
  if (source.kind === "state") return labelAsStateKey(source.label)
  if (source.kind === "path" && source.from !== "spine") return labelAsStateKey(source.from.label)
  return undefined
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
    if (sourceUsesSpine(source)) spineUsed = true
    if (source.kind === "path" && !source.path.trim()) {
      issues.push({ field: name, message: `binding "${name}" path is empty` })
    }
    const label = sourceStateLabel(source)
    if (label !== undefined) {
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
      if (srcMod?.kind === ModuleKind.Assemble || srcMod?.kind === ModuleKind.Parallel) {
        issues.push({
          field: name,
          message: `prefer original step labels over nesting "${label}" — keep pipeline state flat`,
        })
      }
    }
    const sourceType = resolveAssembleSourceType(source, prev, modules, moduleIndex, models, typeAliases)
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
    const sourceType = resolveAssembleSourceType(source, prev, modules, moduleIndex, models, typeAliases)
    if (!sourceType) continue
    const expected = fieldToTypeExpr(field)
    if (!typeExprAssignable(expected, sourceType, typeAliases, models)) {
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
  typeAliases: TypeAlias[] = [],
): { module: PipelineModule; models: StructureModel[] } {
  if (m.kind !== ModuleKind.Assemble) return { module: m, models }

  const spineType = prev ? stepSpineOutType(prev) : m.inType
  let nextModels = models
  let next = { ...m }

  if (usesAssembleAutoOut(m, models)) {
    const existing = models.find((x) => x.id === assembleAutoModelId(m.id))
    const derived = deriveAssembleOutModel(m, prev, modules, moduleIndex, existing, models, typeAliases)
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
  typeAliases: TypeAlias[] = [],
): { modules: PipelineModule[]; models: StructureModel[] } {
  let scratch = models
  const nextModules = modules.map((m, i) => {
    if (m.kind !== ModuleKind.Assemble && m.kind !== ModuleKind.Parallel) return m
    if (m.kind === ModuleKind.Parallel) {
      const synced = deriveParallelStepTypes(m, i > 0 ? modules[i - 1] : undefined, scratch)
      scratch = synced.models
      return synced.module
    }
    const prev = i > 0 ? modules[i - 1] : undefined
    const synced = deriveAssembleStepTypes(m, prev, modules, i, scratch, typeAliases)
    scratch = synced.models
    return synced.module
  })
  return { modules: nextModules, models: scratch }
}

export function parallelAutoModelId(moduleId: string): StructureModelId {
  return `sm_parallel_${moduleId}` as StructureModelId
}

export function deriveParallelStepTypes(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  models: StructureModel[],
): { module: PipelineModule; models: StructureModel[] } {
  if (m.kind !== ModuleKind.Parallel) return { module: m, models }
  const branches = m.parallelBranches ?? []
  if (!branches.length) return { module: m, models }

  const fields: ModelField[] = []
  for (const b of branches) {
    if (!b.field.trim() || !b.outStructureId) continue
    fields.push(
      modelFieldFromTypeExpr(b.field.trim(), { kind: "ref", modelId: b.outStructureId }),
    )
  }
  if (!fields.length) return { module: m, models }

  const id = parallelAutoModelId(m.id)
  const existing = models.find((x) => x.id === id)
  const derived: StructureModel = {
    id,
    name: existing?.name ?? `Parallel_${m.label.replace(/\s+/g, "_")}`,
    description: existing?.description ?? "Auto-derived parallel LLM join product.",
    auto: true,
    fields,
  }
  const byId = new Map(models.map((x) => [x.id, x]))
  byId.set(id, derived)
  const spineType = prev ? stepSpineOutType(prev) : m.inType
  return {
    models: [...byId.values()],
    module: {
      ...m,
      outStructureId: id,
      outType: { kind: "ref", modelId: id },
      inType: spineType ?? m.inType,
      inStructureId:
        spineType?.kind === "ref"
          ? spineType.modelId
          : spineType?.kind === "list" && spineType.item.kind === "ref"
            ? spineType.item.modelId
            : m.inStructureId,
    },
  }
}

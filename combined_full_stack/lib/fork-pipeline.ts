// AI : series-parallel Fork — nested linear lanes + join. See lib/server/fork-roadmap.ts.
import { uid } from "@/lib/id"
import { runMergeStep } from "@/lib/merger"
import {
  modelFieldFromTypeExpr,
  resolveAssembleSourceValue,
  validateAssembleBindings,
  type AssembleBindingIssue,
} from "@/lib/assemble-type-expr"
import { TypeExprKind, typeExprEqual, stepSpineOutType, type TypeExpr } from "@/lib/server/type_expr"
import {
  ModuleKind,
  type AssembleSource,
  type ModelField,
  type ModuleId,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
  type TypeAlias,
} from "@/lib/types"

export function makeControlJoinModule(note = "continue with the taken branch"): PipelineModule {
  return {
    id: uid<ModuleId>("mod_"),
    kind: ModuleKind.ControlJoin,
    label: "Join",
    note,
    inputDescription: "Taken branch output from the previous if/case",
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
  }
}

export const FORK_MIN_BRANCHES = 2
export const FORK_MAX_BRANCHES = 12

export type ForkJoin = "product" | "assemble" | "merge"

export type ForkBranch = {
  id: string
  label: string
  modules: PipelineModule[]
  match?: string
}

export type ForkModuleLoc = {
  module: PipelineModule
  siblings: PipelineModule[]
  index: number
  predecessor?: PipelineModule
  parentFork?: PipelineModule
  branchId?: string
}

export function isForkKind(kind: string): boolean {
  return kind === "fork"
}

export function isIfElseKind(kind: string): boolean {
  return kind === "if-else"
}

export function isCaseKind(kind: string): boolean {
  return kind === "case"
}

export function isControlJoinKind(kind: string): boolean {
  return kind === "control-join"
}

export function isExclusiveKind(kind: string): boolean {
  return isIfElseKind(kind) || isCaseKind(kind)
}

export function isNestedLaneKind(kind: string): boolean {
  return isForkKind(kind) || isExclusiveKind(kind)
}

export function forkJoinOf(m: PipelineModule): ForkJoin {
  return m.forkJoin === "assemble" || m.forkJoin === "merge" ? m.forkJoin : "product"
}

export function forkBranchesOf(m: PipelineModule): ForkBranch[] {
  return m.forkBranches ?? []
}

export function forkAutoModelId(moduleId: string): StructureModelId {
  return `sm_fork_${moduleId}` as StructureModelId
}

export function forkProductField(branch: ForkBranch): string {
  const raw = branch.label.trim() || branch.id
  const slug = raw.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^(\d)/, "_$1")
  return slug || branch.id
}

export function makeEmptyForkBranch(label: string): ForkBranch {
  return {
    id: uid("fbr_"),
    label,
    modules: [],
  }
}

export function defaultForkBranches(): ForkBranch[] {
  return [makeEmptyForkBranch("Lane A"), makeEmptyForkBranch("Lane B")]
}

export function flattenPipelineModules(modules: PipelineModule[]): PipelineModule[] {
  const out: PipelineModule[] = []
  for (const m of modules) {
    out.push(m)
    if (isNestedLaneKind(m.kind)) {
      for (const b of forkBranchesOf(m)) {
        out.push(...flattenPipelineModules(b.modules))
      }
    }
  }
  return out
}

export function findPipelineModule(
  modules: PipelineModule[],
  id: ModuleId | string,
): PipelineModule | undefined {
  return flattenPipelineModules(modules).find((m) => m.id === id)
}

export function locatePipelineModule(
  modules: PipelineModule[],
  id: ModuleId | string,
  startPrev?: PipelineModule,
  parentFork?: PipelineModule,
  branchId?: string,
): ForkModuleLoc | undefined {
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!
    const predecessor = i > 0 ? modules[i - 1] : startPrev
    if (m.id === id) {
      return { module: m, siblings: modules, index: i, predecessor, parentFork, branchId }
    }
    if (!isNestedLaneKind(m.kind)) continue
    for (const b of forkBranchesOf(m)) {
      const found = locatePipelineModule(b.modules, id, predecessor, m, b.id)
      if (found) return found
    }
  }
  return undefined
}

export function predecessorOf(
  modules: PipelineModule[],
  moduleId: ModuleId,
): PipelineModule | undefined {
  return locatePipelineModule(modules, moduleId)?.predecessor
}

export function mapPipelineModules(
  modules: PipelineModule[],
  fn: (m: PipelineModule) => PipelineModule,
): PipelineModule[] {
  return modules.map((m) => {
    const mapped = fn(m)
    if (!isNestedLaneKind(mapped.kind)) return mapped
    return {
      ...mapped,
      forkBranches: forkBranchesOf(mapped).map((b) => ({
        ...b,
        modules: mapPipelineModules(b.modules, fn),
      })),
    }
  })
}

export function updatePipelineModule(
  modules: PipelineModule[],
  id: ModuleId | string,
  updater: (m: PipelineModule) => PipelineModule,
): PipelineModule[] {
  return modules.map((m) => {
    if (m.id === id) return updater(m)
    if (!isNestedLaneKind(m.kind)) return m
    return {
      ...m,
      forkBranches: forkBranchesOf(m).map((b) => ({
        ...b,
        modules: updatePipelineModule(b.modules, id, updater),
      })),
    }
  })
}

function withJoinIfNeeded(siblings: PipelineModule[], at: number, fresh: PipelineModule[]): PipelineModule[] {
  const i = Math.max(0, Math.min(at, siblings.length))
  const prev = siblings[i - 1]
  const next = siblings[i]
  if (
    prev &&
    isExclusiveKind(prev.kind) &&
    !fresh.some((m) => isControlJoinKind(m.kind)) &&
    !(next && isControlJoinKind(next.kind))
  ) {
    return [makeControlJoinModule(), ...fresh]
  }
  return fresh
}

export function insertPipelineModules(
  modules: PipelineModule[],
  at: number,
  fresh: PipelineModule[],
  loc?: { forkId: ModuleId | string; branchId: string },
): PipelineModule[] {
  if (!loc) {
    const items = withJoinIfNeeded(modules, at, fresh)
    return [...modules.slice(0, at), ...items, ...modules.slice(at)]
  }
  return modules.map((m) => {
    if (!isNestedLaneKind(m.kind)) return m
    if (m.id === loc.forkId) {
      return {
        ...m,
        forkBranches: forkBranchesOf(m).map((b) => {
          if (b.id !== loc.branchId) return b
          const i = Math.max(0, Math.min(at, b.modules.length))
          const items = withJoinIfNeeded(b.modules, i, fresh)
          return { ...b, modules: [...b.modules.slice(0, i), ...items, ...b.modules.slice(i)] }
        }),
      }
    }
    return {
      ...m,
      forkBranches: forkBranchesOf(m).map((b) => ({
        ...b,
        modules: insertPipelineModules(b.modules, at, fresh, loc),
      })),
    }
  })
}

export function replacePipelineSiblings(
  modules: PipelineModule[],
  loc: ForkModuleLoc,
  nextSiblings: PipelineModule[],
): PipelineModule[] {
  if (!loc.parentFork || !loc.branchId) return nextSiblings
  return updatePipelineModule(modules, loc.parentFork.id, (fork) => ({
    ...fork,
    forkBranches: forkBranchesOf(fork).map((b) =>
      b.id === loc.branchId ? { ...b, modules: nextSiblings } : b,
    ),
  }))
}

export function pipelineHasFork(modules: PipelineModule[]): boolean {
  return flattenPipelineModules(modules).some((m) => isNestedLaneKind(m.kind))
}

export function removePipelineModules(
  modules: PipelineModule[],
  drop: Set<string>,
): PipelineModule[] {
  return modules.flatMap((m) => {
    if (drop.has(m.id)) return []
    if (!isNestedLaneKind(m.kind)) return [m]
    return [
      {
        ...m,
        forkBranches: forkBranchesOf(m).map((b) => ({
          ...b,
          modules: removePipelineModules(b.modules, drop),
        })),
      },
    ]
  })
}

export function laneLastModule(branch: { modules: PipelineModule[] }): PipelineModule | undefined {
  const mods = branch.modules
  return mods.length ? mods[mods.length - 1] : undefined
}

export function forkContainsNestedFork(m: PipelineModule): boolean {
  if (!isNestedLaneKind(m.kind)) return false
  return forkBranchesOf(m).some((b) => flattenPipelineModules(b.modules).some((x) => isNestedLaneKind(x.kind)))
}

export type LinearSpan = {
  modules: PipelineModule[]
  startPrev?: PipelineModule
  scopePrefix: PipelineModule[]
}

export function visitLinearSpans(
  modules: PipelineModule[],
  visit: (span: LinearSpan) => void,
  startPrev?: PipelineModule,
  scopePrefix: PipelineModule[] = [],
): void {
  visit({ modules, startPrev, scopePrefix })
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!
    if (!isNestedLaneKind(m.kind)) continue
    const pred = i > 0 ? modules[i - 1] : startPrev
    const prefix = [...scopePrefix, ...modules.slice(0, i)]
    for (const b of forkBranchesOf(m)) {
      visitLinearSpans(b.modules, visit, pred, prefix)
    }
  }
}

export function deriveForkStepTypes(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): { module: PipelineModule; models: StructureModel[] } {
  if (!isForkKind(m.kind)) return { module: m, models }
  const join = forkJoinOf(m)
  const spineType = prev ? stepSpineOutType(prev) : m.inType
  let next: PipelineModule = { ...m }
  let nextModels = models

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

  if (join === "product") {
    const fields: ModelField[] = []
    for (const b of forkBranchesOf(m)) {
      const last = laneLastModule(b)
      const expr = last ? stepSpineOutType(last) : undefined
      if (!expr) continue
      fields.push(modelFieldFromTypeExpr(forkProductField(b), expr))
    }
    if (fields.length) {
      const id = forkAutoModelId(m.id)
      const existing = models.find((x) => x.id === id)
      const derived: StructureModel = {
        id,
        name: existing?.name ?? `Fork_${m.label.replace(/\s+/g, "_")}`,
        description: existing?.description ?? "Auto-derived fork product (one field per lane).",
        auto: true,
        fields,
      }
      const byId = new Map(nextModels.map((x) => [x.id, x]))
      byId.set(id, derived)
      nextModels = [...byId.values()]
      next = {
        ...next,
        outStructureId: id,
        outType: { kind: "ref", modelId: id },
      }
    }
  } else if (join === "merge") {
    const last = forkBranchesOf(m).map(laneLastModule).find(Boolean)
    const expr = last ? stepSpineOutType(last) : spineType
    if (expr) {
      next = {
        ...next,
        outType: expr,
        outStructureId:
          expr.kind === "ref"
            ? expr.modelId
            : expr.kind === "list" && expr.item.kind === "ref"
              ? expr.item.modelId
              : next.outStructureId,
      }
    }
  }

  if (next.outStructureId && !next.outType) {
    next = { ...next, outType: { kind: "ref", modelId: next.outStructureId } }
  }
  return { module: next, models: nextModels }
}

function unionTypeExprs(a?: TypeExpr, b?: TypeExpr): TypeExpr | undefined {
  if (!a) return b
  if (!b) return a
  if (typeExprEqual(a, b)) return a
  const variants: TypeExpr[] = []
  const push = (x: TypeExpr) => {
    const parts = x.kind === TypeExprKind.Union ? x.variants : [x]
    for (const p of parts) {
      if (!variants.some((v) => typeExprEqual(v, p))) variants.push(p)
    }
  }
  push(a)
  push(b)
  return variants.length === 1 ? variants[0]! : { kind: TypeExprKind.Union, variants }
}

function laneOutOrSpine(branch: { modules: PipelineModule[] }, spineType?: TypeExpr): TypeExpr | undefined {
  const last = laneLastModule(branch)
  return last ? stepSpineOutType(last) : spineType
}

export function deriveIfElseStepTypes(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  models: StructureModel[],
): { module: PipelineModule; models: StructureModel[] } {
  if (!isExclusiveKind(m.kind)) return { module: m, models }
  const spineType = prev ? stepSpineOutType(prev) : m.inType
  let next: PipelineModule = { ...m }
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
  const branches = forkBranchesOf(m)
  const outType = branches
    .map((b) => laneOutOrSpine(b, spineType))
    .reduce<TypeExpr | undefined>((acc, t) => unionTypeExprs(acc, t), undefined)
  if (outType) {
    next = {
      ...next,
      outType,
      outStructureId:
        outType.kind === "ref"
          ? outType.modelId
          : outType.kind === "list" && outType.item.kind === "ref"
            ? outType.item.modelId
            : undefined,
    }
  }
  return { module: next, models }
}

export function deriveControlJoinTypes(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  models: StructureModel[],
): { module: PipelineModule; models: StructureModel[] } {
  if (!isControlJoinKind(m.kind)) return { module: m, models }
  const spineType = prev ? stepSpineOutType(prev) : m.inType
  if (!spineType) return { module: m, models }
  return {
    models,
    module: {
      ...m,
      inType: spineType,
      outType: spineType,
      inStructureId:
        spineType.kind === "ref"
          ? spineType.modelId
          : spineType.kind === "list" && spineType.item.kind === "ref"
            ? spineType.item.modelId
            : m.inStructureId,
      outStructureId:
        spineType.kind === "ref"
          ? spineType.modelId
          : spineType.kind === "list" && spineType.item.kind === "ref"
            ? spineType.item.modelId
            : undefined,
    },
  }
}

export function syncForkModules(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
  startPrev?: PipelineModule,
): { modules: PipelineModule[]; models: StructureModel[] } {
  let scratch = models
  const nextModules = modules.map((m, i) => {
    const prev = i > 0 ? modules[i - 1] : startPrev
    if (isNestedLaneKind(m.kind)) {
      const nested = forkBranchesOf(m).map((b) => {
        const syncedLane = syncForkModules(b.modules, scratch, typeAliases, prev)
        scratch = syncedLane.models
        return { ...b, modules: syncedLane.modules }
      })
      const withLanes = { ...m, forkBranches: nested }
      const synced = isExclusiveKind(m.kind)
        ? deriveIfElseStepTypes(withLanes, prev, scratch)
        : deriveForkStepTypes(withLanes, prev, scratch, typeAliases)
      scratch = synced.models
      return synced.module
    }
    if (isControlJoinKind(m.kind)) {
      const synced = deriveControlJoinTypes(m, prev, scratch)
      return synced.module
    }
    return m
  })
  return { modules: nextModules, models: scratch }
}

export function forkJoinScopeModules(
  fork: PipelineModule,
  loc: ForkModuleLoc,
): { modules: PipelineModule[]; joinIndex: number } {
  const lanes = forkBranchesOf(fork).flatMap((b) => b.modules)
  const prefix = loc.siblings.slice(0, loc.index)
  const modules = [...prefix, ...lanes, fork]
  return { modules, joinIndex: modules.length - 1 }
}

export function validateForkAssembleJoin(
  m: PipelineModule,
  loc: ForkModuleLoc,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): AssembleBindingIssue[] {
  const { modules, joinIndex } = forkJoinScopeModules(m, loc)
  const prev = loc.predecessor
  return validateAssembleBindings(m, prev, modules, joinIndex, models, typeAliases)
}

export function joinForkProductValue(m: PipelineModule, byLabel: Record<string, unknown>): Record<string, unknown> {
  const value: Record<string, unknown> = {}
  for (const b of forkBranchesOf(m)) {
    const last = laneLastModule(b)
    if (!last) continue
    const key = forkProductField(b)
    value[key] = byLabel[last.label.trim()]
  }
  return value
}

export function joinForkAssembleValue(
  m: PipelineModule,
  spine: unknown,
  byLabel: Record<string, unknown>,
): Record<string, unknown> {
  const bindings = m.assembleBindings ?? {}
  const value: Record<string, unknown> = {}
  for (const [name, source] of Object.entries(bindings)) {
    value[name] = resolveAssembleSourceValue(source as AssembleSource, spine, byLabel)
  }
  return value
}

export function joinForkMergeValue(m: PipelineModule, byLabel: Record<string, unknown>): unknown {
  const values = forkBranchesOf(m).flatMap((b) => {
    const last = laneLastModule(b)
    if (!last) return []
    const v = byLabel[last.label.trim()]
    return v === undefined ? [] : [v]
  })
  return runMergeStep(values, m.mergePolicy)
}

export function joinForkValue(
  m: PipelineModule,
  spine: unknown,
  byLabel: Record<string, unknown>,
): unknown {
  const join = forkJoinOf(m)
  if (join === "assemble") return joinForkAssembleValue(m, spine, byLabel)
  if (join === "merge") return joinForkMergeValue(m, byLabel)
  return joinForkProductValue(m, byLabel)
}

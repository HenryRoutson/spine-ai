import type { ModelField, StructureModel, StructureModelId } from "@/lib/types"
import { referencedModelIds } from "@/lib/structure-ref"
import { collectTypeExprRefModelIds, fieldToTypeExpr, type TypeExpr } from "@/lib/server/type_expr"

const STRUCTURE_NUMBER_RE = /^Structure[_ ](\d+)$/

export function isNumberedStructureName(name: string): boolean {
  return STRUCTURE_NUMBER_RE.test(name)
}

// AI : codegen-safe model identifiers — "Structure 4" → "Structure_4", other spaces → "_".
export function modelExportIdentifier(name: string): string {
  const hit = STRUCTURE_NUMBER_RE.exec(name)
  if (hit) return `Structure_${hit[1]}`
  const trimmed = name.trim()
  if (!trimmed) return "_empty"
  return trimmed.replace(/[^\w]+/g, "_").replace(/^(\d)/, "_$1")
}

// AI : shape compare ignores model names — nested @sig carries the structural identity.
function formatTypeExprShape(expr: TypeExpr): string {
  switch (expr.kind) {
    case "prim":
      return expr.name === "text" ? "str" : expr.name
    case "document":
      return "Document"
    case "quote":
      return "Quote"
    case "text_quote":
      return "TextQuote"
    case "list":
      return `list[${formatTypeExprShape(expr.item)}]`
    case "ref":
      return "Model"
    case "optional":
      return `Optional[${formatTypeExprShape(expr.inner)}]`
    case "set":
      return `set[${formatTypeExprShape(expr.item)}]`
    case "map":
      return `dict[${formatTypeExprShape(expr.key)}, ${formatTypeExprShape(expr.value)}]`
    case "union":
      return expr.variants.map((v) => formatTypeExprShape(v)).join(" | ")
    case "generic":
      if (expr.name === "tuple") {
        return `tuple[${expr.args.map((a) => formatTypeExprShape(a)).join(", ")}]`
      }
      return expr.args.length
        ? `${expr.name}[${expr.args.map((a) => formatTypeExprShape(a)).join(", ")}]`
        : expr.name
    case "named":
      return expr.name
    case "unset":
      return "UNSET"
    case "file":
      return "FileInput"
    case "unknown":
      return "Any"
    default:
      return "Any"
  }
}

function nestedRefShapeParts(
  f: ModelField,
  byId: Map<string, StructureModel>,
  visiting: Set<StructureModelId>,
  loose: boolean,
): string {
  const refIds = new Set<StructureModelId>()
  if (f.ref) refIds.add(f.ref)
  for (const id of collectTypeExprRefModelIds(fieldToTypeExpr(f))) refIds.add(id)
  return [...refIds]
    .map((refId) => {
      const refModel = byId.get(refId)
      if (!refModel) return `@ref:${refId}`
      if (visiting.has(refModel.id)) return `@ref:${refModel.id}`
      const sig = loose
        ? modelShapeSignatureLoose(refModel, byId, visiting)
        : modelShapeSignature(refModel, byId, visiting)
      return `@${sig}`
    })
    .join("")
}

function fieldShapePart(
  f: ModelField,
  byId: Map<string, StructureModel>,
  visiting: Set<StructureModelId>,
): string {
  const typePart = formatTypeExprShape(fieldToTypeExpr(f))
  const refPart = nestedRefShapeParts(f, byId, visiting, false)
  return `${typePart}${f.optional ? "?" : ""}${refPart}`
}

function fieldShapePartLoose(
  f: ModelField,
  byId: Map<string, StructureModel>,
  visiting: Set<StructureModelId>,
): string {
  const typePart = formatTypeExprShape(fieldToTypeExpr(f))
  const refPart = nestedRefShapeParts(f, byId, visiting, true)
  return `${f.name}:${typePart}${refPart}`
}

// AI : compare inferred shapes by field types — doc-specific field names are ignored.
export function modelShapeSignature(
  m: StructureModel,
  all: StructureModel[] | Map<string, StructureModel>,
  visiting: Set<StructureModelId> = new Set(),
): string {
  const byId = all instanceof Map ? all : new Map(all.map((x) => [x.id, x]))
  if (visiting.has(m.id)) return `cycle:${m.id}`
  visiting.add(m.id)
  const sig = m.fields
    .map((f) => fieldShapePart(f, byId, visiting))
    .sort()
    .join("|")
  visiting.delete(m.id)
  return sig
}

// AI : pydantic / named-model dedupe — same field names + types, optional flags ignored.
export function modelShapeSignatureLoose(
  m: StructureModel,
  all: StructureModel[] | Map<string, StructureModel>,
  visiting: Set<StructureModelId> = new Set(),
): string {
  const byId = all instanceof Map ? all : new Map(all.map((x) => [x.id, x]))
  if (visiting.has(m.id)) return `cycle:${m.id}`
  visiting.add(m.id)
  const sig = m.fields
    .map((f) => fieldShapePartLoose(f, byId, visiting))
    .sort()
    .join("|")
  visiting.delete(m.id)
  return sig
}

export function bundleShapeSignature(root: StructureModel, all: StructureModel[]): string {
  const byId = new Map(all.map((x) => [x.id, x]))
  const seen = new Set<string>()
  const queue = [root.id]
  const parts: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const m = byId.get(id)
    if (!m) continue
    parts.push(modelShapeSignature(m, byId))
    for (const f of m.fields) {
      if (f.ref) queue.push(f.ref)
      for (const refId of collectTypeExprRefModelIds(fieldToTypeExpr(f))) queue.push(refId)
    }
  }
  return parts.sort().join("||")
}

export function bundleShapeSignatureLoose(root: StructureModel, all: StructureModel[]): string {
  const byId = new Map(all.map((x) => [x.id, x]))
  const seen = new Set<string>()
  const queue = [root.id]
  const parts: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const m = byId.get(id)
    if (!m) continue
    parts.push(modelShapeSignatureLoose(m, byId))
    for (const f of m.fields) {
      if (f.ref) queue.push(f.ref)
      for (const refId of collectTypeExprRefModelIds(fieldToTypeExpr(f))) queue.push(refId)
    }
  }
  return parts.sort().join("||")
}

export function preferModelForShape(a: StructureModel, b: StructureModel): StructureModel {
  const aNum = isNumberedStructureName(a.name)
  const bNum = isNumberedStructureName(b.name)
  if (aNum && !bNum) return b
  if (!aNum && bNum) return a
  if (a.auto && !b.auto) return b
  if (!a.auto && b.auto) return a
  return a.name.localeCompare(b.name) <= 0 ? a : b
}

function remapModelRefs(
  models: StructureModel[],
  remap: Map<StructureModelId, StructureModelId>,
): StructureModel[] {
  if (!remap.size) return models
  return models.map((m) => ({
    ...m,
    fields: m.fields.map((f) =>
      f.ref && remap.has(f.ref) ? { ...f, ref: remap.get(f.ref)! } : f,
    ),
  }))
}

// AI : drop Structure N when a real named model already has the same pydantic shape (e.g. GPSLocation).
function collapseNumberedAgainstNamed(models: StructureModel[]): StructureModel[] {
  const keeperByShape = new Map<string, StructureModel>()
  for (const m of models) {
    if (m.shared || m.locked) continue
    const sig = bundleShapeSignatureLoose(m, models)
    const prev = keeperByShape.get(sig)
    keeperByShape.set(sig, prev ? preferModelForShape(prev, m) : m)
  }

  const removeIds = new Set<StructureModelId>()
  const remap = new Map<StructureModelId, StructureModelId>()

  for (const m of models) {
    if (!isNumberedStructureName(m.name)) continue
    const keeper = keeperByShape.get(bundleShapeSignatureLoose(m, models))
    if (!keeper || keeper.id === m.id) continue
    removeIds.add(m.id)
    remap.set(m.id, keeper.id)
  }

  if (!removeIds.size) return models
  return remapModelRefs(
    models.filter((m) => !removeIds.has(m.id)),
    remap,
  )
}

export function modelsForPydanticExport(models: StructureModel[]): StructureModel[] {
  const emitted = new Map<string, StructureModel>()
  const skip = new Set<StructureModelId>()

  for (const m of models) {
    const sig = bundleShapeSignatureLoose(m, models)
    const prev = emitted.get(sig)
    if (!prev) {
      emitted.set(sig, m)
      continue
    }
    const keep = preferModelForShape(prev, m)
    const drop = keep.id === m.id ? prev : m
    emitted.set(sig, keep)
    skip.add(drop.id)
  }

  return models.filter((m) => !skip.has(m.id))
}

export function nextSharedStructureName(models: StructureModel[]): string {
  let max = 0
  for (const m of models) {
    const hit = STRUCTURE_NUMBER_RE.exec(m.name)
    if (hit) max = Math.max(max, Number(hit[1]))
  }
  return `Structure_${max + 1}`
}

export function findModelByBundleShape(
  models: StructureModel[],
  root: StructureModel,
  companions: StructureModel[],
): StructureModel | undefined {
  const probeAll = [...companions, root]
  const sig = bundleShapeSignatureLoose(root, probeAll)
  return models.find(
    (m) =>
      !m.shared &&
      !m.locked &&
      bundleShapeSignatureLoose(m, models) === sig,
  )
}

function collapseDuplicateModelsByShape(models: StructureModel[]): StructureModel[] {
  const removeIds = new Set<StructureModelId>()
  const remap = new Map<StructureModelId, StructureModelId>()
  const byShape = new Map<string, StructureModel[]>()

  for (const m of models) {
    if (m.shared || m.locked) continue
    const sig = modelShapeSignatureLoose(m, models)
    const group = byShape.get(sig) ?? []
    group.push(m)
    byShape.set(sig, group)
  }

  for (const group of byShape.values()) {
    if (group.length <= 1) continue
    const keeper = group.reduce((best, m) => preferModelForShape(best, m))
    for (const m of group) {
      if (m.id === keeper.id) continue
      removeIds.add(m.id)
      remap.set(m.id, keeper.id)
    }
  }

  if (!removeIds.size) return models
  return remapModelRefs(
    models.filter((m) => !removeIds.has(m.id)),
    remap,
  )
}

function collapsePerDocInferredDuplicates(models: StructureModel[]): StructureModel[] {
  const referenced = referencedModelIds(models)
  const candidates = models.filter(
    (m) =>
      m.auto &&
      !m.shared &&
      !m.locked &&
      !referenced.has(m.id) &&
      (m.sourceDocId || isNumberedStructureName(m.name)),
  )
  if (!candidates.length) return models

  const byShape = new Map<string, StructureModel[]>()
  for (const m of candidates) {
    const sig = bundleShapeSignature(m, models)
    const group = byShape.get(sig) ?? []
    group.push(m)
    byShape.set(sig, group)
  }

  const removeIds = new Set<string>()
  const renames = new Map<string, Partial<StructureModel>>()
  const takenNames = new Set(models.map((m) => m.name))
  let nameCursor = 1

  for (const group of byShape.values()) {
    const keeper =
      group.find((m) => STRUCTURE_NUMBER_RE.test(m.name)) ?? group[0]!
    for (const m of group) {
      if (m.id !== keeper.id) removeIds.add(m.id)
    }
    let sharedName = keeper.name
    if (!STRUCTURE_NUMBER_RE.test(sharedName)) {
      while (takenNames.has(`Structure_${nameCursor}`) || takenNames.has(`Structure ${nameCursor}`)) {
        nameCursor++
      }
      sharedName = `Structure_${nameCursor}`
      nameCursor++
      takenNames.add(sharedName)
    }
    renames.set(keeper.id, {
      name: sharedName,
      sourceDocId: undefined,
      description:
        group.length > 1
          ? "Shared document shape (inferred from multiple documents)."
          : keeper.description || "Inferred document shape.",
    })
  }

  if (!removeIds.size && !renames.size) return models

  return models
    .filter((m) => !removeIds.has(m.id))
    .map((m) => (renames.has(m.id) ? { ...m, ...renames.get(m.id)! } : m))
}

// AI : doc infer can produce two auto models with the same export id (recursive subsections) — rename companions.
function disambiguateDuplicateModelNames(models: StructureModel[]): StructureModel[] {
  const byExportId = new Map<string, StructureModel[]>()
  for (const m of models) {
    const key = modelExportIdentifier(m.name)
    const group = byExportId.get(key) ?? []
    group.push(m)
    byExportId.set(key, group)
  }

  const refCounts = new Map<StructureModelId, number>()
  for (const m of models) {
    for (const f of m.fields) {
      if (f.ref) refCounts.set(f.ref, (refCounts.get(f.ref) ?? 0) + 1)
    }
  }

  const renames = new Map<StructureModelId, string>()
  const takenNames = new Set(models.map((m) => m.name))

  for (const group of byExportId.values()) {
    if (group.length <= 1) continue
    const groupIds = new Set(group.map((m) => m.id))
    const sorted = [...group].sort((a, b) => {
      const aWraps = a.fields.some((f) => f.ref && groupIds.has(f.ref))
      const bWraps = b.fields.some((f) => f.ref && groupIds.has(f.ref))
      if (aWraps !== bWraps) return aWraps ? -1 : 1
      return (refCounts.get(b.id) ?? 0) - (refCounts.get(a.id) ?? 0)
    })
    const [, ...rest] = sorted
    for (const m of rest) {
      let candidate = `${m.name}Item`
      while (takenNames.has(candidate)) candidate = `${candidate}Item`
      renames.set(m.id, candidate)
      takenNames.add(candidate)
    }
  }

  if (!renames.size) return models
  return models.map((m) => (renames.has(m.id) ? { ...m, name: renames.get(m.id)! } : m))
}

function shapeDedupeStable(before: StructureModel[], after: StructureModel[]): boolean {
  if (before.length !== after.length) return false
  const byId = new Map(before.map((m) => [m.id, m]))
  return after.every((m) => {
    const prev = byId.get(m.id)
    if (!prev || prev.name !== m.name || prev.fields.length !== m.fields.length) return false
    return m.fields.every((f, i) => {
      const p = prev.fields[i]!
      return f.name === p.name && f.type === p.type && f.ref === p.ref && f.optional === p.optional
    })
  })
}

// AI : collapse duplicate derived shapes + numbered structures that match a named model.
export function dedupeInferredModelsByShape(models: StructureModel[]): StructureModel[] {
  let next = models
  for (let pass = 0; pass < 12; pass++) {
    const deduped = disambiguateDuplicateModelNames(
      collapsePerDocInferredDuplicates(
        collapseDuplicateModelsByShape(collapseNumberedAgainstNamed(next)),
      ),
    )
    if (shapeDedupeStable(next, deduped)) return deduped
    next = deduped
  }
  return next
}

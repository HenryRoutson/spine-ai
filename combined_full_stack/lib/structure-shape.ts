import type { ModelField, StructureModel, StructureModelId } from "@/lib/types"
import { referencedModelIds } from "@/lib/structure-ref"

const STRUCTURE_NUMBER_RE = /^Structure (\d+)$/

export function isNumberedStructureName(name: string): boolean {
  return STRUCTURE_NUMBER_RE.test(name)
}

function fieldShapePart(
  f: ModelField,
  byId: Map<string, StructureModel>,
): string {
  const refModel = f.ref ? byId.get(f.ref) : undefined
  const refPart = refModel ? `@${modelShapeSignature(refModel, byId)}` : ""
  return `${f.type}${f.optional ? "?" : ""}${refPart}`
}

function fieldShapePartLoose(
  f: ModelField,
  byId: Map<string, StructureModel>,
): string {
  const refModel = f.ref ? byId.get(f.ref) : undefined
  const refPart = refModel ? `@${modelShapeSignatureLoose(refModel, byId)}` : ""
  return `${f.name}:${f.type}${refPart}`
}

// AI : compare inferred shapes by field types — doc-specific field names are ignored.
export function modelShapeSignature(
  m: StructureModel,
  all: StructureModel[] | Map<string, StructureModel>,
): string {
  const byId = all instanceof Map ? all : new Map(all.map((x) => [x.id, x]))
  return m.fields
    .map((f) => fieldShapePart(f, byId))
    .sort()
    .join("|")
}

// AI : pydantic / named-model dedupe — same field names + types, optional flags ignored.
export function modelShapeSignatureLoose(
  m: StructureModel,
  all: StructureModel[] | Map<string, StructureModel>,
): string {
  const byId = all instanceof Map ? all : new Map(all.map((x) => [x.id, x]))
  return m.fields
    .map((f) => fieldShapePartLoose(f, byId))
    .sort()
    .join("|")
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
  return `Structure ${max + 1}`
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

function collapsePerDocInferredDuplicates(models: StructureModel[]): StructureModel[] {
  const referenced = referencedModelIds(models)
  const candidates = models.filter(
    (m) =>
      m.auto &&
      m.sourceDocId &&
      !m.shared &&
      !m.locked &&
      !referenced.has(m.id),
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
      while (takenNames.has(`Structure ${nameCursor}`)) nameCursor++
      sharedName = `Structure ${nameCursor}`
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

// AI : collapse per-doc inferred duplicates + numbered structures that match a named model.
export function dedupeInferredModelsByShape(models: StructureModel[]): StructureModel[] {
  return collapsePerDocInferredDuplicates(collapseNumberedAgainstNamed(models))
}

// AI : pure run fingerprint payload — shared by server dedup and step-cache keying.
// AI : TODO refactor — vitest target: fingerprint stability (pairs with lib/server/run_fingerprint.ts).
import { orderedInputModules } from "@/lib/inference-input"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { fieldToTypeExpr } from "@/lib/server/type_expr"
import {
  DEFAULT_MODEL,
  type DocId,
  type ModelId,
  type ModuleId,
  type ModelField,
  type PipelineModule,
  type PipelineRun,
  type Project,
  type RunFingerprint,
  type StructureModel,
  type TypeAlias,
} from "@/lib/types"

// AI : derived quote steps are re-generated from upstream LLM config — exclude from the hash.
function moduleForFingerprint(m: PipelineModule) {
  if (isAutoQuoteStep(m)) return null
  return {
    id: m.id,
    kind: m.kind,
    inStructureId: m.inStructureId ?? null,
    outStructureId: m.outStructureId ?? null,
    inputType: m.inputType ?? null,
    inputNameContains: m.inputNameContains ?? null,
    inputDescription: m.inputDescription ?? null,
    checkInputDescription: m.checkInputDescription ?? null,
    inputMinCount: m.inputMinCount ?? null,
    prompt: m.prompt ?? null,
    code: m.code ?? null,
    fallbackList: m.fallbackList?.length ? m.fallbackList : null,
    model: m.model ?? null,
    useOcr: m.useOcr ?? null,
    note: m.note ?? null,
    outIsList: m.outIsList ?? null,
    inType: m.inType ?? null,
    outType: m.outType ?? null,
  }
}

function fieldForFingerprint(f: ModelField) {
  return {
    id: f.id,
    name: f.name,
    optional: f.optional,
    minItems: f.minItems ?? null,
    // AI : canonical type — typeExpr wins over legacy type/ref so cache keys track schema edits.
    expr: fieldToTypeExpr(f),
  }
}

function modelForFingerprint(m: StructureModel) {
  return {
    id: m.id,
    fields: [...m.fields].map(fieldForFingerprint).sort((a, b) => a.id.localeCompare(b.id)),
  }
}

function typeAliasForFingerprint(t: TypeAlias) {
  return {
    id: t.id,
    name: t.name,
    expr: t.expr,
  }
}

export function resolveRunModel(project: Project, model?: ModelId): ModelId {
  return model ?? project.modules.find((m) => m.kind === "llm")?.model ?? DEFAULT_MODEL
}

function inputDocsBySlot(project: Project, inputDocIds: DocId[]): Partial<Record<ModuleId, DocId>> {
  const slots = orderedInputModules(project.modules)
  const out: Partial<Record<ModuleId, DocId>> = {}
  for (let i = 0; i < slots.length; i++) {
    const docId = inputDocIds[i]
    if (docId) out[slots[i].id] = docId
  }
  return out
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      )
    }
    return v
  })
}

export function buildRunConfigPayload(project: Project, model: ModelId | undefined) {
  return {
    v: 4 as const,
    model: resolveRunModel(project, model),
    models: [...project.models].sort((a, b) => a.id.localeCompare(b.id)).map(modelForFingerprint),
    typeAliases: [...(project.typeAliases ?? [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(typeAliasForFingerprint),
    modules: [...project.modules]
      .map(moduleForFingerprint)
      .filter((m): m is NonNullable<typeof m> => m != null)
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
}

export function buildRunFingerprintPayload(
  project: Project,
  model: ModelId | undefined,
  inputDocIds: DocId[],
) {
  return {
    ...buildRunConfigPayload(project, model),
    inputs: inputDocsBySlot(project, inputDocIds),
  }
}

export function moduleConfigForStepCache(m: PipelineModule) {
  return moduleForFingerprint(m) ?? { id: m.id, kind: m.kind }
}

// AI : step cache cfg — module execution config plus structure field defs (ids alone miss schema edits).
export function stepCacheConfigPayload(project: Project, module: PipelineModule, model: ModelId) {
  const cfg = buildRunConfigPayload(project, model);
  return {
    module: moduleConfigForStepCache(module),
    models: cfg.models,
    typeAliases: cfg.typeAliases,
  }
}

// AI : browser-side fingerprint — matches server run_fingerprint.ts hash for prior-run detection.
export async function computeRunFingerprintClient(
  project: Project,
  model: ModelId | undefined,
  inputDocIds: DocId[],
): Promise<RunFingerprint> {
  const json = stableJson(buildRunFingerprintPayload(project, model, inputDocIds))
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `runfp_${hex.slice(0, 24)}` as RunFingerprint
}

// AI : browser-side prior-run match — mirrors server findMatchingRun (stored fp + legacy recompute).
export async function findMatchingRunClient(
  runs: PipelineRun[],
  project: Project,
  model: ModelId | undefined,
  inputDocIds: DocId[],
): Promise<PipelineRun | null> {
  const fingerprint = await computeRunFingerprintClient(project, model, inputDocIds)
  const byColumn = runs.find((r) => r.status === "ok" && r.fingerprint === fingerprint)
  if (byColumn) return byColumn

  const resolvedModel = resolveRunModel(project, model)
  for (const r of runs) {
    if (r.status !== "ok") continue
    const ids = r.inputDocIds?.length ? r.inputDocIds : []
    if (!ids.length) continue
    if ((await computeRunFingerprintClient(project, resolvedModel, ids)) === fingerprint) return r
    if (r.model && (await computeRunFingerprintClient(project, r.model, ids)) === fingerprint) return r
  }
  return null
}

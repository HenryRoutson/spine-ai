// AI : pure run fingerprint payload — shared by server dedup and step-cache keying.
// AI : DONE (allow-pipeline-non-linear-fork) — hash flattened tree including nested forkBranches.
// AI : TODO refactor — vitest target: fingerprint stability (pairs with lib/server/run_fingerprint.ts).
import { orderedInputModules } from "@/lib/inference-input"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { fieldToTypeExpr, normalizeModelField } from "@/lib/server/type_expr"
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
type ModuleFingerprint = {
  id: string
  kind: string
  inStructureId: string | null
  outStructureId: string | null
  inputType: PipelineModule["inputType"] | null
  inputNameContains: string | null
  inputDescription: string | null
  checkInputDescription: boolean | null
  inputMinCount: number | null
  prompt: string | null
  code: string | null
  fallbackList: PipelineModule["fallbackList"] | null
  model: string | null
  useOcr: boolean | null
  note: string | null
  inType: PipelineModule["inType"] | null
  outType: PipelineModule["outType"] | null
  lookupEmbed?: 1
  forkJoin?: string | null
  forkBranches?: { id: string; label: string; modules: Array<ModuleFingerprint | null> }[] | null
}

function moduleForFingerprint(m: PipelineModule): ModuleFingerprint | null {
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
    inType: m.inType ?? null,
    outType: m.outType ?? null,
    // AI : DONE (type-join) — bump example-select cache when context FK lookup-embed lands.
    ...(m.kind === "example-select" ? { lookupEmbed: 1 as const } : {}),
    ...(m.kind === "fork"
      ? {
          forkJoin: m.forkJoin ?? null,
          forkBranches: m.forkBranches?.map((b) => ({
            id: b.id,
            label: b.label,
            modules: b.modules.map(moduleForFingerprint),
          })) ?? null,
        }
      : {}),
    ...(m.kind === "if-else"
      ? {
          ifCondition: m.ifCondition ?? null,
          forkBranches: m.forkBranches?.map((b) => ({
            id: b.id,
            label: b.label,
            modules: b.modules.map(moduleForFingerprint),
          })) ?? null,
        }
      : {}),
  }
}

function fieldForFingerprint(f: ModelField) {
  const field = normalizeModelField(f)
  return {
    id: field.id,
    name: field.name,
    optional: field.optional,
    minItems: field.minItems ?? null,
    maxItems: field.maxItems ?? null,
    minLength: field.minLength ?? null,
    maxLength: field.maxLength ?? null,
    // AI : canonical type — typeExpr wins over legacy type/ref so cache keys track schema edits.
    expr: fieldToTypeExpr(field),
    // AI : description/examples feed LLM JSON Schema via withFieldMeta — must invalidate cache/logs.
    description: field.description?.trim() || null,
    examples: field.examples ?? [],
    negativeExamples: field.negativeExamples ?? [],
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

// AI : sync sha256 hex — useMemo-safe in browser + Node (test sig keys must stay sync).
export function sha256Hex(input: string): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const bytes = new TextEncoder().encode(input)
  const bitLen = bytes.length * 8
  const padLen = ((56 - ((bytes.length + 1) % 64)) + 64) % 64
  const padded = new Uint8Array(bytes.length + 1 + padLen + 8)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, bitLen, false)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19
  const w = new Uint32Array(64)

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3)
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let hh = h7
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + hh) >>> 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("")
}

export type TestSigHash = string

// AI : compact persisted test/pipeline fingerprint — fits api_schemas 128-char cap.
export function hashStableJson(value: unknown): TestSigHash {
  return `testsig_${sha256Hex(stableJson(value)).slice(0, 24)}`
}

export function buildRunConfigPayload(project: Project, model: ModelId | undefined) {
  return {
    // AI : v6 — field examples[] / negativeExamples[] in fingerprint (stale cache when schema hints change).
    v: 6 as const,
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

// AI : browser-side prior-run match — stored fingerprint only (mirrors server findMatchingRun).
export async function findMatchingRunClient(
  runs: PipelineRun[],
  project: Project,
  model: ModelId | undefined,
  inputDocIds: DocId[],
): Promise<PipelineRun | null> {
  const fingerprint = await computeRunFingerprintClient(project, model, inputDocIds)
  return runs.find((r) => r.status === "ok" && r.fingerprint === fingerprint) ?? null
}

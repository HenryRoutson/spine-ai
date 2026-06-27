// AI : pure run fingerprint payload — shared by server dedup and step-cache keying.
import { orderedInputModules } from "@/lib/inference-input"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import {
  DEFAULT_MODEL,
  type DocId,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type Project,
  type StructureModel,
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
  }
}

function modelForFingerprint(m: StructureModel) {
  return {
    id: m.id,
    fields: [...m.fields]
      .map((f) => ({
        id: f.id,
        type: f.type,
        optional: f.optional,
        ref: f.ref ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
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
    v: 2 as const,
    model: resolveRunModel(project, model),
    models: [...project.models].sort((a, b) => a.id.localeCompare(b.id)).map(modelForFingerprint),
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

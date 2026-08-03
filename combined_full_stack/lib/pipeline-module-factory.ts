import type { CustomCodeEntry, ModelId, ModuleId, PipelineModule, StructureModel, StructureModelId } from "@/lib/types"
import { makeCustomCodeEntry } from "@/lib/custom_code_entries"
import { DEFAULT_ASSERT_TS } from "@/lib/assert_steps"
import { DEFAULT_LLM_STEP_COST_LIMIT_CENTS } from "@/lib/llm-cost-limit"
import { CustomCodeLanguage, InputType, ModuleKind, MODULE_META } from "@/lib/types"
import {
  DEFAULT_CHUNK_SIZE,
  resolveMergePolicy,
  syncListOpsStepModule,
} from "@/lib/list-ops-steps"
import { uid } from "@/lib/id"
import { isLlmKind, stepRequiresNote, usesPassthroughStructure } from "@/lib/module-kinds"
import { migrateModuleSpineTypes, patchSpineOutList } from "@/lib/server/spine_types"
import type { TypeExpr } from "@/lib/server/type_expr"

export type ModuleFactoryOpts = {
  id?: ModuleId
  kind: ModuleKind
  label?: string
  note?: string
  inputType?: PipelineModule["inputType"]
  inputNameContains?: string
  inputDescription?: string
  inputMinCount?: number
  inStructureId?: StructureModelId
  outStructureId?: StructureModelId
  outType?: TypeExpr
  emitsList?: boolean
  prompt?: string
  code?: string
  fallbackList?: CustomCodeEntry[]
  model?: ModelId
  costLimitCents?: number
  chunkSize?: number
  chunkOverlap?: number
  chunkTextField?: string
  mergePolicy?: import("@/lib/types").MergePolicy
  mergeCustom?: string
}

// AI : fallback when legacy data omits note on steps that require it.
export function resolveModuleNote(
  kind: ModuleKind,
  note: string | undefined,
  fallbacks?: { label?: string; inputDescription?: string },
): string {
  const trimmed = note?.trim() ?? ""
  if (trimmed) return trimmed
  if (!stepRequiresNote(kind)) return ""
  return fallbacks?.inputDescription?.trim() || fallbacks?.label?.trim() || ""
}

// AI : shared defaults for UI "add step" and pipeline-assistant materialization.
export function createPipelineModule(
  opts: ModuleFactoryOpts,
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule {
  const { kind } = opts
  const isLlm = isLlmKind(kind)
  const defaultModel = models[0]?.id
  const outStructureId =
    usesPassthroughStructure(kind)
      ? opts.outStructureId ?? opts.inStructureId ?? defaultModel
      : opts.outStructureId ?? defaultModel
  const spineList =
    opts.outType != null
      ? opts.outType.kind === "list"
      : opts.emitsList ?? (kind === ModuleKind.Chunk ? true : false)
  const outType =
    opts.outType ??
    (outStructureId
      ? patchSpineOutList({ outStructureId } as PipelineModule, spineList).outType
      : undefined)
  const base = migrateModuleSpineTypes({
    id: opts.id ?? uid<ModuleId>(),
    kind,
    label: opts.label ?? MODULE_META[kind].label,
    note: resolveModuleNote(kind, opts.note, {
      label: opts.label ?? MODULE_META[kind].label,
      inputDescription: opts.inputDescription,
    }),
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    inputType: kind === ModuleKind.Input ? (opts.inputType ?? InputType.Pdf) : undefined,
    inputNameContains: kind === ModuleKind.Input ? opts.inputNameContains?.trim() || undefined : undefined,
    inputDescription: opts.inputDescription?.trim() || undefined,
    inputMinCount: kind === ModuleKind.Input ? opts.inputMinCount : undefined,
    inStructureId: kind !== ModuleKind.Input ? opts.inStructureId ?? defaultModel : undefined,
    outStructureId,
    ...(outType ? { outType } : {}),
    prompt: isLlm ? opts.prompt ?? "" : undefined,
    fallbackList:
      kind === ModuleKind.CustomCode
        ? (opts.fallbackList ?? [makeCustomCodeEntry(CustomCodeLanguage.TypeScript, opts.code ?? "(input) => input")])
        : kind === ModuleKind.Assert
          ? (opts.fallbackList ?? [makeCustomCodeEntry(CustomCodeLanguage.TypeScript, DEFAULT_ASSERT_TS)])
          : undefined,
    chunkSize: kind === ModuleKind.Chunk ? (opts.chunkSize ?? DEFAULT_CHUNK_SIZE) : undefined,
    chunkOverlap: kind === ModuleKind.Chunk ? (opts.chunkOverlap ?? 0) : undefined,
    chunkTextField: kind === ModuleKind.Chunk ? opts.chunkTextField : undefined,
    mergePolicy: kind === ModuleKind.Merge ? (opts.mergePolicy ?? resolveMergePolicy({ kind } as PipelineModule)) : undefined,
    mergeCustom: kind === ModuleKind.Merge ? opts.mergeCustom : undefined,
    model: isLlm ? opts.model ?? globalModel : undefined,
    costLimitCents: isLlm ? opts.costLimitCents ?? DEFAULT_LLM_STEP_COST_LIMIT_CENTS : undefined,
  })
  if (kind === ModuleKind.Chunk || kind === ModuleKind.Merge) {
    return syncListOpsStepModule(base, models)
  }
  return base
}

export function makeModule(
  kind: ModuleKind,
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule {
  return createPipelineModule({ kind }, models, globalModel)
}

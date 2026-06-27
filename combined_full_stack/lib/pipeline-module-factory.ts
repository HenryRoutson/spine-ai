import type { CustomCodeEntry, ModelId, ModuleId, ModuleKind, PipelineModule, StructureModel, StructureModelId } from "@/lib/types"
import { makeCustomCodeEntry } from "@/lib/custom_code_entries"
import { DEFAULT_ASSERT_TS } from "@/lib/assert_steps"
import { MODULE_META } from "@/lib/types"
import { uid } from "@/lib/id"
import { isLlmKind, usesPassthroughStructure } from "@/lib/module-kinds"

export type ModuleFactoryOpts = {
  id?: ModuleId
  kind: ModuleKind
  label?: string
  note?: string
  inputType?: PipelineModule["inputType"]
  inputNameContains?: string
  inputDescription?: string
  inStructureId?: StructureModelId
  outStructureId?: StructureModelId
  outIsList?: boolean
  prompt?: string
  code?: string
  fallbackList?: CustomCodeEntry[]
  model?: ModelId
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
  return {
    id: opts.id ?? uid<ModuleId>(),
    kind,
    label: opts.label ?? MODULE_META[kind].label,
    note: opts.note,
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    inputType: kind === "input" ? (opts.inputType ?? "pdf") : undefined,
    inputNameContains: kind === "input" ? opts.inputNameContains?.trim() || undefined : undefined,
    inputDescription: opts.inputDescription?.trim() || undefined,
    inStructureId: kind !== "input" ? opts.inStructureId ?? defaultModel : undefined,
    outStructureId:
      usesPassthroughStructure(kind)
        ? opts.outStructureId ?? opts.inStructureId ?? defaultModel
        : opts.outStructureId ?? defaultModel,
    outIsList: opts.outIsList,
    prompt: isLlm ? opts.prompt ?? "" : undefined,
    fallbackList:
      kind === "custom-code"
        ? (opts.fallbackList ?? [makeCustomCodeEntry("typescript", opts.code ?? "(input) => input")])
        : kind === "assert"
          ? (opts.fallbackList ?? [makeCustomCodeEntry("typescript", DEFAULT_ASSERT_TS)])
          : undefined,
    model: isLlm ? opts.model ?? globalModel : undefined,
  }
}

export function makeModule(
  kind: ModuleKind,
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule {
  return createPipelineModule({ kind }, models, globalModel)
}

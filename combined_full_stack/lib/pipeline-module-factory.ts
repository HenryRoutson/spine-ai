import type { ModelId, ModuleId, ModuleKind, PipelineModule, StructureModel, StructureModelId } from "@/lib/types"
import { MODULE_META } from "@/lib/types"
import { uid } from "@/lib/id"
import { isLlmKind } from "@/lib/module-kinds"

export type ModuleFactoryOpts = {
  id?: ModuleId
  kind: ModuleKind
  label?: string
  note?: string
  cached?: boolean
  inputType?: PipelineModule["inputType"]
  inputNameContains?: string
  inStructureId?: StructureModelId
  outStructureId?: StructureModelId
  outIsList?: boolean
  prompt?: string
  code?: string
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
    cached: opts.cached ?? true,
    avgMs: 0,
    avgCostCents: 0,
    inputType: kind === "input" ? (opts.inputType ?? "pdf") : undefined,
    inputNameContains: kind === "input" ? opts.inputNameContains?.trim() || undefined : undefined,
    inStructureId: kind !== "input" ? opts.inStructureId ?? defaultModel : undefined,
    outStructureId: kind === "output" ? undefined : opts.outStructureId ?? defaultModel,
    outIsList: opts.outIsList,
    prompt: isLlm ? opts.prompt ?? "" : undefined,
    code: kind === "custom-code" ? opts.code ?? "(input) => input" : undefined,
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

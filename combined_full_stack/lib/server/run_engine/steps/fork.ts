import {
  deriveForkStepTypes,
  flattenPipelineModules,
  joinForkValue,
} from "@/lib/fork-pipeline"
import { compactPreview } from "@/lib/text-preview"
import { materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers"
import { requireLinearInput } from "../context"
import { jsonStringifyStepValue } from "../results"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"
import type { PipelineModule } from "../../types"

// AI : lanes run in runLinearStepsFrom; this join reads shared byLabel after Promise.all.
export async function execForkJoin(
  m: PipelineModule,
  ctx: RunCtx,
  log: RunLogger,
): Promise<ExecResult> {
  const prev = prevModuleFor(flattenPipelineModules(ctx.project.modules), ctx.prevModuleId)
  const synced = deriveForkStepTypes(m, prev, ctx.project.models, ctx.project.typeAliases ?? [])
  const inputData = requireLinearInput(m, ctx)
  const joined = joinForkValue(m, inputData, ctx.byLabel)
  const merged = materializeStepOutput(
    synced.module,
    { ...ctx.project, models: synced.models },
    joined,
    materializeHints(m, ctx),
    prev,
  )
  const out = modelById(synced.models, synced.module.outStructureId)
  log.info(`fork join complete`, { moduleId: m.id, join: m.forkJoin ?? "product", outStructure: out?.name })
  return {
    value: merged,
    preview: `fork → join`,
    json: jsonStringifyStepValue(merged),
    inputPreview: compactPreview(JSON.stringify(inputData), 400),
  }
}

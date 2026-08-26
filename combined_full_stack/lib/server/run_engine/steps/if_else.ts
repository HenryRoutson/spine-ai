import { deriveIfElseStepTypes, flattenPipelineModules } from "@/lib/fork-pipeline"
import { joinIfElseValue } from "@/lib/if-else-pipeline"
import { compactPreview } from "@/lib/text-preview"
import { materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers"
import { requireLinearInput } from "../context"
import { jsonStringifyStepValue } from "../results"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"
import type { PipelineModule } from "../../types"

export async function execIfElseJoin(
  m: PipelineModule,
  ctx: RunCtx,
  log: RunLogger,
): Promise<ExecResult> {
  const prev = prevModuleFor(flattenPipelineModules(ctx.project.modules), ctx.prevModuleId)
  const synced = deriveIfElseStepTypes(m, prev, ctx.project.models)
  const inputData = requireLinearInput(m, ctx)
  const joined = joinIfElseValue(synced.module, inputData, ctx.byLabel)
  const merged = materializeStepOutput(
    synced.module,
    { ...ctx.project, models: synced.models },
    joined,
    materializeHints(m, ctx),
    prev,
  )
  const out = modelById(synced.models, synced.module.outStructureId)
  log.info(`if/else join complete`, { moduleId: m.id, outStructure: out?.name })
  return {
    value: merged,
    preview: `if/else → ${m.ifCondition?.path ?? "condition"}`,
    json: jsonStringifyStepValue(merged),
    inputPreview: compactPreview(JSON.stringify(inputData), 400),
  }
}

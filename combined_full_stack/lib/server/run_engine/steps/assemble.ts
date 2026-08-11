import { materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers"
import { requireLinearInput } from "../context"
import { jsonStringifyStepValue } from "../results"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"
import type { PipelineModule } from "../../types"
import { labelAsStateKey } from "../../pipeline_state"

export async function execAssembleStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx
  const out = modelById(project.models, m.outStructureId)
  if (!out) throw new Error(`assemble step ${m.id} has no output structure`)
  const spine = requireLinearInput(m, ctx)
  const bindings = m.assembleBindings ?? {}
  const value: Record<string, unknown> = {}
  for (const [field, source] of Object.entries(bindings)) {
    if (source.kind === "spine") {
      value[field] = spine
      continue
    }
    const label = labelAsStateKey(source.label)
    if (!(label in ctx.byLabel)) {
      throw new Error(`assemble "${m.label}": state["${label}"] missing`)
    }
    value[field] = ctx.byLabel[label]
  }
  const prev = prevModuleFor(project.modules, ctx.prevModuleId)
  const merged = materializeStepOutput(m, project, value, materializeHints(m, ctx), prev)
  log.info(`assemble zip`, {
    moduleId: m.id,
    fields: Object.keys(bindings),
    outStructure: out.name,
  })
  return {
    value: merged,
    preview: `assembled → {${out.fields.map((f) => `"${f.name}"`).join(", ")}}`,
    json: jsonStringifyStepValue(merged),
  }
}

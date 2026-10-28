import { materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers"
import { requireLinearInput } from "../context"
import { jsonStringifyStepValue } from "../results"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"
import type { PipelineModule } from "../../types"
import { resolveAssembleSourceValue } from "@/lib/assemble-type-expr"

export async function execAssembleStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx
  const out = modelById(project.models, m.outStructureId)
  if (!out) throw new Error(`assemble step ${m.id} has no output structure`)
  const spine = requireLinearInput(m, ctx)
  const bindings = m.assembleBindings ?? {}
  const value: Record<string, unknown> = {}
  for (const [field, source] of Object.entries(bindings)) {
    const resolved = resolveAssembleSourceValue(source, spine, ctx.byLabel)
    if (resolved === undefined) {
      if (source.kind === "state") {
        throw new Error(`assemble "${m.label}": state["${source.label}"] missing`)
      }
      if (source.kind === "path") {
        const from =
          source.from === "spine" ? "spine" : `state["${source.from.label}"]`
        throw new Error(`assemble "${m.label}": path "${source.path}" from ${from} missing`)
      }
    }
    value[field] = resolved
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

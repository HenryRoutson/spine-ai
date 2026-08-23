import { DEFAULT_N8N_TIMEOUT_MS, getN8nNode, missingN8nParams } from "@/lib/n8n-catalog"
import { runN8nPiece } from "@/lib/n8n-run"
import type { PipelineModule } from "../../types"
import { materializeHints, modelById, prevModuleFor, materializeStepOutput } from "../helpers"
import { requireLinearInput } from "../context"
import { jsonStringifyStepValue } from "../results"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"

export async function execN8nStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx
  const out = modelById(project.models, m.outStructureId)
  if (!out) throw new Error(`n8n step ${m.id} has no output structure`)
  const nodeType = m.n8nNodeType?.trim()
  if (!nodeType) throw new Error(`n8n step ${m.label} has no piece type`)
  const entry = getN8nNode(nodeType)
  if (!entry) throw new Error(`unknown n8n piece: ${nodeType}`)
  const missing = missingN8nParams(entry, m.n8nParameters)
  if (missing.length) throw new Error(`n8n piece ${entry.displayName} needs: ${missing.join(", ")}`)
  const input = requireLinearInput(m, ctx)
  const timeoutMs = m.n8nTimeoutMs ?? DEFAULT_N8N_TIMEOUT_MS
  log.info(`n8n piece`, { moduleId: m.id, nodeType, timeoutMs })
  const raw = await runN8nPiece({
    n8nNodeType: nodeType,
    n8nCode: m.n8nCode,
    n8nParameters: m.n8nParameters,
    input,
    timeoutMs,
  })
  const prev = prevModuleFor(project.modules, ctx.prevModuleId)
  const value = materializeStepOutput(m, project, raw, materializeHints(m, ctx), prev)
  return {
    value,
    preview: `${entry.displayName} → ${out.name}`,
    json: jsonStringifyStepValue(value),
    inputPreview: JSON.stringify(input, null, 2),
  }
}

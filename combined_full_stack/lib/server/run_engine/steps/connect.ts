import { getConnectAction, missingConnectParams } from "@/lib/connect-catalog"
import { apRunAction } from "@/lib/server/ap_client"
import { nangoProxy } from "@/lib/server/nango_client"
import { RunSource, type PipelineModule } from "../../types"
import { materializeHints, modelById, prevModuleFor, materializeStepOutput } from "../helpers"
import { requireLinearInput } from "../context"
import { jsonStringifyStepValue } from "../results"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"

export async function execConnectStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx
  const out = modelById(project.models, m.outStructureId)
  if (!out) throw new Error(`connect step ${m.id} has no output structure`)
  const actionId = m.connectActionId?.trim()
  if (!actionId) throw new Error(`connect step ${m.label} has no action`)
  const entry = getConnectAction(actionId)
  if (!entry) throw new Error(`unknown connect action: ${actionId}`)
  const missing = missingConnectParams(entry, m.connectParameters)
  if (missing.length) throw new Error(`${entry.displayName} needs: ${missing.join(", ")}`)
  const input = requireLinearInput(m, ctx)
  const testing = ctx.source === RunSource.Testing
  log.info(`connect`, { moduleId: m.id, actionId, testing, provider: entry.provider, engine: entry.engine })
  let raw: unknown
  if (testing) {
    raw =
      input && typeof input === "object" && !Array.isArray(input)
        ? { ...(input as Record<string, unknown>), ok: true, mocked: true, actionId }
        : { ok: true, mocked: true, actionId, input }
  } else if (entry.auth !== "none" && !m.connectConnectionId?.trim()) {
    throw new Error(`Connect ${entry.displayName} to run this step`)
  } else if (entry.engine === "ap") {
    raw = await apRunAction({
      actionId,
      connectionId: m.connectConnectionId ?? "",
      input,
      parameters: m.connectParameters,
    })
  } else {
    raw = await nangoProxy({
      actionId,
      connectionId: m.connectConnectionId ?? "",
      input,
      parameters: m.connectParameters,
    })
  }
  const prev = prevModuleFor(project.modules, ctx.prevModuleId)
  const value = materializeStepOutput(m, project, raw, materializeHints(m, ctx), prev)
  return {
    value,
    preview: testing ? `${entry.displayName} (test pin)` : `${entry.displayName} → ${out.name}`,
    json: jsonStringifyStepValue(value),
    inputPreview: JSON.stringify(input, null, 2),
  }
}

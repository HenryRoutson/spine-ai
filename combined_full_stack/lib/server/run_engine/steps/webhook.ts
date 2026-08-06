import { callWebhook, webhookCallSpecFromModule } from "@/lib/webhook-step";
import type { PipelineModule } from "../../types";
import { materializeHints, modelById, prevModuleFor, materializeStepOutput } from "../helpers";
import { requireLinearInput } from "../context";
import { jsonStringifyStepValue } from "../results";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

export async function execWebhookStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`webhook step ${m.id} has no output structure`);
  const input = requireLinearInput(m, ctx);
  const spec = webhookCallSpecFromModule(m);
  log.info(`webhook step`, {
    moduleId: m.id,
    method: spec.method,
    includeState: spec.includeState,
    responsePath: spec.responsePath,
    timeoutMs: spec.timeoutMs,
  });
  const raw = await callWebhook(spec, input, ctx.byLabel, process.env);
  const prev = prevModuleFor(project.modules, ctx.prevModuleId);
  const value = materializeStepOutput(m, project, raw, materializeHints(m, ctx), prev);
  return {
    value,
    preview: `webhook → ${out.name}`,
    json: jsonStringifyStepValue(value),
    inputPreview: JSON.stringify(buildWebhookBodyPreview(input, ctx.byLabel, spec.includeState), null, 2),
  };
}

function buildWebhookBodyPreview(
  input: unknown,
  state: Record<string, unknown> | undefined,
  includeState: boolean,
): unknown {
  if (includeState && state) return { input, state };
  return { input };
}

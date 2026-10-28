import { getValueAtPath, runWebhookCall, webhookCallSpecFromModule } from "@/lib/webhook-step";
import { WebhookBodyMode } from "@/lib/types";
import { ingestMediaUrlToClip } from "@/lib/server/ingest_media_url";
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
    bodyMode: spec.bodyMode,
    poll: spec.pollStatusUrlPath,
    ingest: spec.ingestUrlPath,
    responsePath: spec.responsePath,
    timeoutMs: spec.timeoutMs,
  });
  const { terminal, sliced } = await runWebhookCall(spec, input, ctx.byLabel, {
    ...process.env,
    ...ctx.webhookEnv,
  });
  let raw: unknown = sliced;
  if (spec.ingestUrlPath) {
    const mediaUrl = getValueAtPath(terminal, spec.ingestUrlPath);
    if (typeof mediaUrl !== "string" || !mediaUrl.trim()) {
      throw new Error(`webhook ingest: no URL at path "${spec.ingestUrlPath}"`);
    }
    log.info(`webhook ingest media`, { path: spec.ingestUrlPath, type: spec.ingestInputType });
    raw = await ingestMediaUrlToClip(ctx.store, mediaUrl, spec.ingestInputType);
  }
  const prev = prevModuleFor(project.modules, ctx.prevModuleId);
  const value = materializeStepOutput(m, project, raw, materializeHints(m, ctx), prev);
  return {
    value,
    preview: spec.ingestUrlPath ? `webhook → ${out.name} (stored clip)` : `webhook → ${out.name}`,
    json: jsonStringifyStepValue(value),
    inputPreview: JSON.stringify(
      buildWebhookBodyPreview(input, ctx.byLabel, spec.bodyMode !== WebhookBodyMode.Raw && spec.includeState),
      null,
      2,
    ),
  };
}

function buildWebhookBodyPreview(
  input: unknown,
  state: Record<string, unknown> | undefined,
  includeState: boolean,
): unknown {
  if (includeState && state) return { input, state };
  return input;
}

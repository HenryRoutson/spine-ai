import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { inputTypeLabel } from "../../inference-input";
import { inputUsesVisionOcr } from "../types";
import { StructuredResponseError } from "../openrouter_llm";
import { documentContentFrom, documentDocIdFrom, documentFilenameFrom } from "../document_value";
import type { DocId, PipelineModule } from "../types";
import type { StepCacheArtifact } from "../step_cache";
import { materializeHints, materializeStepOutput, modelById, prevModuleFor } from "./helpers";
import type { ExecResult, RunCtx } from "./engine_types";

export function resultFromCache(m: PipelineModule, cached: StepCacheArtifact, ctx: RunCtx): ExecResult {
  const valueDocId =
    cached.docId ??
    (() => {
      const v = cached.value as { doc_id?: DocId } | undefined;
      return v?.doc_id;
    })();
  const docId =
    valueDocId ??
    (m.kind === "input" || m.kind === "quote" ? ctx.sourceDocId : undefined);

  let preview = "(from cache)";
  if (m.kind === "input" && docId) {
    preview = `loaded ${inputTypeLabel(m.inputType)} → ${docId}${inputUsesVisionOcr(m) ? " · OCR" : ""}`;
  } else if (m.kind === "quote" && docId) {
    preview = `linked quote(s) → ${docId}`;
  }

  const json =
    cached.json ??
    (docId && m.kind === "input" ? JSON.stringify({ doc_id: docId }, null, 2) : undefined);

  return {
    value: cached.value,
    preview,
    json,
    docId,
    inputPreview: cached.inputPreview,
    inputPreviewItems: cached.inputPreviewItems,
  };
}

export function failedJsonForStep(m: PipelineModule, ctx: RunCtx, prior?: ExecResult, err?: unknown): string | undefined {
  if (prior?.json) return prior.json;
  if (prior?.value != null) return JSON.stringify(prior.value, null, 2);
  if (err instanceof StructuredResponseError && err.rawJson) {
    try {
      return JSON.stringify(JSON.parse(err.rawJson), null, 2);
    } catch {
      return err.rawJson;
    }
  }
  if (ctx.prevModuleId) {
    const upstream = ctx.outputs.get(ctx.prevModuleId);
    if (upstream != null) return JSON.stringify(upstream, null, 2);
  }
  return undefined;
}

export function failedStepResult(err: unknown, m: PipelineModule, ctx: RunCtx, prior?: ExecResult): ExecResult {
  return {
    value: null,
    preview: (err as Error).message,
    json: failedJsonForStep(m, ctx, prior, err),
    inputPreview: prior?.inputPreview,
    docId: prior?.docId,
    llmCalls: prior?.llmCalls ?? ctx.stepLlmCalls,
  };
}

export function buildHumanReviewResult(value: unknown): ExecResult {
  const count = Array.isArray(value) ? value.length : 1;
  return {
    value,
    preview: `human review approved — passthrough (${count} item${count === 1 ? "" : "s"})`,
    json: JSON.stringify(value, null, 2),
  };
}

export function buildAssertResult(value: unknown): ExecResult {
  const count = Array.isArray(value) ? value.length : 1;
  return {
    value,
    preview: `assert ok — passthrough (${count} item${count === 1 ? "" : "s"})`,
    json: JSON.stringify(value, null, 2),
  };
}

export function buildClientResult(m: PipelineModule, project: { models: import("../types").StructureModel[]; modules?: PipelineModule[] }, ctx: RunCtx, value: unknown): ExecResult {
  const prev = prevModuleFor(ctx.project.modules, ctx.prevModuleId);
  const projectWithModules = { ...project, modules: ctx.project.modules };
  if (m.kind === "transform") {
    const out = modelById(project.models, m.outStructureId);
    const merged = out ? materializeStepOutput(m, projectWithModules, value, materializeHints(m, ctx), prev) : value;
    return { value: merged, preview: "reshaped", json: JSON.stringify(merged, null, 2) };
  }
  const out = modelById(project.models, m.outStructureId);
  const merged = out ? materializeStepOutput(m, projectWithModules, value, materializeHints(m, ctx), prev) : value;
  const entries = customCodeEntriesForModule(m);
  const primary = entries[0];
  return {
    value: merged,
    preview: `custom ${primary?.language ?? "typescript"} fn applied (${primary?.code.split("\n")[0].slice(0, 60) ?? ""})`,
    json: JSON.stringify(merged, null, 2),
  };
}

export function applyInputCacheSideEffects(m: PipelineModule, cached: StepCacheArtifact, ctx: RunCtx): void {
  if (m.kind !== "input" || !inputUsesVisionOcr(m)) return;
  const v = cached.value;
  const first = Array.isArray(v) ? v[0] : v;
  const body = documentContentFrom(first, "");
  if (body) ctx.sourceText = body;
  const docId = documentDocIdFrom(first, { docId: ctx.sourceDocId });
  if (docId) ctx.sourceDocId = docId;
}

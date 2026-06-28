import { invariant } from "@/lib/assert";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { assertEntriesForModule } from "@/lib/assert_steps";
import { ClientStepPendingError, HumanReviewPendingError } from "../../run_checkpoint";
import { wrapListForOutputStructure } from "../../structure";
import { documentContentFrom, documentDocIdFrom, documentFilenameFrom, documentValueFrom } from "../../document_value";
import { collectQuotes, resolveQuotesValue } from "../../quotation";
import type { PipelineModule, StructureModelId } from "../../types";
import { materializeHints, materializeStepOutput, modelById, sourceDocumentBlock } from "../helpers";
import { requireLinearInput } from "../context";
import { buildAssertResult } from "../results";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

export async function execCombineStep(m: PipelineModule, ctx: RunCtx, _log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`combine step ${m.id} has no output structure`);
  const rawInput = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined;
  const newInput = Array.isArray(rawInput) ? rawInput[0] : rawInput;
  const pipelineData = ctx.byModel.get(m.inStructureId as StructureModelId);
  const value: Record<string, unknown> = {};
  const summary: Record<string, unknown> = {};
  const newDocHints = { docId: documentDocIdFrom(newInput), docName: documentFilenameFrom(newInput) };
  for (const f of out.fields) {
    const isDoc = f.type === "document";
    value[f.name] = isDoc
      ? documentValueFrom(newInput, newDocHints, documentContentFrom(newInput))
      : pipelineData ?? [];
    summary[f.name] = isDoc ? documentFilenameFrom(newInput, newDocHints) : Array.isArray(pipelineData) ? `${pipelineData.length} items` : pipelineData;
  }
  const merged = materializeStepOutput(
    m,
    project,
    value,
    materializeHints(m, ctx, newDocHints.docId, documentContentFrom(newInput)),
  );
  return {
    value: merged,
    preview: `merged → {${out.fields.map((f) => `"${f.name}"`).join(", ")}}`,
    json: JSON.stringify(summary, null, 2),
  };
}

export async function execTransformStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  invariant(ctx.prevModuleId, `transform step ${m.id} has no previous module`);
  const input = ctx.outputs.get(ctx.prevModuleId) ?? null;
  const out = modelById(project.models, m.outStructureId);
  let value: unknown = input;

  if (m.code) {
    const entries = customCodeEntriesForModule(m);
    log.info(`transform code — deferring to browser`, {
      moduleId: m.id,
      attempts: entries.length,
      fallbacks: Math.max(0, entries.length - 1),
    });
    throw new ClientStepPendingError(entries, input, ctx.byLabel);
  } else if (out && !m.outIsList && Array.isArray(input)) {
    if (input.length === 1 && m.inStructureId === m.outStructureId) {
      value = input[0];
      log.debug(`transform unwrapped single-item list`, { moduleId: m.id });
    } else {
      value = wrapListForOutputStructure(input, out, m.inStructureId);
      log.debug(`transform wrapped list into output structure`, {
        moduleId: m.id,
        structure: out.name,
        count: input.length,
      });
    }
  }

  const merged = out ? materializeStepOutput(m, project, value, materializeHints(m, ctx)) : value;
  return { value: merged, preview: "reshaped", json: JSON.stringify(merged, null, 2) };
}

export async function execCustomCodeStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const input = (ctx.prevModuleId && ctx.outputs.get(ctx.prevModuleId)) ?? null;
  const entries = customCodeEntriesForModule(m);
  if (!entries.length) {
    log.warn(`custom-code passthrough (no code)`, { moduleId: m.id });
    return { value: input, preview: "custom step passthrough (no code set)", json: JSON.stringify(input, null, 2) };
  }
  log.info(`custom-code — deferring to browser`, {
    moduleId: m.id,
    primaryLanguage: entries[0]!.language,
    attempts: entries.length,
    fallbacks: Math.max(0, entries.length - 1),
  });
  throw new ClientStepPendingError(entries, input, ctx.byLabel);
}

export async function execQuoteStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`quote step ${m.id} has no output structure`);
  if (!ctx.sourceText) {
    throw new Error(`quote step ${m.id} needs source text from an upstream input step`);
  }
  const data = requireLinearInput(m, ctx);
  const isList = !!m.outIsList || Array.isArray(data);
  log.info(`quote step`, {
    moduleId: m.id,
    sourceDocId: ctx.sourceDocId,
    sourceChars: ctx.sourceText.length,
    isList,
  });
  const value = resolveQuotesValue(data, out, project.models, ctx.sourceText, ctx.sourceDocId, isList);
  const linked = collectQuotes(value, [], out, project.models, isList).length;
  const rawJson = JSON.stringify(data, null, 2);
  return {
    value,
    preview: `linked ${linked} quote(s) → ${ctx.sourceDocId}`,
    json: JSON.stringify(value, null, 2),
    inputPreview: `${sourceDocumentBlock(ctx.sourceText, ctx.sourceDocId)}\n\n── RAW EXTRACTS ──\n${rawJson}`,
    docId: ctx.sourceDocId,
  };
}

export async function execOutputStep(m: PipelineModule, ctx: RunCtx, _log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const report = requireLinearInput(m, ctx);
  const structId = m.outStructureId ?? m.inStructureId;
  const name = modelById(project.models, structId)?.name ?? "Output";
  return { value: report, preview: `${name} snapshot`, json: JSON.stringify(report, null, 2) };
}

export async function execAssertStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const input = requireLinearInput(m, ctx);
  const entries = assertEntriesForModule(m);
  if (!entries.length) {
    log.warn(`assert passthrough (no code)`, { moduleId: m.id });
    return buildAssertResult(input);
  }
  log.info(`assert — deferring to browser`, { moduleId: m.id, attempts: entries.length });
  throw new ClientStepPendingError(entries, input, ctx.byLabel);
}

export async function execHumanReviewStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const input = requireLinearInput(m, ctx);
  log.info(`human-review — deferring to inference tab`, { moduleId: m.id });
  throw new HumanReviewPendingError(input);
}

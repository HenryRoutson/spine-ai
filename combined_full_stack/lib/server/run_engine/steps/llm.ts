import { llmStructured } from "../../llm";
// AI : TODO (spec) — dynamicOutputSchema: LLM emits variable structure at runtime then validate (homework grader).
import {
  hasQuoteField,
  llmSchema,
  logDynamicStructureCreated,
  structuredLlmPrompt,
} from "../../structure";
import type { PipelineModule } from "../../types";
import { materializeHints, modelById, sourceDocumentBlock } from "../helpers";
import { requireLinearInput } from "../context";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

function llmCallBudget(ctx: RunCtx, stepLabel: string) {
  if (ctx.stepCostLimitCents == null || ctx.stepBaseCents == null) return {};
  return {
    costLimitCents: ctx.stepCostLimitCents,
    stepBaseCents: ctx.stepBaseCents,
    stepLabel,
  };
}

export async function execLlmStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`llm step ${m.id} has no output structure`);
  const stepModel = m.model ?? ctx.model;
  log.info(`llm step`, { moduleId: m.id, model: stepModel, outStructure: out.name, outIsList: !!m.outIsList });
  const inputData = requireLinearInput(m, ctx);
  const usesSourceDoc = ctx.sourceText && hasQuoteField(out, project.models);
  const context = usesSourceDoc
    ? sourceDocumentBlock(ctx.sourceText, ctx.sourceDocId)
    : `INPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
  const userPrompt = `${m.prompt ?? "Process the input."}\n\n${context}`;
  const schema = llmSchema(out, project.models, !!m.outIsList, project.typeAliases ?? []);
  const prompt = structuredLlmPrompt(userPrompt, schema);
  log.debug(`llm prompt built`, { promptChars: prompt.length, hasQuoteField: hasQuoteField(out, project.models) });
  ctx.reportSub?.({ label: "LLM call", current: 0, total: 1 });
  ctx.stepLlmCalls = [];
  const raw = await llmStructured(
    userPrompt,
    schema,
    { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls, ...llmCallBudget(ctx, m.label) },
    log.child("llm"),
  );
  log.info(`llm response received`, { moduleId: m.id, items: Array.isArray(raw) ? raw.length : 1 });
  if (out.dynamic) logDynamicStructureCreated(log, out, raw, project.models);
  const value = raw;
  const count = Array.isArray(value) ? value.length : 1;
  return {
    value,
    preview: `${count} ${out.name} item(s) produced`,
    json: JSON.stringify(value, null, 2),
    inputPreview: prompt,
    docId: usesSourceDoc ? ctx.sourceDocId : undefined,
    llmCalls: ctx.stepLlmCalls,
  };
}

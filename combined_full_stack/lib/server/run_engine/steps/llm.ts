import { llmStructured } from "../../llm";
import { deferBrowserLlmIfNeeded } from "../defer_browser_llm";
// AI : TODO (spec) — dynamicOutputSchema: LLM emits variable structure at runtime then validate (homework grader).
import {
  hasQuoteField,
  llmSchema,
  logDynamicStructureCreated,
  structuredLlmPrompt,
} from "../../structure";
import { withStructurePrompt } from "@/lib/schema-derived";
import { stepEmitsList } from "../../type_expr";
import type { PipelineModule } from "../../types";
import { llmCallBudget, materializeHints, modelById, sourceDocumentBlock } from "../helpers";
import { requireLinearInput } from "../context";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

export async function execLlmStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`llm step ${m.id} has no output structure`);
  const stepModel = m.model ?? ctx.model;
  log.info(`llm step`, { moduleId: m.id, model: stepModel, outStructure: out.name, emitsList: stepEmitsList(m) });
  const inputData = requireLinearInput(m, ctx);
  const usesSourceDoc = ctx.sourceText && hasQuoteField(out, project.models);
  const context = usesSourceDoc
    ? sourceDocumentBlock(ctx.sourceText, ctx.sourceDocId)
    : `INPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
  const userPrompt = `${withStructurePrompt(m.prompt, out, project.models)}\n\n${context}`;
  // AI : m.prompt is literal; spine JSON is appended above. {state.X} / {risks} are not interpolated.
  const schema = llmSchema(out, project.models, stepEmitsList(m), project.typeAliases ?? []);
  const prompt = structuredLlmPrompt(userPrompt, schema);
  log.debug(`llm prompt built`, { promptChars: prompt.length, hasQuoteField: hasQuoteField(out, project.models) });

  deferBrowserLlmIfNeeded(
    stepModel,
    ({ providerId, providerModel }) => ({
      providerId,
      providerModel,
      prompts: [prompt],
      jsonMode: true,
      useBatch: false,
      inputPreview: prompt,
    }),
    log,
    "llm — deferring to browser provider",
    { moduleId: m.id },
  );

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
    outputPreviewItems: [{ label: "response", text: JSON.stringify(value, null, 2) }],
    docId: usesSourceDoc ? ctx.sourceDocId : undefined,
    llmCalls: ctx.stepLlmCalls,
  };
}

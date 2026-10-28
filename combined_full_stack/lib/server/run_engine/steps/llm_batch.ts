import { llmBatchStructured } from "../../llm";
import { deferBrowserLlmIfNeeded } from "../defer_browser_llm";
import { llmSchema, structuredLlmPrompt } from "../../structure";
import { labeledJsonPreviewItems } from "@/lib/step-response-preview";
import type { PipelineModule } from "../../types";
import { llmCallBudget, modelById } from "../helpers";
import { requireLinearInput } from "../context";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

function batchInputPreview(
  items: unknown[],
  promptFor: (item: unknown) => string,
): { inputPreview: string; inputPreviewItems?: { label: string; text: string }[] } {
  const samplePrompt = promptFor(items[0]);
  if (items.length <= 1) return { inputPreview: samplePrompt };
  return {
    inputPreview: `${items.length} items · browse prompts with ◀ ▶`,
    inputPreviewItems: items.map((item, i) => ({
      label: `item ${i + 1}/${items.length}`,
      text: promptFor(item),
    })),
  };
}

export async function execLlmBatchStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`llm-batch step ${m.id} has no output structure`);
  const stepModel = m.model ?? ctx.model;
  const data = requireLinearInput(m, ctx);
  const items = Array.isArray(data) ? data : [data];
  log.info(`llm-batch step`, { moduleId: m.id, model: stepModel, itemCount: items.length, outStructure: out.name });
  const schema = llmSchema(out, project.models, false, project.typeAliases ?? []);
  const promptFor = (item: unknown) =>
    structuredLlmPrompt(
      `${m.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(item, null, 2)}`,
      schema,
    );
  const preview = batchInputPreview(items, promptFor);

  deferBrowserLlmIfNeeded(
    stepModel,
    ({ providerId, providerModel }) => ({
      providerId,
      providerModel,
      prompts: items.map((item) => promptFor(item)),
      jsonMode: true,
      useBatch: true,
      ...preview,
    }),
    log,
    "llm-batch — deferring to browser provider",
    { moduleId: m.id, itemCount: items.length },
  );

  ctx.reportSub?.({ label: "LLM calls", current: 0, total: items.length });
  ctx.stepLlmCalls = [];
  const rows = await llmBatchStructured(
    items,
    (item: unknown) => `${m.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(item, null, 2)}`,
    schema,
    { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls, ...llmCallBudget(ctx, m.label) },
    log.child("llm-batch"),
    (current: number, total: number) => ctx.reportSub?.({ label: "LLM calls", current, total }),
  );
  log.info(`llm-batch complete`, { moduleId: m.id, rows: rows.length });
  const value = rows;
  const inputPreview = batchInputPreview(items, promptFor);
  return {
    value,
    preview: `${items.length} items → ${value.length} ${out.name}`,
    json: JSON.stringify(value, null, 2),
    ...inputPreview,
    outputPreviewItems: labeledJsonPreviewItems(rows, inputPreview.inputPreviewItems),
    llmCalls: ctx.stepLlmCalls,
  };
}

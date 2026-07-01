import { llmBatchStructured } from "../../llm";
import { llmSchema, structuredLlmPrompt } from "../../structure";
import type { PipelineModule } from "../../types";
import { modelById } from "../helpers";
import { requireLinearInput } from "../context";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

export async function execLlmBatchStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`llm-batch step ${m.id} has no output structure`);
  const stepModel = m.model ?? ctx.model;
  const data = requireLinearInput(m, ctx);
  const items = Array.isArray(data) ? data : [data];
  log.info(`llm-batch step`, { moduleId: m.id, model: stepModel, itemCount: items.length, outStructure: out.name });
  const schema = llmSchema(out, project.models, false);
  const sampleItem = items[0];
  const promptFor = (item: unknown) =>
    structuredLlmPrompt(
      `${m.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(item, null, 2)}`,
      schema,
    );
  const samplePrompt = promptFor(sampleItem);
  ctx.reportSub?.({ label: "LLM calls", current: 0, total: items.length });
  ctx.stepLlmCalls = [];
  const rows = await llmBatchStructured(
    items,
    (item: unknown) => `${m.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(item, null, 2)}`,
    schema,
    { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls },
    log.child("llm-batch"),
    (current: number, total: number) => ctx.reportSub?.({ label: "LLM calls", current, total }),
  );
  log.info(`llm-batch complete`, { moduleId: m.id, rows: rows.length });
  const value = rows;
  const inputPreviewItems =
    items.length > 1
      ? items.map((item, i) => ({
          label: `item ${i + 1}/${items.length}`,
          text: promptFor(item),
        }))
      : undefined;
  return {
    value,
    preview: `${items.length} items → ${value.length} ${out.name}`,
    json: JSON.stringify(value, null, 2),
    inputPreview:
      items.length > 1 ? `${items.length} items · browse prompts with ◀ ▶` : samplePrompt,
    inputPreviewItems,
    llmCalls: ctx.stepLlmCalls,
  };
}

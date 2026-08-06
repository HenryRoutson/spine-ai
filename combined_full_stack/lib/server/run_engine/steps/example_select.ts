import { z } from "zod";
import { llmBatchStructured } from "../../llm";
import { deferBrowserLlmIfNeeded } from "../defer_browser_llm";
import {
  exampleSelectRelevanceSchema,
  fillExampleSelectPrompt,
} from "@/lib/example-select-relevance";
import {
  DEFAULT_EXAMPLE_SELECT_PROMPT,
  exampleReasonField,
} from "@/lib/example-select";
import type { PipelineModule } from "../../types";
import { llmCallBudget, materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers";
import { requireLinearInput } from "../context";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";
import { structuredLlmPrompt } from "../../structure";

type RelevanceResult = z.infer<typeof exampleSelectRelevanceSchema>;

function readDotPath(value: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = value;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function formatExampleContext(value: unknown, fieldPath?: string): string {
  if (fieldPath?.trim()) {
    const picked = readDotPath(value, fieldPath.trim());
    if (picked !== undefined) {
      return typeof picked === "string" ? picked : JSON.stringify(picked, null, 2);
    }
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function exampleSelectPrompt(template: string, description: string, example: unknown): string {
  return fillExampleSelectPrompt(template, description, example);
}

function batchInputPreview(
  items: unknown[],
  promptFor: (item: unknown) => string,
): { inputPreview: string; inputPreviewItems?: { label: string; text: string }[] } {
  const samplePrompt = promptFor(items[0]);
  if (items.length <= 1) return { inputPreview: samplePrompt };
  return {
    inputPreview: `${items.length} candidates · browse prompts with ◀ ▶`,
    inputPreviewItems: items.map((item, i) => ({
      label: `candidate ${i + 1}/${items.length}`,
      text: promptFor(item),
    })),
  };
}

function enrichExample(item: unknown, reasonField: string, chainOfThought: string): Record<string, unknown> {
  if (item != null && typeof item === "object" && !Array.isArray(item)) {
    return { ...(item as Record<string, unknown>), [reasonField]: chainOfThought };
  }
  return { value: item, [reasonField]: chainOfThought };
}

export async function execExampleSelectStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`example-select step ${m.id} has no output structure`);

  const contextLabel = m.exampleContextLabel?.trim();
  if (!contextLabel) throw new Error(`example-select step ${m.id} needs exampleContextLabel`);

  const contextValue = ctx.byLabel[contextLabel];
  if (contextValue === undefined) {
    throw new Error(`example-select step ${m.id}: no output for context label "${contextLabel}"`);
  }

  const description = formatExampleContext(contextValue, m.exampleContextField);
  const template = m.prompt?.trim() || DEFAULT_EXAMPLE_SELECT_PROMPT;
  const reasonField = exampleReasonField(m);
  const stepModel = m.model ?? ctx.model;

  const data = requireLinearInput(m, ctx);
  let items = Array.isArray(data) ? data : [data];
  const totalCandidates = items.length;
  if (m.examplePreFilterMax != null && m.examplePreFilterMax > 0) {
    items = items.slice(0, m.examplePreFilterMax);
  }

  log.info(`example-select step`, {
    moduleId: m.id,
    model: stepModel,
    candidates: items.length,
    totalCandidates,
    contextLabel,
    reasonField,
    outStructure: out.name,
  });

  const promptFor = (item: unknown) =>
    structuredLlmPrompt(exampleSelectPrompt(template, description, item), exampleSelectRelevanceSchema);
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
    "example-select — deferring to browser provider",
    { moduleId: m.id, itemCount: items.length },
  );

  ctx.reportSub?.({ label: "Relevance checks", current: 0, total: items.length });
  ctx.stepLlmCalls = [];

  const relevanceRows = await llmBatchStructured(
    items,
    (item: unknown) => exampleSelectPrompt(template, description, item),
    exampleSelectRelevanceSchema,
    { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls, ...llmCallBudget(ctx, m.label) },
    log.child("example-select"),
    (current: number, total: number) => ctx.reportSub?.({ label: "Relevance checks", current, total }),
  );

  const kept: Record<string, unknown>[] = [];
  for (let i = 0; i < items.length; i++) {
    const verdict = relevanceRows[i] as RelevanceResult | undefined;
    if (!verdict?.is_relevant) continue;
    kept.push(enrichExample(items[i], reasonField, verdict.chain_of_thought));
  }

  log.info(`example-select complete`, {
    moduleId: m.id,
    kept: kept.length,
    candidates: items.length,
  });

  const prev = prevModuleFor(project.modules, ctx.prevModuleId);
  const value = materializeStepOutput(m, project, kept, materializeHints(m, ctx), prev);

  return {
    value,
    preview: `${totalCandidates} candidates → ${kept.length} selected · ${out.name}`,
    json: JSON.stringify(value, null, 2),
    ...batchInputPreview(items, promptFor),
    llmCalls: ctx.stepLlmCalls,
  };
}

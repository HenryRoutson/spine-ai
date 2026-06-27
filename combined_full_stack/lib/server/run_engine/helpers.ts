import { isLlmKind } from "@/lib/module-kinds";
import { failuresFromLlmCalls } from "@/lib/llm-distribution";
import type { JobLogEntry } from "@/lib/run-types";
import { MAX_STEP_LOGS } from "../log_limits";
import { materializeToModel } from "../structure";
import {
  DEFAULT_VISION_DOC_PARSE_MODEL,
  inputUsesVisionOcr,
  type DocId,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type RunFailureRecord,
  type RunStepStatus,
  type StructureModel,
  type StructureModelId,
} from "../types";
import type { ExecResult, MaterializeHints, RunCtx, RunLogger } from "./engine_types";

export function modelById(models: StructureModel[], id?: StructureModelId): StructureModel | undefined {
  return models.find((m) => m.id === id);
}

export function sourceDocumentBlock(sourceText: string, docId: DocId, maxChars = 2400): string {
  const body =
    sourceText.length > maxChars ? `${sourceText.slice(0, maxChars)}\n… (${sourceText.length - maxChars} more chars)` : sourceText;
  return `SOURCE DOCUMENT (${docId}, ${sourceText.length} chars):\n${body}`;
}

export function materializeHints(m: PipelineModule, ctx: RunCtx, docId?: DocId, sourceText?: string): MaterializeHints {
  return {
    docId: docId ?? ctx.sourceDocId,
    label: m.label,
    note: m.note,
    sourceText: sourceText ?? ctx.sourceText,
  };
}

export function materializeStepOutput(
  m: PipelineModule,
  project: { models: StructureModel[] },
  partial: unknown,
  hints: MaterializeHints,
): unknown {
  const out = modelById(project.models, m.outStructureId);
  if (!out) return partial;
  const isList = m.outIsList || m.kind === "llm-batch";
  if (isList) {
    const items = Array.isArray(partial) ? partial : partial == null ? [] : [partial];
    return items.map((item) => materializeToModel(item, out, project.models, hints));
  }
  return materializeToModel(partial, out, project.models, hints);
}

export function stepFailuresFor(
  result: ExecResult,
  status: RunStepStatus,
  extra?: RunFailureRecord[],
): RunFailureRecord[] | undefined {
  const merged = [...(extra ?? []), ...failuresFromLlmCalls(result.llmCalls, status !== "error")];
  return merged.length ? merged : undefined;
}

export function stepServerLogs(logs: JobLogEntry[], moduleId: ModuleId): JobLogEntry[] | undefined {
  const scoped = logs.filter((l) => l.moduleId === moduleId);
  if (!scoped.length) return undefined;
  return scoped.length <= MAX_STEP_LOGS ? scoped : scoped.slice(-MAX_STEP_LOGS);
}

export function recordStepModel(m: PipelineModule, globalModel: ModelId): ModelId | undefined {
  if (isLlmKind(m.kind)) return m.model ?? globalModel;
  if (inputUsesVisionOcr(m)) return m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
  return undefined;
}

export function applyModuleSideEffects(m: PipelineModule, ctx: RunCtx, store: import("../store").Store, log: RunLogger): void {
  if (m.kind !== "input") return;
  const docIds = ctx.inputByModule.get(m.id) ?? [];
  const docId = docIds[0];
  const content = docId ? store.docContent(docId) ?? "" : "";
  log.info(`input module side effects`, { docId, docCount: docIds.length, cached: true });
  if (!ctx.sourceText && content) {
    ctx.sourceText = content;
    ctx.sourceDocId = docId ?? ("none" as DocId);
  }
}

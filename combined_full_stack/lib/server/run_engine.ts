// AI : TODO refactor — ~1.4k lines; split into lib/server/steps/{input,doc-to-text,llm,...}.ts
// AI : with thin orchestration (runPipeline / resumeRunPipeline / execModule switch).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import { readStepCache, writeStepCache, type StepCacheArtifact } from "./step_cache";
import { runLogger } from "./server_logger";
import { fileWriteHelper } from "./file_write_helper";
import { llmBatchStructured, llmStructured } from "./llm";
import { docToTextViaLlm } from "./doc_to_text";
import { assertInputMatchesDescription, InputDescriptionRejectedError, shouldCheckInputDescription, type InputDescriptionCheckListItem } from "./input_description_check";
import { StructuredResponseError } from "./openrouter_llm";
import { collectQuotes, resolveQuotesValue } from "./quotation";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { assertEntriesForModule } from "@/lib/assert_steps";
import { unknownProject } from "./api-errors";
import { ClientStepPendingError, PipelinePausedError, type RunCheckpoint } from "./run_checkpoint";
import { type LiveStep, progressHtml, runToHtml } from "./logging";
import {
  hasQuoteField,
  llmSchema,
  logDynamicStructureCreated,
  materializeInputDocument,
  materializeToModel,
  structuredLlmPrompt,
  validateStepOutput,
  wrapListForOutputStructure,
} from "./structure";
import {
  documentContentFrom,
  documentDocIdFrom,
  documentFilenameFrom,
  documentValueFrom,
} from "./document_value";
import type { Store } from "./store";
import { uid } from "../id";
import { buildRunInputDocIds, computeRunFingerprint, stepCacheKey } from "./run_fingerprint";
import {
  docMatchesInputModule,
  flattenInputDocIdsFromByModule,
  inputDocsByModuleFromFlat,
  inputMinCountForModule,
  inputTypeLabel,
  isMultiDocInputModule,
  orderedInputModules,
} from "../inference-input";
import { isLlmKind } from "@/lib/module-kinds";
import { failuresFromLlmCalls } from "@/lib/llm-distribution";
import { compactPreview } from "@/lib/text-preview";
import { computeInvalid, migrateProjectModules, stepEmits } from "./validity";
import { UsageLedger } from "./usage";
import {
  DEFAULT_MODEL,
  DEFAULT_INPUT_CHECK_MODEL,
  DEFAULT_VISION_DOC_PARSE_MODEL,
  docParseModeForModule,
  type DocId,
  type InputDescriptionCheckResult,
  type LlmCallRecord,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type PipelineRun,
  type Project,
  type ProjectId,
  type RunFingerprint,
  type RunFailureRecord,
  type RunId,
  type RunStep,
  type RunStepStatus,
  type StructureModel,
  type StructureModelId,
} from "./types";
import type { JobLogEntry, PipelineState, StepProgress, StepSubProgress } from "@/lib/run-types";
import { collectLogsDuring, withStepModuleContext } from "./job_log_sink";
import { MAX_STEP_LOGS } from "./log_limits";

export type { StepProgress, StepSubProgress };
function stepServerLogs(logs: JobLogEntry[], moduleId: ModuleId): JobLogEntry[] | undefined {
  const scoped = logs.filter((l) => l.moduleId === moduleId);
  if (!scoped.length) return undefined;
  return scoped.length <= MAX_STEP_LOGS ? scoped : scoped.slice(-MAX_STEP_LOGS);
}

export interface RunOptions {
  model: ModelId; // global model (per-step `module.model` overrides for llm)
  inputDocIds?: DocId[]; // flat docs in slot order (multi-doc slots are contiguous)
  inputDocsByModule?: Partial<Record<ModuleId, DocId[]>>;
  fingerprint?: RunFingerprint; // AI : precomputed at POST gate — must match persisted run
  fingerprintInputDocIds?: DocId[]; // AI : resolved slot docs paired with fingerprint
  cacheOwnerId?: string; // AI : scopes per-step disk cache to the signed-in user
  onStep?: (p: StepProgress) => void | Promise<void>;
  persist?: boolean; // write run + artifacts to the store/disk (default true)
  liveHtml?: boolean; // write an auto-refreshing progress page during the run (default = persist)
}

// AI : the live progress page — open in a browser while a run executes; it refreshes itself.
export const LIVE_HTML_PATH = join(dataDir(), "live", "run_live.html");

function modelById(models: StructureModel[], id?: StructureModelId): StructureModel | undefined {
  return models.find((m) => m.id === id);
}

function resultFromCache(m: PipelineModule, cached: StepCacheArtifact, ctx: RunCtx): ExecResult {
  const valueDocId =
    cached.docId ??
    (() => {
      const v = cached.value as { doc_id?: DocId } | undefined;
      return v?.doc_id;
    })();
  const docId =
    valueDocId ??
    (m.kind === "input" || m.kind === "doc-to-text" || m.kind === "quote" ? ctx.sourceDocId : undefined);

  let preview = "(from cache)";
  if (m.kind === "input" && docId) {
    preview = `loaded ${inputTypeLabel(m.inputType)} → ${docId}`;
  } else if (m.kind === "doc-to-text" && docId) {
    try {
      const o = cached.json ? (JSON.parse(cached.json) as { purpose?: string }) : {};
      preview = `purpose: ${o.purpose ?? m.label}`;
    } catch {
      preview = `purpose: ${m.label}`;
    }
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
  };
}

function sourceDocumentBlock(sourceText: string, docId: DocId, maxChars = 2400): string {
  const body =
    sourceText.length > maxChars ? `${sourceText.slice(0, maxChars)}\n… (${sourceText.length - maxChars} more chars)` : sourceText;
  return `SOURCE DOCUMENT (${docId}, ${sourceText.length} chars):\n${body}`;
}

interface ExecResult {
  value: unknown;
  preview: string;
  json?: string;
  inputPreview?: string; // AI : full LLM prompt when applicable (for HTML logging)
  docId?: DocId;
  llmCalls?: LlmCallRecord[];
}

// AI : always surface raw upstream / LLM JSON on failure — even when execModule throws mid-step.
function failedJsonForStep(m: PipelineModule, ctx: RunCtx, prior?: ExecResult, err?: unknown): string | undefined {
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

function failedStepResult(err: unknown, m: PipelineModule, ctx: RunCtx, prior?: ExecResult): ExecResult {
  return {
    value: null,
    preview: (err as Error).message,
    json: failedJsonForStep(m, ctx, prior, err),
    inputPreview: prior?.inputPreview,
    docId: prior?.docId,
    llmCalls: prior?.llmCalls ?? ctx.stepLlmCalls,
  };
}

// AI : custom-code steps receive `byLabel` in the browser — prior step outputs keyed by label.
interface RunCtx {
  project: Project;
  store: Store;
  ledger: UsageLedger;
  model: ModelId;
  inputByModule: Map<ModuleId, DocId[]>;
  byLabel: PipelineState;
  byModel: Map<StructureModelId, unknown>;
  outputs: Map<ModuleId, unknown>;
  sourceText: string;
  sourceDocId: DocId;
  prevModuleId?: ModuleId;
  reportSub?: (sub: StepSubProgress) => void;
  stepLlmCalls?: LlmCallRecord[];
  stepExtraFailures?: RunFailureRecord[];
}

function stepFailuresFor(
  result: ExecResult,
  status: RunStepStatus,
  extra?: RunFailureRecord[],
): RunFailureRecord[] | undefined {
  const merged = [...(extra ?? []), ...failuresFromLlmCalls(result.llmCalls, status !== "error")];
  return merged.length ? merged : undefined;
}

function materializeHints(m: PipelineModule, ctx: RunCtx, docId?: DocId, sourceText?: string) {
  return {
    docId: docId ?? ctx.sourceDocId,
    label: m.label,
    note: m.note,
    sourceText: sourceText ?? ctx.sourceText,
  };
}

// AI : cache hits skip execModule — still run queue/source side effects input and doc-to-text rely on.
function applyModuleSideEffects(
  m: PipelineModule,
  ctx: RunCtx,
  store: Store,
  log: ReturnType<typeof runLogger>,
): void {
  if (m.kind === "input") {
    const docIds = ctx.inputByModule.get(m.id) ?? [];
    const docId = docIds[0];
    const content = docId ? store.docContent(docId) ?? "" : "";
    log.info(`input module side effects`, { docId, docCount: docIds.length, cached: true });
    if (!ctx.sourceText && content) {
      ctx.sourceText = content;
      ctx.sourceDocId = docId ?? ("none" as DocId);
    }
    return;
  }
  if (m.kind === "doc-to-text") {
    const upstream = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined;
    const body = documentContentFrom(upstream, ctx.sourceText);
    const docId = documentDocIdFrom(upstream, { docId: ctx.sourceDocId }) ?? ctx.sourceDocId;
    ctx.sourceText = body;
    ctx.sourceDocId = docId;
  }
}

function serializeCtx(ctx: RunCtx): RunCheckpoint["ctx"] {
  return {
    inputByModule: Object.fromEntries(ctx.inputByModule) as Record<ModuleId, DocId[]>,
    byLabel: ctx.byLabel,
    outputs: Object.fromEntries(ctx.outputs) as Record<ModuleId, unknown>,
    byModel: Object.fromEntries(ctx.byModel) as Record<StructureModelId, unknown>,
    sourceText: ctx.sourceText,
    sourceDocId: ctx.sourceDocId,
    prevModuleId: ctx.prevModuleId,
  };
}

function restoreCtx(project: Project, store: Store, ledger: UsageLedger, model: ModelId, snap: RunCheckpoint["ctx"]): RunCtx {
  const legacyQueue = (snap as { inputQueue?: DocId[] }).inputQueue;
  const inputByModule =
    snap.inputByModule && Object.keys(snap.inputByModule).length
      ? new Map(Object.entries(snap.inputByModule) as [ModuleId, DocId[]][])
      : legacyQueue?.length
        ? new Map(orderedInputModules(project.modules).map((m, i) => [m.id, legacyQueue[i] ? [legacyQueue[i]!] : []]))
        : new Map<ModuleId, DocId[]>();
  return {
    project,
    store,
    ledger,
    model,
    inputByModule,
    byLabel: snap.byLabel ?? {},
    byModel: new Map(Object.entries(snap.byModel) as [StructureModelId, unknown][]),
    outputs: new Map(Object.entries(snap.outputs) as [ModuleId, unknown][]),
    sourceText: snap.sourceText,
    sourceDocId: snap.sourceDocId,
    prevModuleId: snap.prevModuleId,
  };
}

function persistCustomCodeArtifacts(runId: string, m: PipelineModule): void {
  if (m.kind !== "custom-code" && m.kind !== "assert" && !(m.kind === "transform" && m.code?.trim())) return;
  const entries = customCodeEntriesForModule(m);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const ext = e.language === "python" ? "py" : "ts";
    const suffix = i === 0 ? "code" : `fallback_${i}`;
    fileWriteHelper(join(dataDir(), "runs", runId), `${m.id}_${suffix}`, ext, e.code);
  }
}

function buildAssertResult(value: unknown): ExecResult {
  const count = Array.isArray(value) ? value.length : 1;
  return {
    value,
    preview: `assert ok — passthrough (${count} item${count === 1 ? "" : "s"})`,
    json: JSON.stringify(value, null, 2),
  };
}

function buildClientResult(m: PipelineModule, project: Project, ctx: RunCtx, value: unknown): ExecResult {
  if (m.kind === "transform") {
    const out = modelById(project.models, m.outStructureId);
    const merged = out ? materializeStepOutput(m, project, value, materializeHints(m, ctx)) : value;
    return { value: merged, preview: "reshaped", json: JSON.stringify(merged, null, 2) };
  }
  const out = modelById(project.models, m.outStructureId);
  const merged = out ? materializeStepOutput(m, project, value, materializeHints(m, ctx)) : value;
  const entries = customCodeEntriesForModule(m);
  const primary = entries[0];
  return {
    value: merged,
    preview: `custom ${primary?.language ?? "typescript"} fn applied (${primary?.code.split("\n")[0].slice(0, 60) ?? ""})`,
    json: JSON.stringify(merged, null, 2),
  };
}

function materializeStepOutput(
  m: PipelineModule,
  project: Project,
  partial: unknown,
  hints: ReturnType<typeof materializeHints>,
): unknown {
  const out = modelById(project.models, m.outStructureId);
  if (!out) return partial;
  // AI : outIsList steps emit arrays — materialize each item, not the array as one model row.
  const isList = m.outIsList || m.kind === "llm-batch";
  if (isList) {
    const items = Array.isArray(partial) ? partial : partial == null ? [] : [partial];
    return items.map((item) => materializeToModel(item, out, project.models, hints));
  }
  return materializeToModel(partial, out, project.models, hints);
}

// AI : strict linear spine — each step reads only the previous step's value, not stale byModel hits.
function requireLinearInput(m: PipelineModule, ctx: RunCtx): unknown {
  const prev = ctx.prevModuleId ? ctx.project.modules.find((x) => x.id === ctx.prevModuleId) : undefined;
  const upstream = stepEmits(prev);
  if (m.inStructureId !== upstream) {
    throw new Error(
      `step "${m.label}" expects ${m.inStructureId ?? "?"} but previous step emits ${upstream ?? "nothing"}`,
    );
  }
  if (!ctx.prevModuleId) throw new Error(`step "${m.label}" has no previous step`);
  return ctx.outputs.get(ctx.prevModuleId);
}

type StepInputForCheck = {
  value: unknown;
  vision?: { store: Store; docId: DocId; docName: string };
  items?: InputDescriptionCheckListItem[];
};

// AI : resolve what will enter a step — raw docs for input steps, upstream output for everything else.
function resolveStepInputForCheck(m: PipelineModule, ctx: RunCtx, store: Store): StepInputForCheck {
  if (m.kind === "input") {
    const docIds = ctx.inputByModule.get(m.id) ?? [];
    const items = docIds.map((docId) => {
      const doc = store.docs().find((d) => d.id === docId);
      return documentValueFrom(
        undefined,
        { docId, docName: doc?.name },
        store.docContent(docId) ?? "",
      );
    });
    const first = items[0];
    const firstDocId = docIds[0];
    const listItems: InputDescriptionCheckListItem[] | undefined =
      items.length > 1
        ? items.map((item, i) => {
            const docId = docIds[i]!;
            const docName = store.docs().find((d) => d.id === docId)?.name;
            const rec = item as Record<string, unknown>;
            const label =
              (typeof rec.filename === "string" && rec.filename) || docName || `doc ${i + 1}`;
            return {
              value: item,
              vision: { store, docId, docName: label },
              label,
            };
          })
        : undefined;
    return {
      value: items.length === 1 ? first : items,
      vision:
        items.length === 1 && firstDocId
          ? { store, docId: firstDocId, docName: documentFilenameFrom(first, { docId: firstDocId }) }
          : undefined,
      items: listItems,
    };
  }
  if (m.kind === "combine") {
    const rawInput = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined;
    const newInput = Array.isArray(rawInput) ? rawInput[0] : rawInput;
    const pipelineData = ctx.byModel.get(m.inStructureId as StructureModelId);
    return { value: { newDocument: newInput, pipelineState: pipelineData } };
  }
  if (ctx.prevModuleId) {
    return { value: requireLinearInput(m, ctx) };
  }
  return { value: undefined };
}

async function execModule(m: PipelineModule, ctx: RunCtx, log: ReturnType<typeof runLogger>): Promise<ExecResult> {
  const { project, store } = ctx;
  log.debug(`execModule start`, { moduleId: m.id, kind: m.kind, label: m.label });
  switch (m.kind) {
    case "input": {
      const docIds = ctx.inputByModule.get(m.id) ?? [];
      const min = inputMinCountForModule(m);
      if (docIds.length < min) {
        throw new Error(`input "${m.label}" needs at least ${min} document(s), got ${docIds.length}`);
      }
      const multi = isMultiDocInputModule(m) || docIds.length > 1;
      log.info(`input module loaded doc(s)`, { moduleId: m.id, docCount: docIds.length, multi, useOcr: !!m.useOcr });
      if (m.useOcr) ctx.stepLlmCalls = [];
      let lastOcr: { model: string; fromVisionCache: boolean } | undefined;

      const materializeDoc = async (docId: DocId, first: boolean) => {
        let content = store.docContent(docId) ?? "";
        if (m.useOcr) {
          const stepModel = m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
          const ocr = await docToTextViaLlm(
            store,
            docId,
            m.note ?? m.label,
            m.prompt,
            { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls },
            content,
            log.child("input-ocr"),
          );
          content = ocr.text;
          lastOcr = { model: ocr.model, fromVisionCache: ocr.fromVisionCache };
        }
        if (first && !ctx.sourceText) {
          ctx.sourceText = content;
          ctx.sourceDocId = docId;
        }
        const docName = store.docs().find((d) => d.id === docId)?.name;
        const hints = { ...materializeHints(m, ctx, docId, content), docName };
        return materializeInputDocument(content, docId, m, project.models, hints);
      };

      if (!multi) {
        const docId = docIds[0]!;
        const value = await materializeDoc(docId, true);
        ctx.outputs.set(m.id, value);
        return {
          value,
          preview: `loaded ${inputTypeLabel(m.inputType)} → ${docId}${m.useOcr ? " · OCR" : ""}`,
          docId,
          inputPreview: m.useOcr
            ? `vision OCR · ${lastOcr?.model ?? m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL}${lastOcr?.fromVisionCache ? " · cached" : ""}`
            : undefined,
          llmCalls: m.useOcr ? ctx.stepLlmCalls : undefined,
        };
      }
      const items = [];
      for (let i = 0; i < docIds.length; i++) {
        items.push(await materializeDoc(docIds[i]!, i === 0));
      }
      const out = modelById(project.models, m.outStructureId);
      const value =
        m.outIsList || !out
          ? items
          : wrapListForOutputStructure(items, out, m.outStructureId);
      ctx.outputs.set(m.id, value);
      return {
        value,
        preview: `loaded ${docIds.length} ${inputTypeLabel(m.inputType)} doc(s)${m.useOcr ? " · OCR" : ""}`,
        docId: docIds[0],
        json: JSON.stringify({ doc_ids: docIds }, null, 2),
        inputPreview: m.useOcr
          ? `vision OCR · ${lastOcr?.model ?? m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL}${lastOcr?.fromVisionCache ? " · cached" : ""}`
          : undefined,
        llmCalls: m.useOcr ? ctx.stepLlmCalls : undefined,
      };
    }

    case "doc-to-text": {
      const upstream = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined;
      const useLlm = docParseModeForModule(m) === "llm";
      const stepModel = m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
      let lastOcr: { model: string; fromVisionCache: boolean } | undefined;

      const transcribeDoc = async (doc: Record<string, unknown>) => {
        const docId = documentDocIdFrom(doc, { docId: ctx.sourceDocId }) ?? ctx.sourceDocId;
        let body = documentContentFrom(doc, ctx.sourceText);
        if (useLlm) {
          const ocr = await docToTextViaLlm(
            store,
            docId,
            m.note ?? m.label,
            m.prompt,
            { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls },
            body,
            log.child("doc-to-text"),
          );
          body = ocr.text;
          lastOcr = { model: ocr.model, fromVisionCache: ocr.fromVisionCache };
        } else {
          ctx.ledger.recordService("doc-parse svc", ctx.model, 1);
        }
        const hints = materializeHints(m, ctx, docId, body);
        return materializeStepOutput(m, project, { ...doc, doc_id: docId, body, content: body }, hints);
      };

      if (Array.isArray(upstream)) {
        if (useLlm) ctx.stepLlmCalls = [];
        log.info(`doc-to-text batch`, { count: upstream.length, llm: useLlm, purpose: m.label });
        const items = [];
        for (const doc of upstream) {
          items.push(await transcribeDoc(doc as Record<string, unknown>));
        }
        const first = items[0] as { body?: string; content?: string; doc_id?: DocId } | undefined;
        const firstBody = documentContentFrom(first, "");
        if (firstBody) ctx.sourceText = firstBody;
        if (first?.doc_id) ctx.sourceDocId = first.doc_id;
        const value = m.outIsList || upstream.length > 1 ? items : items[0];
        const purpose = m.note ?? m.label;
        return {
          value,
          preview: `purpose: ${purpose}${useLlm ? " · LLM OCR" : ""} · ${items.length} doc(s)`,
          json: JSON.stringify({ purpose, count: items.length, mode: useLlm ? "llm" : "parser" }, null, 2),
          docId: first?.doc_id,
          inputPreview: useLlm
            ? `vision OCR · ${lastOcr?.model ?? stepModel}${lastOcr?.fromVisionCache ? " · cached" : ""}`
            : undefined,
          llmCalls: useLlm ? ctx.stepLlmCalls : undefined,
        };
      }

      const single = (upstream ?? { content: ctx.sourceText, doc_id: ctx.sourceDocId }) as Record<string, unknown>;
      if (useLlm) ctx.stepLlmCalls = [];
      const value = await transcribeDoc(single);
      const body = documentContentFrom(value, documentContentFrom(single, ctx.sourceText));
      const docId = documentDocIdFrom(value, { docId: documentDocIdFrom(single, { docId: ctx.sourceDocId }) }) ?? ctx.sourceDocId;
      ctx.sourceText = body;
      ctx.sourceDocId = docId;
      log.info(useLlm ? `doc-to-text LLM` : `doc-to-text`, {
        docId,
        chars: body.length,
        model: useLlm ? stepModel : undefined,
        purpose: m.label,
      });
      const purpose =
        typeof (value as { purpose?: string }).purpose === "string"
          ? (value as { purpose: string }).purpose
          : m.label;
      return {
        value,
        preview: `purpose: ${purpose}${useLlm ? " · LLM OCR" : ""}`,
        json: JSON.stringify({ doc_id: docId, purpose, chars: body.length, mode: useLlm ? "llm" : "parser" }, null, 2),
        docId,
        inputPreview: useLlm
          ? `vision OCR · ${lastOcr?.model ?? stepModel}${lastOcr?.fromVisionCache ? " · cached" : ""}`
          : undefined,
        llmCalls: useLlm ? ctx.stepLlmCalls : undefined,
      };
    }

    case "llm": {
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
      const schema = llmSchema(out, project.models, !!m.outIsList);
      const prompt = structuredLlmPrompt(userPrompt, schema);
      log.debug(`llm prompt built`, { promptChars: prompt.length, hasQuoteField: hasQuoteField(out, project.models) });
      ctx.reportSub?.({ label: "LLM call", current: 0, total: 1 });
      ctx.stepLlmCalls = [];
      const raw = await llmStructured(userPrompt, schema, { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls }, log.child("llm"));
      log.info(`llm response received`, { moduleId: m.id, items: Array.isArray(raw) ? raw.length : 1 });
      if (out.dynamic) logDynamicStructureCreated(log, out, raw, project.models);
      // AI : quote strings stay raw — a downstream Link Quotes step resolves offsets.
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

    case "combine": {
      // AI : merge current pipeline data with the new input — generic: keys come from the auto
      // AI : out structure (`document` field ← the new input, every other field ← pipeline data).
      const out = modelById(project.models, m.outStructureId);
      if (!out) throw new Error(`combine step ${m.id} has no output structure`);
      const rawInput = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined;
      const newInput = Array.isArray(rawInput) ? rawInput[0] : rawInput;
      const pipelineData = ctx.byModel.get(m.inStructureId as StructureModelId);
      // AI : purpose = the upstream input module's label (e.g. "Company Data", "Field Mapping").
      const purpose = project.modules.find((x) => x.id === ctx.prevModuleId)?.label ?? "Document";
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

    case "transform": {
      // AI : deterministic reshape — optional code, else list→object wrap when shapes mismatch.
      const input = ctx.outputs.get(ctx.prevModuleId!) ?? null;
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

    case "custom-code": {
      // AI : custom TS/Python — fallbackList tried in order in the browser.
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

    case "llm-batch": {
      // AI : batch llm — input is a list; one structured call per item; typed list out.
      const out = modelById(project.models, m.outStructureId);
      if (!out) throw new Error(`llm-batch step ${m.id} has no output structure`);
      const stepModel = m.model ?? ctx.model;
      const data = requireLinearInput(m, ctx);
      const items = Array.isArray(data) ? data : [data];
      log.info(`llm-batch step`, { moduleId: m.id, model: stepModel, itemCount: items.length, outStructure: out.name });
      const schema = llmSchema(out, project.models, false); // per-item schema
      const sampleItem = items[0];
      const sampleUser = `${m.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(sampleItem, null, 2)}`;
      const samplePrompt = structuredLlmPrompt(sampleUser, schema);
      ctx.reportSub?.({ label: "LLM calls", current: 0, total: items.length });
      ctx.stepLlmCalls = [];
      const rows = await llmBatchStructured(
        items,
        (item) => `${m.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(item, null, 2)}`,
        schema,
        { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls },
        log.child("llm-batch"),
        (current, total) => ctx.reportSub?.({ label: "LLM calls", current, total }),
      );
      log.info(`llm-batch complete`, { moduleId: m.id, rows: rows.length });
      const value = rows;
      return {
        value,
        preview: `${items.length} items → ${value.length} ${out.name}`,
        json: JSON.stringify(value, null, 2),
        inputPreview:
          items.length > 1
            ? `${samplePrompt}\n\n… same prompt × ${items.length} items`
            : samplePrompt,
        llmCalls: ctx.stepLlmCalls,
      };
    }

    case "quote": {
      const out = modelById(project.models, m.outStructureId);
      if (!out) throw new Error(`quote step ${m.id} has no output structure`);
      if (!ctx.sourceText) {
        throw new Error(`quote step ${m.id} needs source text from an upstream input or doc-to-text step`);
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

    case "output": {
      const report = requireLinearInput(m, ctx);
      const structId = m.outStructureId ?? m.inStructureId;
      const name = modelById(project.models, structId)?.name ?? "Output";
      return { value: report, preview: `${name} snapshot`, json: JSON.stringify(report, null, 2) };
    }

    case "assert": {
      const input = requireLinearInput(m, ctx);
      const entries = assertEntriesForModule(m);
      if (!entries.length) {
        log.warn(`assert passthrough (no code)`, { moduleId: m.id });
        return buildAssertResult(input);
      }
      log.info(`assert — deferring to browser`, { moduleId: m.id, attempts: entries.length });
      throw new ClientStepPendingError(entries, input, ctx.byLabel);
    }
  }
}

// AI : render the final structured report into a human-readable markdown document.
// AI : rows carrying a rule_id keep the curated legal layout; anything else renders generically.
function renderReport(report: unknown, title: string): string {
  if (!Array.isArray(report)) return `# ${title}\n\n${JSON.stringify(report, null, 2)}\n`;
  const rows = report as Array<Record<string, unknown>>;
  const lines = [`# ${title}`, ""];
  for (const r of rows) {
    if (r.rule_id === undefined) {
      lines.push("```json", JSON.stringify(r, null, 2), "```", "");
      continue;
    }
    lines.push(`## ${r.rule_id} — ${r.compliant ? "Compliant" : "Non-compliant"}`);
    if (r.summary) lines.push(`${r.summary}`);
    if (r.rationale) lines.push(`\n${r.rationale}`);
    if (r.liability_usd) lines.push(`\n**Estimated exposure:** $${r.liability_usd}`);
    lines.push("");
  }
  return lines.join("\n");
}

// AI : "LegalConsiderations" → "legal_considerations" (final-artifact filename from its structure).
function snakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function createWriteLive(
  project: Project,
  model: ModelId,
  steps: RunStep[],
  enabled: boolean,
): (runningIndex: number) => void {
  return (runningIndex: number) => {
    if (!enabled) return;
    const display: LiveStep[] = project.modules.map((m, idx) => {
      const done = steps.find((s) => s.moduleId === m.id);
      if (done) {
        const inLabel = isLlmKind(m.kind) ? "prompt" : "in";
        return {
          label: m.label,
          kind: m.kind,
          status: done.status,
          ms: done.ms,
          costCents: done.costCents,
          detail: [`${inLabel}: ${done.inputPreview}`, `out: ${done.outputJson ?? done.outputPreview}`],
        };
      }
      return { label: m.label, kind: m.kind, status: idx === runningIndex ? "running" : "pending", ms: 0, costCents: 0 };
    });
    const at = Math.min(steps.length + 1, project.modules.length);
    mkdirSync(join(dataDir(), "live"), { recursive: true });
    writeFileSync(
      LIVE_HTML_PATH,
      progressHtml(
        `${project.name} — ${runningIndex === -1 ? "run finished" : "running"}`,
        `${model} · step ${at}/${project.modules.length}`,
        display,
        runningIndex !== -1,
      ),
    );
  };
}

function recordStepModel(m: PipelineModule, globalModel: ModelId): ModelId | undefined {
  if (isLlmKind(m.kind)) return m.model ?? globalModel;
  if (m.kind === "input" && m.useOcr) return m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
  if (m.kind === "doc-to-text" && docParseModeForModule(m) === "llm") {
    return m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
  }
  return undefined;
}

type LinearStepParams = {
  project: Project;
  projectId: ProjectId;
  model: ModelId;
  cacheOwnerId: string;
  ctx: RunCtx;
  steps: RunStep[];
  artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[];
  ledger: UsageLedger;
  log: ReturnType<typeof runLogger>;
  opts: Omit<RunOptions, "model"> & { model?: ModelId };
  writeLive: (runningIndex: number) => void;
  runId: RunId;
  startedAt: number;
  inputDocId: DocId;
  fingerprintInputDocIds: DocId[];
  savedCentsAcc: { value: number };
};

// AI : shared linear step loop — runPipeline and resumeRunPipeline both call this.
async function runLinearStepsFrom(
  params: LinearStepParams,
  startIndex: number,
): Promise<"ok" | "error" | "paused"> {
  const { project, projectId, model, cacheOwnerId, ctx, steps, artifacts, ledger, log, opts, writeLive, runId, startedAt, inputDocId, fingerprintInputDocIds, savedCentsAcc } =
    params;

  for (let i = startIndex; i < project.modules.length; i++) {
    const m = project.modules[i];
    await opts.onStep?.({ index: i, total: project.modules.length, moduleId: m.id, label: m.label, status: "running" });
    writeLive(i);

    ctx.reportSub = (sub) => {
      void opts.onStep?.({
        index: i,
        total: project.modules.length,
        moduleId: m.id,
        label: m.label,
        status: "running",
        sub,
      });
    };
    ctx.stepLlmCalls = undefined;
    ctx.stepExtraFailures = undefined;

    const defaultInputPreview =
      i === 0 ? `${inputTypeLabel(m.inputType)} document` : modelById(project.models, m.inStructureId)?.name ?? "Any";
    const beforeCents = ledger.totalCents();
    const t0 = Date.now();

    const { logs: serverLogs, value: stepOutcome } = await withStepModuleContext(m.id, () =>
      collectLogsDuring(async () => {
      let status: RunStepStatus = "ok";
      let result: ExecResult | undefined;

      log.section(`step ${i + 1}/${project.modules.length}: ${m.label}`);
      log.info(`step starting`, { moduleId: m.id, kind: m.kind, cached: !!m.cached, stepModel: m.model ?? model });

      const key = stepCacheKey(cacheOwnerId, projectId, m, m.model ?? model, fingerprintInputDocIds);
      log.debug(`cache lookup`, { key, cachedFlag: !!m.cached });
      const cached = m.cached ? readStepCache(key) : undefined;

      let descriptionCheckCostCents = 0;
      let descriptionCheckLlmCalls: LlmCallRecord[] | undefined;
      let inputDescriptionCheck: InputDescriptionCheckResult | undefined;
      try {
        if (!cached) {
          const inDesc = m.inputDescription?.trim();
          if (inDesc && shouldCheckInputDescription(m)) {
            const descBeforeCents = ledger.totalCents();
            ctx.stepLlmCalls = [];
            try {
              const { value, vision, items } = resolveStepInputForCheck(m, ctx, ctx.store);
              inputDescriptionCheck = await assertInputMatchesDescription(
                m.label,
                inDesc,
                value,
                { model: DEFAULT_INPUT_CHECK_MODEL, ledger, llmCalls: ctx.stepLlmCalls },
                log.child("input-desc"),
                vision,
                items,
              );
            } finally {
              if (ctx.stepLlmCalls.length) {
                descriptionCheckLlmCalls = [...ctx.stepLlmCalls];
                ctx.stepLlmCalls = [];
              }
            }
            descriptionCheckCostCents = +(ledger.totalCents() - descBeforeCents).toFixed(4);
            await opts.onStep?.({
              index: i,
              total: project.modules.length,
              moduleId: m.id,
              label: m.label,
              status: "running",
              inputDescriptionCheck,
              descriptionCheckLlmCalls,
              descriptionCheckCostCents: descriptionCheckCostCents > 0 ? descriptionCheckCostCents : undefined,
            });
          }
        }
        if (cached) {
          applyModuleSideEffects(m, ctx, ctx.store, log);
          // AI : cache hit — OCR text lives in cached.value.body, not upstream (images start empty).
          // AI : cache hit — OCR text lives in cached value, not raw store content.
          if (m.kind === "input" && m.useOcr) {
            const v = cached.value;
            const first = Array.isArray(v) ? v[0] : v;
            const body = documentContentFrom(first, "");
            if (body) ctx.sourceText = body;
            const docId = documentDocIdFrom(first, { docId: ctx.sourceDocId });
            if (docId) ctx.sourceDocId = docId;
          }
          if (m.kind === "doc-to-text" && docParseModeForModule(m) === "llm") {
            const v = cached.value;
            const first = Array.isArray(v) ? v[0] : v;
            const body = documentContentFrom(first, "");
            if (body) ctx.sourceText = body;
            const docId = documentDocIdFrom(first, { docId: ctx.sourceDocId });
            if (docId) ctx.sourceDocId = docId;
          }
          status = "cached";
          savedCentsAcc.value += cached.costCents ?? 0;
          result = resultFromCache(m, cached, ctx);
          log.info(`cache HIT`, { moduleId: m.id, key, savedCents: cached.costCents ?? 0 });
        } else {
          result = await execModule(m, ctx, log);
          const out = modelById(project.models, m.outStructureId);
          if (out) {
            const isList = m.outIsList || m.kind === "llm-batch";
            const rawQuotes = isLlmKind(m.kind) && hasQuoteField(out, project.models);
            const check = validateStepOutput(result.value, out, project.models, { isList, rawQuotes });
            if (!check.ok) {
              const failedJson = result.json ?? JSON.stringify(result.value, null, 2);
              const validationError = check.error ?? "unknown validation error";
              ctx.stepExtraFailures = [
                { kind: "step_output", detail: validationError, recovered: false },
              ];
              log.error(`step output schema validation failed`, {
                failureKind: "step_output",
                structure: out.name,
                detail: validationError,
                failedJsonPreview: compactPreview(failedJson, 500),
              });
              throw new Error(`output failed ${out.name} validation: ${validationError}`);
            }
            const itemCount = isList && Array.isArray(result.value) ? result.value.length : 1;
            log.debug(`validation ok`, { moduleId: m.id, structure: out.name, itemCount });
          }
          if (m.cached) {
            const stepCost = +(ledger.totalCents() - beforeCents).toFixed(4);
            writeStepCache(
              key,
              {
                value: result.value,
                json:
                  result.json ??
                  (result.docId && m.kind === "input"
                    ? JSON.stringify({ doc_id: result.docId }, null, 2)
                    : undefined),
                docId: result.docId,
                inputPreview: result.inputPreview,
                costCents: stepCost,
              },
              {
                projectId,
                moduleId: m.id,
                model: m.model ?? model,
                inputDocIds: fingerprintInputDocIds,
              },
            );
            log.debug(`cache written`, { key, costCents: stepCost });
          }
        }
      } catch (err) {
        if (err instanceof ClientStepPendingError) {
          const primary = err.entries[0];
          throw new PipelinePausedError({
            runId,
            projectId,
            cacheOwnerId,
            inputDocId,
            inputDocIds: fingerprintInputDocIds,
            fingerprintInputDocIds,
            model,
            stepIndex: i,
            startedAt,
            steps: [...steps],
            ctx: serializeCtx(ctx),
            clientStep: {
              moduleId: m.id,
              label: m.label,
              kind: m.kind,
              code: primary?.code ?? "",
              entries: err.entries,
              input: err.input,
              pipelineState: err.pipelineState,
            },
          });
        }
        status = "error";
        if (err instanceof InputDescriptionRejectedError) {
          inputDescriptionCheck = err.check;
        }
        result = failedStepResult(err, m, ctx, result);
        log.error(`step failed`, {
          moduleId: m.id,
          kind: m.kind,
          error: (err as Error).message,
          failedJson: result.json,
          stack: (err as Error).stack,
        });
      }

      log.info(`step finished`, {
        moduleId: m.id,
        status,
        ms: status === "cached" ? 0 : Date.now() - t0,
        costCents: +(status === "cached" ? 0 : ledger.totalCents() - beforeCents).toFixed(4),
        preview: result?.preview,
      });
      return { status, result, descriptionCheckCostCents, descriptionCheckLlmCalls, inputDescriptionCheck };
      }),
    );

    const {
      status,
      result,
      descriptionCheckCostCents = 0,
      descriptionCheckLlmCalls,
      inputDescriptionCheck,
    } = stepOutcome;

    const ms = status === "cached" ? 0 : Date.now() - t0;
    const costCents = status === "cached" ? 0 : ledger.totalCents() - beforeCents;

    if (status !== "error") {
      ctx.outputs.set(m.id, result.value);
      ctx.byLabel[m.label] = result.value;
      const structId = m.outStructureId ?? (m.kind === "output" || m.kind === "assert" ? m.inStructureId : undefined);
      if (structId) ctx.byModel.set(structId, result.value);
      ctx.prevModuleId = m.id;
      artifacts.push({
        moduleId: m.id,
        structure: modelById(project.models, structId),
        value: result.value,
      });
    }

    steps.push({
      moduleId: m.id,
      kind: m.kind,
      label: m.label,
      model: recordStepModel(m, model),
      status,
      ms,
      costCents,
      inputPreview: result.inputPreview ?? defaultInputPreview,
      outputPreview: result.preview,
      outputJson: result.json,
      inputDescription: m.inputDescription?.trim() || undefined,
      inputDescriptionCheck,
      descriptionCheckCostCents: descriptionCheckCostCents > 0 ? descriptionCheckCostCents : undefined,
      descriptionCheckLlmCalls: descriptionCheckLlmCalls?.length ? descriptionCheckLlmCalls : undefined,
      docId: result.docId,
      llmCalls: result.llmCalls?.length ? result.llmCalls : undefined,
      failures: stepFailuresFor(result, status, ctx.stepExtraFailures),
      serverLogs: stepServerLogs(serverLogs, m.id),
    });
    const stepRecord = steps[steps.length - 1]!;
    await opts.onStep?.({
      index: i,
      total: project.modules.length,
      moduleId: m.id,
      label: m.label,
      status,
      outputPreview: stepRecord.outputPreview,
      inputDescriptionCheck: stepRecord.inputDescriptionCheck,
      descriptionCheckLlmCalls: stepRecord.descriptionCheckLlmCalls,
      descriptionCheckCostCents: stepRecord.descriptionCheckCostCents,
    });
    ctx.reportSub = undefined;
    if (status === "error") {
      log.warn(`pipeline aborted after error`, { failedModule: m.id, stepsCompleted: steps.length });
      return "error";
    }
  }
  return "ok";
}

// AI : runPipeline — execute the linear pipeline step-by-step, honour the cache, stream progress.
export async function runPipeline(
  store: Store,
  projectId: ProjectId,
  inputDocId: DocId,
  opts: Omit<RunOptions, "model"> & { model?: ModelId } = {},
): Promise<PipelineRun> {
  const rawProject = store.project(projectId);
  if (!rawProject) throw new Error(unknownProject(projectId));
  const project = migrateProjectModules(rawProject);
  // AI : bug fix — fallback used a hardcoded "qwen-2.5-72b" instead of DEFAULT_MODEL.
  const model = opts.model ?? project.modules.find((m) => m.kind === "llm")?.model ?? DEFAULT_MODEL;
  const persist = opts.persist ?? true;

  const ledger = new UsageLedger();
  const runId = uid<RunId>("run_");
  const log = runLogger(runId);
  const startedAt = Date.now();

  log.section("pipeline start");
  log.info(`runPipeline invoked`, {
    projectId,
    projectName: project.name,
    inputDocId,
    model,
    persist,
    moduleCount: project.modules.length,
  });

  // AI : run button is dark when the pipeline is invalid — refuse to execute, mirror the UI.
  const invalid = computeInvalid(project.modules, project.models);
  if (invalid.size > 0) {
    log.error(`pipeline invalid`, { invalidModules: [...invalid.keys()] });
    throw new Error(`pipeline invalid: ${[...invalid.keys()].join(", ")}`);
  }

  const fingerprintInputDocIds =
    opts.fingerprintInputDocIds ??
    buildRunInputDocIds(store, project, inputDocId, opts.inputDocIds, opts.inputDocsByModule);
  const fingerprint =
    opts.fingerprint ?? computeRunFingerprint(project, model, fingerprintInputDocIds);
  const inputMods = orderedInputModules(project.modules);
  const inputByModuleRecord =
    opts.inputDocsByModule ??
    inputDocsByModuleFromFlat(inputMods, fingerprintInputDocIds);
  log.info(`input queue resolved`, {
    fingerprintInputDocIds,
    fingerprint,
    inputDocsByModule: inputByModuleRecord,
  });

  for (const mod of inputMods) {
    const docIds = inputByModuleRecord[mod.id] ?? [];
    const min = inputMinCountForModule(mod);
    if (docIds.length < min) {
      throw new Error(`input "${mod.label}" needs at least ${min} document(s)`);
    }
    for (const docId of docIds) {
      const doc = store.docs().find((d) => d.id === docId);
      if (doc && !docMatchesInputModule(doc, mod)) {
        const req = mod.inputNameContains?.trim();
        throw new Error(
          req
            ? `input "${mod.label}" requires a filename containing "${req}", got "${doc.name}"`
            : `input "${mod.label}" rejected "${doc.name}" (wrong type for this slot)`,
        );
      }
    }
  }

  const ctx: RunCtx = {
    project,
    store,
    ledger,
    model,
    inputByModule: new Map(Object.entries(inputByModuleRecord) as [ModuleId, DocId[]][]),
    byLabel: {},
    byModel: new Map(),
    outputs: new Map(),
    sourceText: "",
    sourceDocId: inputDocId,
  };

  const steps: RunStep[] = [];
  const artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[] = [];
  const cacheOwnerId = opts.cacheOwnerId ?? "local";
  const savedCentsAcc = { value: 0 };

  const writeLive = createWriteLive(project, model, steps, opts.liveHtml ?? persist);
  await runLinearStepsFrom(
    {
      project,
      projectId,
      model,
      cacheOwnerId,
      ctx,
      steps,
      artifacts,
      ledger,
      log,
      opts,
      writeLive,
      runId,
      startedAt,
      inputDocId,
      fingerprintInputDocIds,
      savedCentsAcc,
    },
    0,
  );

  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  const billedCents = +steps.reduce((a, s) => a + s.costCents, 0).toFixed(4);
  const savedCents = +savedCentsAcc.value.toFixed(4);

  const run: PipelineRun = {
    id: runId,
    startedAt,
    status: steps.some((s) => s.status === "error") ? "error" : "ok",
    totalMs,
    billedCents,
    savedCents,
    model,
    steps,
    inputDocId,
    inputDocIds: fingerprintInputDocIds,
    fingerprint,
  };

  writeLive(-1); // final state, refresh meta dropped

  log.section("pipeline complete");
  log.info(`run summary`, {
    runId,
    status: run.status,
    totalMs,
    billedCents,
    savedCents,
    stepCount: steps.length,
    usageRecords: ledger.all().length,
  });
  log.json("steps", steps.map((s) => ({ moduleId: s.moduleId, kind: s.kind, status: s.status, ms: s.ms, costCents: s.costCents })));
  log.json("usage ledger", ledger.all());
  log.finish(`Run ${runId} ${run.status} — ${totalMs}ms · billed ${billedCents.toFixed(2)}c · saved ${savedCents.toFixed(2)}c`);

  if (persist) {
    log.info(`persisting artifacts`, { artifactCount: artifacts.length });
    persistArtifacts(runId, inputDocId, store, artifacts, project.modules, project.models);
    // AI : save each custom step's code next to its input/output artifact (previous runs).
    for (const m of project.modules) persistCustomCodeArtifacts(runId, m);
    // AI : the same high-level HTML view, archived per run for the Logging tab.
    fileWriteHelper(join(dataDir(), "runs", runId), "run_high_level", "html", runToHtml(run));
    store.addRun(projectId, run);
  }
  return run;
}

// AI : browser POSTs user-code output — server validates and continues the linear run from the paused step.
export type ClientStepResume = { output?: unknown; error?: string };

export async function resumeRunPipeline(
  store: Store,
  checkpoint: RunCheckpoint,
  clientStep: ClientStepResume,
  opts: Omit<RunOptions, "model"> & { model?: ModelId; clientLogs?: import("@/lib/run-types").JobLogEntry[] } = {},
): Promise<PipelineRun> {
  const rawProject = store.project(checkpoint.projectId);
  if (!rawProject) throw new Error(unknownProject(checkpoint.projectId));
  const project = migrateProjectModules(rawProject);

  const model = checkpoint.model;
  const persist = opts.persist ?? true;
  const ledger = new UsageLedger();
  const log = runLogger(checkpoint.runId);
  const fingerprintInputDocIds =
    checkpoint.fingerprintInputDocIds ??
    checkpoint.inputDocIds ??
    flattenInputDocIdsFromByModule(
      orderedInputModules(project.modules),
      checkpoint.ctx.inputByModule ?? {},
    );
  const fingerprint = computeRunFingerprint(project, model, fingerprintInputDocIds);
  const ctx = restoreCtx(project, store, ledger, model, checkpoint.ctx);
  const steps: RunStep[] = [...checkpoint.steps];
  const artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[] = steps
    .filter((s) => s.status !== "error")
    .flatMap((s) => {
      const value = ctx.outputs.get(s.moduleId);
      if (value === undefined) return [];
      const m = project.modules.find((x) => x.id === s.moduleId);
      const structId = m?.outStructureId ?? (m?.kind === "output" || m?.kind === "assert" ? m.inStructureId : undefined);
      return [{ moduleId: s.moduleId, structure: modelById(project.models, structId), value }];
    });

  const m = project.modules[checkpoint.stepIndex];
  if (!m) throw new Error(`resume: invalid step index ${checkpoint.stepIndex}`);

  const writeLive = createWriteLive(project, model, steps, opts.liveHtml ?? persist);
  const cacheOwnerId = opts.cacheOwnerId ?? checkpoint.cacheOwnerId ?? "local";
  const savedCentsAcc = {
    value: steps.filter((s) => s.status === "cached").reduce((a, s) => a + s.costCents, 0),
  };

  const t0 = Date.now();
  const beforeCents = ledger.totalCents();
  const defaultInputPreview = modelById(project.models, m.inStructureId)?.name ?? "Any";

  const { logs: serverLogs, value: stepOutcome } = await withStepModuleContext(m.id, () =>
    collectLogsDuring(async () => {
    let status: RunStepStatus = "ok";
    let result: ExecResult | undefined;

    log.section(`step ${checkpoint.stepIndex + 1}/${project.modules.length}: ${m.label}`);
    log.info(`client step resume`, { moduleId: m.id, kind: m.kind });

    for (const entry of opts.clientLogs ?? []) {
      log[entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "info"](entry.line, {
        moduleId: m.id,
        tag: entry.tag,
      });
    }

    try {
      if (clientStep.error) throw new Error(clientStep.error);
      result = m.kind === "assert" ? buildAssertResult(clientStep.output) : buildClientResult(m, project, ctx, clientStep.output);
      const out = modelById(project.models, m.outStructureId);
      if (out) {
        const isList = m.outIsList || m.kind === "llm-batch";
        const check = validateStepOutput(result.value, out, project.models, { isList, rawQuotes: false });
        if (!check.ok) {
          const validationError = check.error ?? "unknown validation error";
          ctx.stepExtraFailures = [{ kind: "step_output", detail: validationError, recovered: false }];
          log.error(`step output schema validation failed`, {
            failureKind: "step_output",
            structure: out.name,
            detail: validationError,
          });
          throw new Error(`output failed ${out.name} validation: ${validationError}`);
        }
      }
    } catch (err) {
      status = "error";
      result = failedStepResult(err, m, ctx, result);
      log.error(`client step failed`, { moduleId: m.id, error: (err as Error).message, failedJson: result.json });
    }

    log.info(`step finished`, {
      moduleId: m.id,
      status,
      ms: Date.now() - t0,
      costCents: +(ledger.totalCents() - beforeCents).toFixed(4),
      preview: result?.preview,
    });
    return { status, result };
    }),
  );

  const { status, result } = stepOutcome;

  const ms = Date.now() - t0;
  const costCents = ledger.totalCents() - beforeCents;
  if (status !== "error" && m.cached && result) {
    const key = stepCacheKey(cacheOwnerId, checkpoint.projectId, m, m.model ?? model, fingerprintInputDocIds);
    writeStepCache(
      key,
      {
        value: result.value,
        json: result.json,
        docId: result.docId,
        inputPreview: result.inputPreview,
        costCents: +costCents.toFixed(4),
      },
      {
        projectId: checkpoint.projectId,
        moduleId: m.id,
        model: m.model ?? model,
        inputDocIds: fingerprintInputDocIds,
      },
    );
  }
  if (status !== "error") {
    ctx.outputs.set(m.id, result.value);
    ctx.byLabel[m.label] = result.value;
    const structId = m.outStructureId ?? (m.kind === "output" || m.kind === "assert" ? m.inStructureId : undefined);
    if (structId) ctx.byModel.set(structId, result.value);
    ctx.prevModuleId = m.id;
    artifacts.push({ moduleId: m.id, structure: modelById(project.models, structId), value: result.value });
  }

  steps.push({
    moduleId: m.id,
    kind: m.kind,
    label: m.label,
    model: recordStepModel(m, model),
    status,
    ms,
    costCents,
    inputPreview: defaultInputPreview,
    outputPreview: result.preview,
    outputJson: result.json,
    inputDescription: m.inputDescription?.trim() || undefined,
    llmCalls: result.llmCalls?.length ? result.llmCalls : undefined,
    failures: stepFailuresFor(result, status, ctx.stepExtraFailures),
    serverLogs: stepServerLogs(serverLogs, m.id),
  });
  await opts.onStep?.({ index: checkpoint.stepIndex, total: project.modules.length, moduleId: m.id, label: m.label, status });
  if (status === "error") {
    writeLive(-1);
    const run: PipelineRun = {
      id: checkpoint.runId,
      startedAt: checkpoint.startedAt,
      status: "error",
      totalMs: steps.reduce((a, s) => a + s.ms, 0),
      billedCents: +steps.reduce((a, s) => a + s.costCents, 0).toFixed(4),
      savedCents: 0,
      model,
      steps,
      inputDocId: checkpoint.inputDocId,
      inputDocIds: fingerprintInputDocIds,
      fingerprint,
    };
    if (persist) {
      persistArtifacts(checkpoint.runId, checkpoint.inputDocId, store, artifacts, project.modules, project.models);
      store.addRun(checkpoint.projectId, run);
    }
    return run;
  }

  await runLinearStepsFrom(
    {
      project,
      projectId: checkpoint.projectId,
      model,
      cacheOwnerId,
      ctx,
      steps,
      artifacts,
      ledger,
      log,
      opts,
      writeLive,
      runId: checkpoint.runId,
      startedAt: checkpoint.startedAt,
      inputDocId: checkpoint.inputDocId,
      fingerprintInputDocIds,
      savedCentsAcc,
    },
    checkpoint.stepIndex + 1,
  );

  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  const billedCents = +steps.reduce((a, s) => a + s.costCents, 0).toFixed(4);
  const savedCents = +savedCentsAcc.value.toFixed(4);

  const run: PipelineRun = {
    id: checkpoint.runId,
    startedAt: checkpoint.startedAt,
    status: steps.some((s) => s.status === "error") ? "error" : "ok",
    totalMs,
    billedCents,
    savedCents,
    model,
    steps,
    inputDocId: checkpoint.inputDocId,
    inputDocIds: fingerprintInputDocIds,
    fingerprint,
  };

  writeLive(-1);
  if (persist) {
    persistArtifacts(checkpoint.runId, checkpoint.inputDocId, store, artifacts, project.modules, project.models);
    for (const mod of project.modules) persistCustomCodeArtifacts(checkpoint.runId, mod);
    fileWriteHelper(join(dataDir(), "runs", checkpoint.runId), "run_high_level", "html", runToHtml(run));
    store.addRun(checkpoint.projectId, run);
  }
  return run;
}

// AI : "previous runs" — each step output saved as JSON (with its static zod structure attached),
// AI : plus document_input_latest.txt / timestamped, so the Documents tab can list the history.
function persistArtifacts(
  runId: RunId,
  inputDocId: DocId,
  store: Store,
  artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[],
  modules: PipelineModule[],
  models: StructureModel[],
): void {
  const dir = join(dataDir(), "runs", runId);
  const inputText = store.docContent(inputDocId) ?? "";
  fileWriteHelper(dir, "document_input", "txt", inputText);
  const modById = new Map(modules.map((m) => [m.id, m]));
  for (const a of artifacts) {
    fileWriteHelper(
      dir,
      a.moduleId,
      "json",
      JSON.stringify({ structure: a.structure, value: a.value }, null, 2),
    );
  }
  // AI : quotes index — schema-guided collection when structure is known, else shape fallback.
  const quotes = [
    ...new Map(
      artifacts
        .flatMap((a) => {
          const mod = modById.get(a.moduleId);
          const isList = !!mod?.outIsList || mod?.kind === "llm-batch";
          return collectQuotes(a.value, [], a.structure, models, isList);
        })
        .map((q) => [q.href, q]),
    ).values(),
  ];
  if (quotes.length) fileWriteHelper(dir, "quotes", "json", JSON.stringify(quotes, null, 2));
  // AI : each output step emits a readable markdown snapshot — pipelines may have several.
  const outputIds = new Set(modules.filter((m) => m.kind === "output").map((m) => m.id));
  for (const a of artifacts.filter((x) => outputIds.has(x.moduleId))) {
    const name = a.structure?.name ?? "Output";
    fileWriteHelper(
      dir,
      `${a.moduleId}_${snakeCase(name)}`,
      "md",
      renderReport(a.value, name.replace(/([a-z0-9])([A-Z])/g, "$1 $2")),
    );
  }
}

// AI : moduleMetrics moved to billing.ts — it is pure (no fs) and the client Pipeline tab
// AI : imports it directly; this module stays Node-only.
export { moduleMetrics } from "./billing";

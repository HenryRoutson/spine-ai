import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import { runLogger } from "./server_logger";
import { fileWriteHelper } from "./file_write_helper";
import { llmBatchStructured, llmStructured } from "./llm";
import { StructuredResponseError } from "./openrouter_llm";
import { collectQuotes, resolveQuotesValue } from "./quotation";
import { ClientStepPendingError, PipelinePausedError, type RunCheckpoint } from "./run_checkpoint";
import { type LiveStep, progressHtml, runToHtml } from "./logging";
import {
  hasQuoteField,
  llmSchema,
  materializeToModel,
  structuredLlmPrompt,
  validateStepOutput,
  wrapListForOutputStructure,
} from "./structure";
import type { Store } from "./store";
import { uid } from "../id";
import { buildRunInputDocIds, computeRunFingerprint, stepCacheKey } from "./run_fingerprint";
import { docMatchesInputModule, inputTypeLabel, orderedInputModules } from "../inference-input";
import { isLlmKind } from "@/lib/module-kinds";
import { computeInvalid, migrateProjectModules, stepEmits } from "./validity";
import { UsageLedger } from "./usage";
import {
  DEFAULT_MODEL,
  type DocId,
  type LlmCallRecord,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type PipelineRun,
  type Project,
  type ProjectId,
  type RunFingerprint,
  type RunId,
  type RunStep,
  type RunStepStatus,
  type StructureModel,
  type StructureModelId,
} from "./types";
import type { StepProgress, StepSubProgress } from "@/lib/run-types";

export type { StepProgress, StepSubProgress };

export interface RunOptions {
  model: ModelId; // global model (per-step `module.model` overrides for llm)
  inputDocIds?: DocId[]; // docs assigned to `input` modules in order; [0] is the dropped doc
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

// AI : per-step cache keyed by owner+project+module+all input slots+model+module config — honours `module.cached`.
const cacheDir = join(dataDir(), "cache");

type StepCacheArtifact = {
  value: unknown;
  json?: string;
  docId?: DocId;
  inputPreview?: string;
  costCents?: number;
};

function readCache(key: string): StepCacheArtifact | undefined {
  const path = join(cacheDir, key);
  if (!existsSync(path)) return undefined;
  const raw = JSON.parse(readFileSync(path, "utf8")) as StepCacheArtifact;
  if (raw && typeof raw === "object" && "value" in raw) return raw;
  return undefined;
}

function writeCache(key: string, artifact: StepCacheArtifact): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, key), JSON.stringify(artifact, null, 2), "utf8");
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

function preview(s: string, n = 160): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
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

// AI : the per-kind executors. Real where possible; placeholders are clearly marked.
interface RunCtx {
  project: Project;
  store: Store;
  ledger: UsageLedger;
  model: ModelId;
  inputQueue: DocId[];
  // flowing state shared across the linear pipeline
  byModel: Map<StructureModelId, unknown>;
  outputs: Map<ModuleId, unknown>;
  sourceText: string;
  sourceDocId: DocId;
  prevModuleId?: ModuleId;
  reportSub?: (sub: StepSubProgress) => void;
  stepLlmCalls?: LlmCallRecord[];
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
    const docId = ctx.inputQueue.shift();
    const content = docId ? store.docContent(docId) ?? "" : "";
    log.info(`input module side effects`, { docId, chars: content.length, queueRemaining: ctx.inputQueue.length, cached: true });
    if (!ctx.sourceText) {
      ctx.sourceText = content;
      ctx.sourceDocId = docId ?? ("none" as DocId);
    }
    return;
  }
  if (m.kind === "doc-to-text") {
    const upstream = (ctx.prevModuleId && ctx.outputs.get(ctx.prevModuleId)) as { doc_id?: DocId; body?: string } | undefined;
    const body = upstream?.body ?? ctx.sourceText;
    const docId = upstream?.doc_id ?? ctx.sourceDocId;
    ctx.sourceText = body;
    ctx.sourceDocId = docId;
  }
}

function serializeCtx(ctx: RunCtx): RunCheckpoint["ctx"] {
  return {
    inputQueue: [...ctx.inputQueue],
    outputs: Object.fromEntries(ctx.outputs) as Record<ModuleId, unknown>,
    byModel: Object.fromEntries(ctx.byModel) as Record<StructureModelId, unknown>,
    sourceText: ctx.sourceText,
    sourceDocId: ctx.sourceDocId,
    prevModuleId: ctx.prevModuleId,
  };
}

function restoreCtx(project: Project, store: Store, ledger: UsageLedger, model: ModelId, snap: RunCheckpoint["ctx"]): RunCtx {
  return {
    project,
    store,
    ledger,
    model,
    inputQueue: [...snap.inputQueue],
    byModel: new Map(Object.entries(snap.byModel) as [StructureModelId, unknown][]),
    outputs: new Map(Object.entries(snap.outputs) as [ModuleId, unknown][]),
    sourceText: snap.sourceText,
    sourceDocId: snap.sourceDocId,
    prevModuleId: snap.prevModuleId,
  };
}

function buildClientResult(m: PipelineModule, project: Project, ctx: RunCtx, value: unknown): ExecResult {
  if (m.kind === "transform") {
    const out = modelById(project.models, m.outStructureId);
    const merged = out ? materializeStepOutput(m, project, value, materializeHints(m, ctx)) : value;
    return { value: merged, preview: "reshaped", json: JSON.stringify(merged, null, 2) };
  }
  return {
    value,
    preview: `custom ts fn applied (${m.code?.split("\n")[0].slice(0, 60) ?? ""})`,
    json: JSON.stringify(value, null, 2),
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

async function execModule(m: PipelineModule, ctx: RunCtx, log: ReturnType<typeof runLogger>): Promise<ExecResult> {
  const { project, store } = ctx;
  log.debug(`execModule start`, { moduleId: m.id, kind: m.kind, label: m.label });
  switch (m.kind) {
    case "input": {
      const docId = ctx.inputQueue.shift();
      const content = docId ? store.docContent(docId) ?? "" : "";
      log.info(`input module loaded doc`, { docId, chars: content.length, queueRemaining: ctx.inputQueue.length });
      // AI : first input is the primary source for quote offsets.
      if (!ctx.sourceText) {
        ctx.sourceText = content;
        ctx.sourceDocId = docId ?? ("none" as DocId);
      }
      const hints = materializeHints(m, ctx, docId, content);
      const value = materializeStepOutput(m, project, { doc_id: docId, body: content }, hints);
      ctx.outputs.set(m.id, value);
      return { value, preview: `loaded ${inputTypeLabel(m.inputType)} → ${docId ?? "(none)"}`, docId };
    }

    case "doc-to-text": {
      // AI : prebuilt parser. Input already carries text (PDF parsed at ingest); annotate purpose.
      const upstream = (ctx.prevModuleId && ctx.outputs.get(ctx.prevModuleId)) as { doc_id?: DocId; body?: string } | undefined;
      const body = upstream?.body ?? ctx.sourceText;
      const docId = upstream?.doc_id ?? ctx.sourceDocId;
      ctx.sourceText = body;
      ctx.sourceDocId = docId;
      // AI : doc parsing is a billable service line (Billing "doc-parse svc"), flat ~1c.
      ctx.ledger.recordService("doc-parse svc", ctx.model, 1);
      log.info(`doc-to-text`, { docId, chars: body.length, purpose: m.label });
      const hints = materializeHints(m, ctx, docId, body);
      const value = materializeStepOutput(m, project, { doc_id: docId, body }, hints);
      const purpose = typeof (value as { purpose?: string }).purpose === "string" ? (value as { purpose: string }).purpose : m.label;
      return {
        value,
        preview: `purpose: ${purpose}`,
        json: JSON.stringify({ doc_id: docId, purpose, chars: body.length }, null, 2),
        docId,
      };
    }

    case "llm": {
      const out = modelById(project.models, m.outStructureId);
      if (!out) throw new Error(`llm step ${m.id} has no output structure`);
      const stepModel = m.model ?? ctx.model;
      log.info(`llm step`, { moduleId: m.id, model: stepModel, outStructure: out.name, outIsList: !!m.outIsList });
      const inputData = requireLinearInput(m, ctx);
      const context =
        ctx.sourceText && hasQuoteField(out, project.models)
          ? `SOURCE DOCUMENT:\n${ctx.sourceText}`
          : `INPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
      const userPrompt = `${m.prompt ?? "Process the input."}\n\n${context}`;
      const schema = llmSchema(out, project.models, !!m.outIsList);
      const prompt = structuredLlmPrompt(userPrompt, schema);
      log.debug(`llm prompt built`, { promptChars: prompt.length, hasQuoteField: hasQuoteField(out, project.models) });
      ctx.reportSub?.({ label: "LLM call", current: 0, total: 1 });
      ctx.stepLlmCalls = [];
      const raw = await llmStructured(userPrompt, schema, { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls }, log.child("llm"));
      log.info(`llm response received`, { moduleId: m.id, items: Array.isArray(raw) ? raw.length : 1 });
      // AI : quote strings stay raw — a downstream Link Quotes step resolves offsets.
      const value = raw;
      const count = Array.isArray(value) ? value.length : 1;
      return {
        value,
        preview: `${count} ${out.name} item(s) produced`,
        json: JSON.stringify(value, null, 2),
        inputPreview: prompt,
        llmCalls: ctx.stepLlmCalls,
      };
    }

    case "combine": {
      // AI : merge current pipeline data with the new input — generic: keys come from the auto
      // AI : out structure (`document` field ← the new input, every other field ← pipeline data).
      const out = modelById(project.models, m.outStructureId);
      if (!out) throw new Error(`combine step ${m.id} has no output structure`);
      const newInput = (ctx.prevModuleId && ctx.outputs.get(ctx.prevModuleId)) as { doc_id?: DocId; body?: string } | undefined;
      const pipelineData = ctx.byModel.get(m.inStructureId as StructureModelId);
      // AI : purpose = the upstream input module's label (e.g. "Company Data", "Field Mapping").
      const purpose = project.modules.find((x) => x.id === ctx.prevModuleId)?.label ?? "Document";
      const value: Record<string, unknown> = {};
      const summary: Record<string, unknown> = {};
      for (const f of out.fields) {
        const isDoc = f.type === "document";
        value[f.name] = isDoc
          ? { doc_id: newInput?.doc_id ?? "", purpose, body: newInput?.body ?? "" }
          : pipelineData ?? [];
        summary[f.name] = isDoc ? newInput?.doc_id : Array.isArray(pipelineData) ? `${pipelineData.length} items` : pipelineData;
      }
      const merged = materializeStepOutput(
        m,
        project,
        value,
        materializeHints(m, ctx, newInput?.doc_id, newInput?.body ?? ""),
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
        log.info(`transform code — deferring to browser`, { moduleId: m.id });
        throw new ClientStepPendingError(m.code, input);
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
      // AI : custom TS function — saved `code` compiled to (input) => output and applied.
      const input = (ctx.prevModuleId && ctx.outputs.get(ctx.prevModuleId)) ?? null;
      if (!m.code) {
        log.warn(`custom-code passthrough (no code)`, { moduleId: m.id });
        return { value: input, preview: "custom step passthrough (no code set)", json: JSON.stringify(input, null, 2) };
      }
      log.info(`custom-code — deferring to browser`, { moduleId: m.id, codeLines: m.code.split("\n").length });
      throw new ClientStepPendingError(m.code, input);
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
  return isLlmKind(m.kind) ? m.model ?? globalModel : undefined;
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
    log.section(`step ${i + 1}/${project.modules.length}: ${m.label}`);
    log.info(`step starting`, { moduleId: m.id, kind: m.kind, cached: !!m.cached, stepModel: m.model ?? model });
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

    const defaultInputPreview =
      i === 0 ? `${inputTypeLabel(m.inputType)} document` : modelById(project.models, m.inStructureId)?.name ?? "Any";
    const beforeCents = ledger.totalCents();
    const t0 = Date.now();
    let status: RunStepStatus = "ok";
    let result: ExecResult | undefined;

    const key = stepCacheKey(cacheOwnerId, projectId, m, m.model ?? model, fingerprintInputDocIds);
    log.debug(`cache lookup`, { key, cachedFlag: !!m.cached });
    const cached = m.cached ? readCache(key) : undefined;

    try {
      if (cached) {
        applyModuleSideEffects(m, ctx, ctx.store, log);
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
            log.error(`validation failed`, { moduleId: m.id, structure: out.name, error: check.error, failedJson });
            throw new Error(`output failed ${out.name} validation: ${check.error}`);
          }
          const itemCount = isList && Array.isArray(result.value) ? result.value.length : 1;
          log.debug(`validation ok`, { moduleId: m.id, structure: out.name, itemCount });
        }
        if (m.cached) {
          const stepCost = +(ledger.totalCents() - beforeCents).toFixed(4);
          writeCache(key, {
            value: result.value,
            json:
              result.json ??
              (result.docId && m.kind === "input"
                ? JSON.stringify({ doc_id: result.docId }, null, 2)
                : undefined),
            docId: result.docId,
            inputPreview: result.inputPreview,
            costCents: stepCost,
          });
          log.debug(`cache written`, { key, costCents: stepCost });
        }
      }
    } catch (err) {
      if (err instanceof ClientStepPendingError) {
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
            code: err.code,
            input: err.input,
          },
        });
      }
      status = "error";
      result = failedStepResult(err, m, ctx, result);
      log.error(`step failed`, {
        moduleId: m.id,
        kind: m.kind,
        error: (err as Error).message,
        failedJson: result.json,
        stack: (err as Error).stack,
      });
    }

    const ms = status === "cached" ? 0 : Date.now() - t0;
    const costCents = status === "cached" ? 0 : ledger.totalCents() - beforeCents;
    log.info(`step finished`, {
      moduleId: m.id,
      status,
      ms,
      costCents: +costCents.toFixed(4),
      preview: result.preview,
    });

    if (status !== "error") {
      ctx.outputs.set(m.id, result.value);
      const structId = m.outStructureId ?? (m.kind === "output" ? m.inStructureId : undefined);
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
      docId: result.docId,
      llmCalls: result.llmCalls?.length ? result.llmCalls : undefined,
    });
    await opts.onStep?.({ index: i, total: project.modules.length, moduleId: m.id, label: m.label, status });
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
  if (!rawProject) throw new Error(`unknown project ${projectId}`);
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
    buildRunInputDocIds(store, project, inputDocId, opts.inputDocIds);
  const fingerprint =
    opts.fingerprint ?? computeRunFingerprint(project, model, fingerprintInputDocIds);
  log.info(`input queue resolved`, {
    fingerprintInputDocIds,
    fingerprint,
    inputDocIds: opts.inputDocIds,
  });

  const inputMods = orderedInputModules(project.modules);
  for (let i = 0; i < inputMods.length; i++) {
    const docId = fingerprintInputDocIds[i];
    if (!docId) continue;
    const mod = inputMods[i];
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

  const ctx: RunCtx = {
    project,
    store,
    ledger,
    model,
    inputQueue: [...fingerprintInputDocIds],
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
    for (const m of project.modules) {
      if (m.kind === "custom-code" && m.code) fileWriteHelper(join(dataDir(), "runs", runId), `${m.id}_code`, "ts", m.code);
    }
    // AI : the same high-level HTML view, archived per run for the Logging tab.
    fileWriteHelper(join(dataDir(), "runs", runId), "run_high_level", "html", runToHtml(run));
    store.addRun(projectId, run);
  }
  return run;
}

// AI : browser POSTs user-code output — server validates and continues the linear run from the paused step.
export async function resumeRunPipeline(
  store: Store,
  checkpoint: RunCheckpoint,
  clientOutput: unknown,
  opts: Omit<RunOptions, "model"> & { model?: ModelId } = {},
): Promise<PipelineRun> {
  const rawProject = store.project(checkpoint.projectId);
  if (!rawProject) throw new Error(`unknown project ${checkpoint.projectId}`);
  const project = migrateProjectModules(rawProject);

  const model = checkpoint.model;
  const persist = opts.persist ?? true;
  const ledger = new UsageLedger();
  const log = runLogger(checkpoint.runId);
  const fingerprintInputDocIds =
    checkpoint.fingerprintInputDocIds ??
    checkpoint.inputDocIds ??
    checkpoint.ctx.inputQueue;
  const fingerprint = computeRunFingerprint(project, model, fingerprintInputDocIds);
  const ctx = restoreCtx(project, store, ledger, model, checkpoint.ctx);
  const steps: RunStep[] = [...checkpoint.steps];
  const artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[] = steps
    .filter((s) => s.status !== "error")
    .flatMap((s) => {
      const value = ctx.outputs.get(s.moduleId);
      if (value === undefined) return [];
      const m = project.modules.find((x) => x.id === s.moduleId);
      const structId = m?.outStructureId ?? (m?.kind === "output" ? m.inStructureId : undefined);
      return [{ moduleId: s.moduleId, structure: modelById(project.models, structId), value }];
    });

  const m = project.modules[checkpoint.stepIndex];
  if (!m) throw new Error(`resume: invalid step index ${checkpoint.stepIndex}`);

  const writeLive = createWriteLive(project, model, steps, opts.liveHtml ?? persist);
  const cacheOwnerId = opts.cacheOwnerId ?? checkpoint.cacheOwnerId ?? "local";
  const savedCentsAcc = {
    value: steps.filter((s) => s.status === "cached").reduce((a, s) => a + s.costCents, 0),
  };

  let status: RunStepStatus = "ok";
  let result: ExecResult | undefined;
  const t0 = Date.now();
  const beforeCents = ledger.totalCents();
  const defaultInputPreview = modelById(project.models, m.inStructureId)?.name ?? "Any";

  try {
    result = buildClientResult(m, project, ctx, clientOutput);
    const out = modelById(project.models, m.outStructureId);
    if (out) {
      const isList = m.outIsList || m.kind === "llm-batch";
      const check = validateStepOutput(result.value, out, project.models, { isList, rawQuotes: false });
      if (!check.ok) throw new Error(`output failed ${out.name} validation: ${check.error}`);
    }
  } catch (err) {
    status = "error";
    result = failedStepResult(err, m, ctx, result);
    log.error(`client step failed`, { moduleId: m.id, error: (err as Error).message, failedJson: result.json });
  }

  const ms = Date.now() - t0;
  const costCents = ledger.totalCents() - beforeCents;
  if (status !== "error" && m.cached && result) {
    const key = stepCacheKey(cacheOwnerId, checkpoint.projectId, m, m.model ?? model, fingerprintInputDocIds);
    writeCache(key, {
      value: result.value,
      json: result.json,
      docId: result.docId,
      inputPreview: result.inputPreview,
      costCents: +costCents.toFixed(4),
    });
  }
  if (status !== "error") {
    ctx.outputs.set(m.id, result.value);
    const structId = m.outStructureId ?? (m.kind === "output" ? m.inStructureId : undefined);
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
    for (const mod of project.modules) {
      if (mod.kind === "custom-code" && mod.code) fileWriteHelper(join(dataDir(), "runs", checkpoint.runId), `${mod.id}_code`, "ts", mod.code);
    }
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

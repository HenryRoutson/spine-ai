import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import { runLogger } from "./server_logger";
import { fileWriteHelper } from "./file_write_helper";
import { llmBatchStructured, llmStructured } from "./llm";
import { collectQuotes, resolveQuotesValue } from "./quotation";
import { runCustomFn } from "./custom_code";
import { type LiveStep, progressHtml, runToHtml } from "./logging";
import {
  hasQuoteField,
  llmSchema,
  materializeToModel,
  structuredLlmPrompt,
  validateStepOutput,
} from "./structure";
import type { Store } from "./store";
import { computeInvalid, stepEmits } from "./validity";
import { projectSeedDocNames } from "./seed";
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
  type RunId,
  type RunStep,
  type RunStepStatus,
  type StructureModel,
  type StructureModelId,
} from "./types";

// AI : finer-grained progress inside a step — shown as a smaller bar under the step row (LLM calls, etc.).
export interface StepSubProgress {
  label: string;
  current: number;
  total: number;
}

// AI : streamed to the Inference progress bar + Logging high-level HTML view.
export interface StepProgress {
  index: number;
  total: number;
  moduleId: ModuleId;
  label: string;
  status: "running" | RunStepStatus;
  sub?: StepSubProgress;
}

export interface RunOptions {
  model: ModelId; // global model (per-step `module.model` overrides for llm)
  inputDocIds?: DocId[]; // docs assigned to `input` modules in order; [0] is the dropped doc
  onStep?: (p: StepProgress) => void | Promise<void>;
  persist?: boolean; // write run + artifacts to the store/disk (default true)
  liveHtml?: boolean; // write an auto-refreshing progress page during the run (default = persist)
}

// AI : the live progress page — open in a browser while a run executes; it refreshes itself.
export const LIVE_HTML_PATH = join(dataDir(), "live", "run_live.html");

function modelById(models: StructureModel[], id?: StructureModelId): StructureModel | undefined {
  return models.find((m) => m.id === id);
}

// AI : per-step cache keyed by project+module+input+model — honours `module.cached` & saves re-billing.
// AI : bug fix — the model is part of the key, else switching models served stale cached output.
// AI : TODO bug — the key only carries the PRIMARY inputDocId; secondary docs (opts.inputDocIds,
// AI : e.g. the company doc) and the module prompt are not in it, so swapping the company doc or
// AI : editing a step's prompt serves stale cached output.
const cacheDir = join(dataDir(), "cache");
function cacheKey(projectId: ProjectId, moduleId: ModuleId, model: ModelId, inputDocId?: DocId): string {
  return `${projectId}__${moduleId}__${model}__${inputDocId ?? "none"}.json`;
}
function readCache(key: string): { value: unknown; json?: string } | undefined {
  const path = join(cacheDir, key);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeCache(key: string, value: unknown, json?: string): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, key), JSON.stringify({ value, json }, null, 2), "utf8");
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
      return { value, preview: `loaded ${m.inputType} → ${docId ?? "(none)"}`, docId };
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
        ctx.sourceText && hasQuoteField(out)
          ? `SOURCE DOCUMENT:\n${ctx.sourceText}`
          : `INPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
      const userPrompt = `${m.prompt ?? "Process the input."}\n\n${context}`;
      const schema = llmSchema(out, project.models, !!m.outIsList);
      const prompt = structuredLlmPrompt(userPrompt, schema);
      log.debug(`llm prompt built`, { promptChars: prompt.length, hasQuoteField: hasQuoteField(out) });
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
      // AI : deterministic reshape — identity pass-through for the demo.
      const value = ctx.outputs.get(ctx.prevModuleId!) ?? null;
      return { value, preview: "reshaped", json: JSON.stringify(value, null, 2) };
    }

    case "custom-code": {
      // AI : custom TS function — saved `code` compiled to (input) => output and applied.
      const input = (ctx.prevModuleId && ctx.outputs.get(ctx.prevModuleId)) ?? null;
      if (!m.code) {
        log.warn(`custom-code passthrough (no code)`, { moduleId: m.id });
        return { value: input, preview: "custom step passthrough (no code set)", json: JSON.stringify(input, null, 2) };
      }
      log.info(`custom-code executing`, { moduleId: m.id, codeLines: m.code.split("\n").length });
      const value = await runCustomFn(m.code, input);
      log.info(`custom-code done`, { moduleId: m.id });
      return { value, preview: `custom ts fn applied (${m.code.split("\n")[0].slice(0, 60)})`, json: JSON.stringify(value, null, 2) };
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
        2,
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
      const value = resolveQuotesValue(data, out, ctx.sourceText, ctx.sourceDocId, isList);
      const linked = collectQuotes(value).length;
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

// AI : runPipeline — execute the linear pipeline step-by-step, honour the cache, stream progress.
export async function runPipeline(
  store: Store,
  projectId: ProjectId,
  inputDocId: DocId,
  opts: Omit<RunOptions, "model"> & { model?: ModelId } = {},
): Promise<PipelineRun> {
  const project = store.project(projectId);
  if (!project) throw new Error(`unknown project ${projectId}`);
  // AI : bug fix — fallback used a hardcoded "qwen-2.5-72b" instead of DEFAULT_MODEL.
  const model = opts.model ?? project.modules.find((m) => m.kind === "llm")?.model ?? DEFAULT_MODEL;
  const persist = opts.persist ?? true;

  const ledger = new UsageLedger();
  const runId = ("run_" + Math.random().toString(36).slice(2, 9)) as RunId;
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
  const invalid = computeInvalid(project.modules);
  if (invalid.size > 0) {
    log.error(`pipeline invalid`, { invalidModules: [...invalid.keys()] });
    throw new Error(`pipeline invalid: ${[...invalid.keys()].join(", ")}`);
  }

  // AI : assign docs to `input` modules in order; caller's dropped doc is first.
  // AI : bug fix — previously appended EVERY store doc, so any unrelated upload could silently
  // AI : become the second input. Now only explicit docs + inference-labelled fallbacks are used.
  const explicit = [inputDocId, ...(opts.inputDocIds ?? [])].filter(Boolean);
  const seedNames = new Set(projectSeedDocNames(project));
  const fallbacks = store
    .docs()
    .filter((d) => d.label === "inference" && !explicit.includes(d.id) && (!seedNames.size || seedNames.has(d.name)))
    .map((d) => d.id)
    .reverse(); // docs() is newest-first; fall back in upload order (oldest seed first)
  const inputQueue = [...explicit, ...fallbacks];
  log.info(`input queue resolved`, {
    explicit,
    fallbackCount: fallbacks.length,
    inputQueue,
    inputDocIds: opts.inputDocIds,
  });

  const ctx: RunCtx = {
    project,
    store,
    ledger,
    model,
    inputQueue,
    byModel: new Map(),
    outputs: new Map(),
    sourceText: "",
    sourceDocId: inputDocId,
  };

  const steps: RunStep[] = [];
  const artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[] = [];

  // AI : live HTML — rewrite the (stable-path) progress page on every step transition.
  // AI : TODO bug (cosmetic) — the final frame always says "run finished" even when a step
  // AI : errored and the rest render as "pending"; the `at` counter is also off on that frame.
  const liveHtml = opts.liveHtml ?? persist;
  const writeLive = (runningIndex: number) => {
    if (!liveHtml) return;
    const display: LiveStep[] = project.modules.map((m, idx) => {
      const done = steps.find((s) => s.moduleId === m.id);
      if (done) {
        const inLabel = m.kind === "llm" || m.kind === "llm-batch" ? "prompt" : "in";
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
      progressHtml(`${project.name} — ${runningIndex === -1 ? "run finished" : "running"}`, `${model} · step ${at}/${project.modules.length}`, display, runningIndex !== -1),
    );
  };

  for (let i = 0; i < project.modules.length; i++) {
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
      i === 0 ? `${m.inputType} document` : modelById(project.models, m.inStructureId)?.name ?? "Any";
    const beforeCents = ledger.totalCents();
    const t0 = Date.now();
    let status: RunStepStatus = "ok";
    let result: ExecResult;

    const key = cacheKey(projectId, m.id, m.model ?? model, inputDocId);
    log.debug(`cache lookup`, { key, cachedFlag: !!m.cached });
    // AI : TODO bug — a cache hit bypasses execModule, so its side effects never run:
    // AI : `input` skips inputQueue.shift() (the NEXT input module then consumes the wrong doc)
    // AI : and never sets ctx.sourceText/sourceDocId (quote resolution runs against "" and llm
    // AI : steps lose their SOURCE DOCUMENT context). Latent — seed has cached:false everywhere —
    // AI : but breaks as soon as a user toggles `cached` on an input/doc-to-text step.
    const cached = m.cached ? readCache(key) : undefined;

    try {
      if (cached) {
        status = "cached";
        result = { value: cached.value, preview: "(from cache)", json: cached.json };
        log.info(`cache HIT`, { moduleId: m.id, key });
      } else {
        result = await execModule(m, ctx, log);
        // AI : implicit validation — validate the step output against its declared out structure.
        const out = modelById(project.models, m.outStructureId);
        if (out) {
          const isList = m.outIsList || m.kind === "llm-batch";
          const rawQuotes =
            (m.kind === "llm" || m.kind === "llm-batch") && hasQuoteField(out);
          const check = validateStepOutput(result.value, out, project.models, { isList, rawQuotes });
          if (!check.ok) {
            log.error(`validation failed`, { moduleId: m.id, structure: out.name, error: check.error });
            throw new Error(`output failed ${out.name} validation: ${check.error}`);
          }
          const itemCount = isList && Array.isArray(result.value) ? result.value.length : 1;
          log.debug(`validation ok`, { moduleId: m.id, structure: out.name, itemCount });
        }
        writeCache(key, result.value, result.json);
        log.debug(`cache written`, { key });
      }
    } catch (err) {
      status = "error";
      result = { value: null, preview: (err as Error).message, llmCalls: ctx.stepLlmCalls };
      log.error(`step failed`, { moduleId: m.id, kind: m.kind, error: (err as Error).message, stack: (err as Error).stack });
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

    // record flowing state for downstream steps
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
      // AI : TODO bug — only `llm` steps record their model; `llm-batch` executes with
      // AI : m.model ?? ctx.model but leaves RunStep.model undefined, so billingFromRuns/
      // AI : spendSplit misattribute its cost to the run's global model and filterRuns
      // AI : ({model}) can't find it. Latent: the seed has no llm-batch module.
      model: m.kind === "llm" ? m.model ?? model : undefined,
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
      break;
    }
  }

  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  const billedCents = +steps.reduce((a, s) => a + s.costCents, 0).toFixed(4);
  // AI : savings = avg cost of every cached step (re-billing avoided), cross-checked by Billing.
  const savedCents = project.modules
    .filter((m) => steps.find((s) => s.moduleId === m.id)?.status === "cached")
    .reduce((a, m) => a + m.avgCostCents, 0);

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
    persistArtifacts(runId, inputDocId, store, artifacts, project.modules);
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

// AI : "previous runs" — each step output saved as JSON (with its static zod structure attached),
// AI : plus document_input_latest.txt / timestamped, so the Documents tab can list the history.
function persistArtifacts(
  runId: RunId,
  inputDocId: DocId,
  store: Store,
  artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[],
  modules: PipelineModule[],
): void {
  const dir = join(dataDir(), "runs", runId);
  const inputText = store.docContent(inputDocId) ?? "";
  fileWriteHelper(dir, "document_input", "txt", inputText);
  for (const a of artifacts) {
    fileWriteHelper(
      dir,
      a.moduleId,
      "json",
      JSON.stringify({ structure: a.structure, value: a.value }, null, 2),
    );
  }
  // AI : quotes index — every resolved quote in this run (deduped by href), exported with the
  // AI : doc CONTENT HASH + [start, end) index range so saved quotes link back to the source
  // AI : document after export, with no run context needed (resolve docs/<hash>.txt and slice).
  const quotes = [...new Map(artifacts.flatMap((a) => collectQuotes(a.value)).map((q) => [q.href, q])).values()];
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

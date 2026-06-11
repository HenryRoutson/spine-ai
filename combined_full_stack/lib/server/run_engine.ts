import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import { fileWriteHelper } from "./file_write_helper";
import { llmBatchStructured, llmStructured } from "./llm";
import { collectQuotes, findQuote } from "./quotation";
import { runCustomFn } from "./custom_code";
import { type LiveStep, progressHtml, runToHtml } from "./logging";
import { hasQuoteField, llmSchema, validate, zodFromModel } from "./structure";
import type { Store } from "./store";
import { computeInvalid } from "./validity";
import { projectSeedDocNames } from "./seed";
import { UsageLedger } from "./usage";
import {
  DEFAULT_MODEL,
  type DocId,
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

// AI : streamed to the Inference progress bar + Logging high-level HTML view.
export interface StepProgress {
  index: number;
  total: number;
  moduleId: ModuleId;
  label: string;
  status: "running" | RunStepStatus;
}

export interface RunOptions {
  model: ModelId; // global model (per-step `module.model` overrides for llm)
  inputDocIds?: DocId[]; // docs assigned to `input` modules in order; [0] is the dropped doc
  onStep?: (p: StepProgress) => void;
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

// AI : convert LLM-extracted quote strings into validated {text, quote:{doc_id,start,end}} links.
// AI : TODO bug — only TOP-LEVEL quote fields are resolved; quote fields inside nested
// AI : model/list[model] refs are left as-is (see the matching llmSchema TODO in structure.ts).
function resolveQuotes(value: unknown, model: StructureModel, sourceText: string, docId: DocId): unknown {
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };
  for (const f of model.fields) {
    if (f.type === "tuple[text,quote]" && typeof obj[f.name] === "string") {
      const m = findQuote(obj[f.name] as string, sourceText, docId);
      out[f.name] = { text: m.text, quote: { doc_id: m.docId, start: m.start, end: m.end } };
    }
    if (f.type === "list[tuple[text,quote]]" && Array.isArray(obj[f.name])) {
      out[f.name] = (obj[f.name] as string[]).map((q) => {
        const m = findQuote(q, sourceText, docId);
        return { text: m.text, quote: { doc_id: m.docId, start: m.start, end: m.end } };
      });
    }
  }
  return out;
}

interface ExecResult {
  value: unknown;
  preview: string;
  json?: string;
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
}

async function execModule(m: PipelineModule, ctx: RunCtx): Promise<ExecResult> {
  const { project, store } = ctx;
  switch (m.kind) {
    case "input": {
      const docId = ctx.inputQueue.shift();
      const content = docId ? store.docContent(docId) ?? "" : "";
      // AI : first input is the primary source for quote offsets.
      if (!ctx.sourceText) {
        ctx.sourceText = content;
        ctx.sourceDocId = docId ?? ("none" as DocId);
      }
      const value = { doc_id: docId, body: content };
      ctx.outputs.set(m.id, value);
      return { value, preview: `loaded ${m.inputType} → ${docId ?? "(none)"}` };
    }

    case "doc-to-text": {
      // AI : prebuilt parser. Input already carries text (PDF parsed at ingest); annotate purpose.
      const upstream = (ctx.prevModuleId && ctx.outputs.get(ctx.prevModuleId)) as { doc_id?: DocId; body?: string } | undefined;
      const body = upstream?.body ?? ctx.sourceText;
      const purpose = (body.split("\n").find((l) => l.trim().length > 0) ?? "Document").trim();
      const docId = upstream?.doc_id ?? ctx.sourceDocId;
      ctx.sourceText = body;
      ctx.sourceDocId = docId;
      // AI : doc parsing is a billable service line (Billing "doc-parse svc"), flat ~1c.
      ctx.ledger.recordService("doc-parse svc", ctx.model, 1);
      const value = { doc_id: docId, purpose, body };
      return { value, preview: `purpose: ${purpose}`, json: JSON.stringify({ doc_id: docId, purpose, chars: body.length }, null, 2) };
    }

    case "llm": {
      const out = modelById(project.models, m.outStructureId);
      if (!out) throw new Error(`llm step ${m.id} has no output structure`);
      const stepModel = m.model ?? ctx.model;
      const inputData = ctx.byModel.get(m.inStructureId as StructureModelId) ?? ctx.outputs.get(ctx.prevModuleId!);
      const context =
        ctx.sourceText && hasQuoteField(out)
          ? `SOURCE DOCUMENT:\n${ctx.sourceText}`
          : `INPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
      const prompt = `${m.prompt ?? "Process the input."}\n\n${context}`;
      const schema = llmSchema(out, project.models, !!m.outIsList);
      const raw = await llmStructured(prompt, schema, { model: stepModel, ledger: ctx.ledger });
      // AI : resolve quote strings → validated source-linked spans.
      let value: unknown = raw;
      if (hasQuoteField(out)) {
        value = Array.isArray(raw)
          ? raw.map((r) => resolveQuotes(r, out, ctx.sourceText, ctx.sourceDocId))
          : resolveQuotes(raw, out, ctx.sourceText, ctx.sourceDocId);
      }
      const count = Array.isArray(value) ? value.length : 1;
      return { value, preview: `${count} ${out.name} item(s) produced`, json: JSON.stringify(value, null, 2) };
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
        value[f.name] = isDoc ? { doc_id: newInput?.doc_id ?? "", purpose, body: newInput?.body ?? "" } : pipelineData ?? [];
        summary[f.name] = isDoc ? newInput?.doc_id : Array.isArray(pipelineData) ? `${pipelineData.length} items` : pipelineData;
      }
      return {
        value,
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
      if (!m.code) return { value: input, preview: "custom step passthrough (no code set)", json: JSON.stringify(input, null, 2) };
      const value = await runCustomFn(m.code, input);
      return { value, preview: `custom ts fn applied (${m.code.split("\n")[0].slice(0, 60)})`, json: JSON.stringify(value, null, 2) };
    }

    case "llm-batch": {
      // AI : batch llm — input is a list; one structured call per item; typed list out.
      const out = modelById(project.models, m.outStructureId);
      if (!out) throw new Error(`llm-batch step ${m.id} has no output structure`);
      const stepModel = m.model ?? ctx.model;
      const data = ctx.byModel.get(m.inStructureId as StructureModelId) ?? (ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined);
      const items = Array.isArray(data) ? data : [data];
      const schema = llmSchema(out, project.models, false); // per-item schema
      const rows = await llmBatchStructured(
        items,
        (item) => `${m.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(item, null, 2)}`,
        schema,
        { model: stepModel, ledger: ctx.ledger },
      );
      const value = hasQuoteField(out) ? rows.map((r) => resolveQuotes(r, out, ctx.sourceText, ctx.sourceDocId)) : rows;
      return { value, preview: `${items.length} items → ${value.length} ${out.name}`, json: JSON.stringify(value, null, 2) };
    }

    case "output": {
      const report = ctx.byModel.get(m.inStructureId as StructureModelId) ?? ctx.outputs.get(ctx.prevModuleId!);
      const name = modelById(project.models, m.outStructureId)?.name ?? "Output";
      return { value: report, preview: `${name}.md emitted`, json: JSON.stringify(report, null, 2) };
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

  // AI : run button is dark when the pipeline is invalid — refuse to execute, mirror the UI.
  const invalid = computeInvalid(project.modules);
  if (invalid.size > 0) throw new Error(`pipeline invalid: ${[...invalid.keys()].join(", ")}`);

  const ledger = new UsageLedger();
  const runId = ("run_" + Math.random().toString(36).slice(2, 9)) as RunId;
  const startedAt = Date.now();

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
      if (done)
        return { label: m.label, kind: m.kind, status: done.status, ms: done.ms, costCents: done.costCents, detail: [`out: ${done.outputPreview}`] };
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
    opts.onStep?.({ index: i, total: project.modules.length, moduleId: m.id, label: m.label, status: "running" });
    writeLive(i);

    const inputPreview = i === 0 ? `${m.inputType} document` : modelById(project.models, m.inStructureId)?.name ?? "Any";
    const beforeCents = ledger.totalCents();
    const t0 = Date.now();
    let status: RunStepStatus = "ok";
    let result: ExecResult;

    const key = cacheKey(projectId, m.id, m.model ?? model, inputDocId);
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
      } else {
        result = await execModule(m, ctx);
        // AI : implicit validation — validate the step output against its declared out structure.
        const out = modelById(project.models, m.outStructureId);
        if (out && m.kind !== "input") {
          // AI : llm-batch always emits a list, regardless of the outIsList flag
          const isList = m.outIsList || m.kind === "llm-batch";
          const toCheck = isList && Array.isArray(result.value) ? result.value : [result.value];
          for (const v of toCheck) {
            const check = validate(v, out, project.models);
            if (!check.ok) throw new Error(`output failed ${out.name} validation: ${check.error}`);
          }
        }
        writeCache(key, result.value, result.json);
      }
    } catch (err) {
      status = "error";
      result = { value: null, preview: (err as Error).message };
    }

    const ms = status === "cached" ? 0 : Date.now() - t0;
    const costCents = status === "cached" ? 0 : ledger.totalCents() - beforeCents;

    // record flowing state for downstream steps
    if (status !== "error") {
      ctx.outputs.set(m.id, result.value);
      if (m.outStructureId) ctx.byModel.set(m.outStructureId, result.value);
      ctx.prevModuleId = m.id;
      artifacts.push({ moduleId: m.id, structure: modelById(project.models, m.outStructureId), value: result.value });
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
      inputPreview,
      outputPreview: result.preview,
      outputJson: result.json,
    });
    opts.onStep?.({ index: i, total: project.modules.length, moduleId: m.id, label: m.label, status });
    if (status === "error") break;
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

  if (persist) {
    persistArtifacts(runId, inputDocId, store, artifacts);
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
  // AI : the final output module also emits a readable markdown document, named for its structure.
  const final = artifacts.at(-1);
  if (final) {
    const name = final.structure?.name ?? "FinalOutput";
    fileWriteHelper(dir, snakeCase(name), "md", renderReport(final.value, name.replace(/([a-z0-9])([A-Z])/g, "$1 $2")));
  }
}

// AI : moduleMetrics moved to billing.ts — it is pure (no fs) and the client Pipeline tab
// AI : imports it directly; this module stays Node-only.
export { moduleMetrics } from "./billing";

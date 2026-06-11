import { z, type ZodType } from "zod";
import { join } from "node:path";
import { dataDir } from "./config.js";
import { fileWriteHelper } from "./file_write_helper.js";
import { llmStructured } from "./llm.js";
import { llmSchema, validate } from "./structure.js";
import type { Store } from "./store.js";
import { UsageLedger } from "./usage.js";
import {
  DEFAULT_MODEL,
  type DocId,
  type ModelId,
  type Project,
  type Strategy,
  type StrategyKind,
  type StructureModel,
} from "./types.js";

// AI : demo_outline §3 — every "LLL environment" runs for real on a cheap model first;
// AI : if none work the benchmark falls back to a single Sonnet call.
export const BENCH_CHEAP_MODEL: ModelId = DEFAULT_MODEL; // deepseek-v3
export const BENCH_FALLBACK_MODEL: ModelId = "sonnet-4.7";

// AI : benchmark runs 4 environments × several calls — truncate the doc to stay demo-fast.
const BENCH_DOC_CHARS = 4000;

export interface StrategyResult {
  kind: StrategyKind;
  name: string;
  model: ModelId;
  accuracy: number; // 0-100, scored by the LLM judge in runBenchmark
  passRate: number; // 0-100 schema validity
  latencyMs: number;
  costCents: number;
  worked: boolean; // produced ≥1 schema-valid row
  log: string; // markdown trace with fenced code blocks (syntax-highlighted in the UI)
}

interface BenchTask {
  source: string;
  out: StructureModel; // the report structure every environment must produce
  models: StructureModel[];
  model: ModelId;
  ledger: UsageLedger;
  log: string[];
}

function fence(lang: string, body: string): string {
  return "```" + lang + "\n" + body + "\n```";
}

function rowSchema(task: BenchTask): ZodType {
  return llmSchema(task.out, task.models, true);
}

function validRows(task: BenchTask, rows: unknown): unknown[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => validate(r, task.out, task.models).ok);
}

const TASK_BRIEF =
  "You are a legal compliance engine. Read the document, derive its obligations, and produce a per-rule compliance assessment (concise summary, rule_id, compliant verdict, brief rationale, liability_usd if non-compliant).";

// ---- the four LLL environments ----

// 1. single-llm — one direct structured call.
async function envSingleLlm(task: BenchTask): Promise<unknown[]> {
  const prompt = `${TASK_BRIEF}\n\nDOCUMENT:\n${task.source}`;
  task.log.push("## single-llm", "One structured call.", fence("text", prompt.slice(0, 400) + "…"));
  const rows = await llmStructured(prompt, rowSchema(task), { model: task.model, ledger: task.ledger });
  task.log.push("Output:", fence("json", JSON.stringify(rows, null, 2)));
  return rows as unknown[];
}

// 2. rlm — recursive language model: decompose the doc, solve each part, synthesize.
async function envRlm(task: BenchTask): Promise<unknown[]> {
  task.log.push("## rlm (recursive language model)", "Decompose → solve sub-tasks → synthesize.");
  const mid = Math.floor(task.source.length / 2);
  const cut = task.source.indexOf("\n", mid);
  const chunks = cut === -1 ? [task.source] : [task.source.slice(0, cut), task.source.slice(cut)];

  const partials: unknown[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prompt = `${TASK_BRIEF}\nOnly assess obligations present in this document SECTION.\n\nSECTION ${i + 1}/${chunks.length}:\n${chunks[i]}`;
    const rows = (await llmStructured(prompt, rowSchema(task), { model: task.model, ledger: task.ledger })) as unknown[];
    task.log.push(`### recursive call ${i + 1}/${chunks.length} → ${rows.length} rows`, fence("json", JSON.stringify(rows, null, 2)));
    partials.push(...rows);
  }

  const synth = `${TASK_BRIEF}\nMerge these partial assessments: dedupe overlapping rules, keep distinct rule_ids, prefer the stricter verdict.\n\nPARTIALS:\n${JSON.stringify(partials, null, 2)}`;
  const rows = await llmStructured(synth, rowSchema(task), { model: task.model, ledger: task.ledger });
  task.log.push("### synthesis", fence("json", JSON.stringify(rows, null, 2)));
  return rows as unknown[];
}

// 3+4. agent loop — draft, self-validate, critique-and-revise. Shared by claude-code & cheap-agent.
// AI : TODO placeholder — "claude-code" should spawn a real Claude Code instance with tools;
// AI : the demo runs this same critique loop, just under the claude-code label.
async function envAgentLoop(task: BenchTask, label: string): Promise<unknown[]> {
  task.log.push(`## ${label} (agent loop)`, "draft → validate → critique → revise");
  const draftPrompt = `${TASK_BRIEF}\n\nDOCUMENT:\n${task.source}`;
  let rows = (await llmStructured(draftPrompt, rowSchema(task), { model: task.model, ledger: task.ledger })) as unknown[];
  task.log.push("### draft", fence("json", JSON.stringify(rows, null, 2)));

  const failures = (Array.isArray(rows) ? rows : []).map((r) => validate(r, task.out, task.models)).filter((v) => !v.ok);
  const critique = `You previously produced this assessment:\n${JSON.stringify(rows, null, 2)}\n\n${
    failures.length ? `Schema errors:\n${failures.map((f) => f.error).join("\n")}` : "Critique it for missed obligations, wrong verdicts, or vague rationales."
  }\nReturn the improved full assessment.\n\nDOCUMENT:\n${task.source}`;
  rows = (await llmStructured(critique, rowSchema(task), { model: task.model, ledger: task.ledger })) as unknown[];
  task.log.push("### critique & revise", fence("json", JSON.stringify(rows, null, 2)));
  return rows;
}

const ENV_RUNNERS: Record<StrategyKind, (task: BenchTask) => Promise<unknown[]>> = {
  "single-llm": envSingleLlm,
  rlm: envRlm,
  "claude-code": (t) => envAgentLoop(t, "claude-code · TODO placeholder: same loop, not a spawned Claude Code instance"),
  "cheap-agent": (t) => envAgentLoop(t, "cheap-agent"),
};

function reportModel(project: Project): StructureModel {
  const m = project.models.find((x) => x.name === "LegalConsiderations");
  if (!m) throw new Error("project has no LegalConsiderations structure for the A/B task");
  return m;
}

// AI : run one LLL environment over the pipeline task with real calls; logs are kept per outline.
export async function runStrategy(
  strategy: Strategy,
  project: Project,
  store: Store,
  inputDocId: DocId,
  opts: { model?: ModelId; persistLog?: boolean } = {},
): Promise<StrategyResult> {
  const model = opts.model ?? strategy.model;
  const ledger = new UsageLedger();
  const task: BenchTask = {
    source: (store.docContent(inputDocId) ?? "").slice(0, BENCH_DOC_CHARS),
    out: reportModel(project),
    models: project.models,
    model,
    ledger,
    log: [`# A/B log — ${strategy.kind} on ${model}`, ""],
  };

  const t0 = Date.now();
  let rows: unknown[] = [];
  try {
    rows = await ENV_RUNNERS[strategy.kind](task);
  } catch (err) {
    task.log.push("### environment error", fence("text", (err as Error).message));
  }
  const latencyMs = Date.now() - t0;
  const ok = validRows(task, rows);
  const passRate = rows.length ? Math.round((ok.length / rows.length) * 100) : 0;

  const log = task.log.join("\n\n");
  if (opts.persistLog ?? true) {
    fileWriteHelper(join(dataDir(), "ab_tests"), `${strategy.kind}_log`, "md", log);
  }

  return {
    kind: strategy.kind,
    name: strategy.name,
    model,
    accuracy: 0, // AI : filled in by the judge in runBenchmark; standalone runs carry no score
    passRate,
    latencyMs,
    costCents: +ledger.totalCents().toFixed(4),
    worked: ok.length > 0,
    log,
  };
}

export interface JudgeVerdict {
  winnerKind: StrategyKind;
  rationale: string;
  scores: { kind: StrategyKind; accuracy: number }[];
}

const KINDS = ["single-llm", "rlm", "claude-code", "cheap-agent"] as const;

// AI : LLM judge — scores each environment's output quality (accuracy 0-100) and picks the winner.
// AI : TODO bug — this ledger is created and billed but never read; the judge call's cost is
// AI : silently dropped from every benchmark total.
export async function judgeStrategies(results: StrategyResult[]): Promise<JudgeVerdict> {
  const ledger = new UsageLedger();
  const schema = z.object({
    winnerKind: z.enum(KINDS),
    rationale: z.string(),
    scores: z.array(z.object({ kind: z.enum(KINDS), accuracy: z.number().min(0).max(100) })),
  });
  const table = results
    .map(
      (r) =>
        `### ${r.kind} (${r.model}) — schema pass ${r.passRate}%, ${r.latencyMs}ms, ${r.costCents.toFixed(2)}c, worked: ${r.worked}\n` +
        `Output sample:\n${r.log.slice(-1200)}`,
    )
    .join("\n\n");
  const prompt = `Judge these strategies for a production legal-compliance pipeline. Score each one's output quality (accuracy 0-100) from its sample, then pick the best overall balancing accuracy, schema reliability, latency and cost.\n\n${table}`;
  return llmStructured(prompt, schema, { model: BENCH_CHEAP_MODEL, ledger }) as Promise<JudgeVerdict>;
}

export interface BenchmarkOutcome {
  results: StrategyResult[];
  verdict: JudgeVerdict;
  usedFallback: boolean; // true when no cheap-model environment worked and Sonnet was called
}

// AI : full benchmark per outline — all enabled environments on the cheap model; if none work,
// AI : one single Sonnet call as fallback; the judge evaluates; all logs persisted.
// AI : TODO bug — results are never written back to project.strategies, so the A/B tab keeps
// AI : showing the seeded static numbers (accuracy 94 etc.) after a real benchmark has run.
export async function runBenchmark(project: Project, store: Store, inputDocId: DocId): Promise<BenchmarkOutcome> {
  const enabled = project.strategies.filter((s) => s.enabled);
  const results = await Promise.all(
    enabled.map((s) => runStrategy(s, project, store, inputDocId, { model: BENCH_CHEAP_MODEL })),
  );

  let usedFallback = false;
  if (!results.some((r) => r.worked)) {
    usedFallback = true;
    const single = enabled.find((s) => s.kind === "single-llm") ?? enabled[0];
    results.push(await runStrategy(single, project, store, inputDocId, { model: BENCH_FALLBACK_MODEL }));
  }

  // AI : TODO bug — the fallback row reuses an existing `kind`, and results/scores are keyed by
  // AI : kind: the judge sees two sections under the same kind, both rows get the SAME accuracy
  // AI : below, and `verdict.winnerKind` can't distinguish the cheap run from the Sonnet fallback.
  const verdict = await judgeStrategies(results);
  for (const r of results) r.accuracy = verdict.scores.find((s) => s.kind === r.kind)?.accuracy ?? r.accuracy;

  const summary = [
    `# A/B benchmark — ${project.name}`,
    `Cheap model: ${BENCH_CHEAP_MODEL} · fallback used: ${usedFallback}`,
    "",
    ...results.map((r) => `- **${r.kind}** (${r.model}): accuracy ${r.accuracy}%, pass ${r.passRate}%, ${r.latencyMs}ms, ${r.costCents.toFixed(2)}c`),
    "",
    `**Winner:** ${verdict.winnerKind}`,
    verdict.rationale,
    "",
    "---",
    "",
    ...results.map((r) => r.log),
  ].join("\n");
  fileWriteHelper(join(dataDir(), "ab_tests"), "benchmark", "md", summary);

  return { results, verdict, usedFallback };
}

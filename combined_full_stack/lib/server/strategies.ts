import { z, type ZodType } from "zod";
import { join } from "node:path";
import { dataDir } from "./config";
import { fileWriteHelper } from "./file_write_helper";
import { llmStructured } from "./llm";
import { llmSchema, validate } from "./structure";
import type { Store } from "./store";
import { UsageLedger } from "./usage";
import { pipelineOutputModel, pipelineTaskPrompt } from "./validity";
import {
  DEFAULT_MODEL,
  STRATEGY_KINDS,
  type DocId,
  type ModelId,
  type Project,
  type Strategy,
  type StrategyKind,
  type StructureModel,
} from "./types";

// AI : demo_outline §3 — every "LLL environment" runs for real on a cheap model first;
// AI : if none work the benchmark falls back to a single Sonnet call.
export const BENCH_CHEAP_MODEL: ModelId = DEFAULT_MODEL; // deepseek-v3
export const BENCH_FALLBACK_MODEL: ModelId = "sonnet-4.7";

// AI : benchmark runs 3 environments × several calls — truncate the doc to stay demo-fast.
const BENCH_DOC_CHARS = 4000;

export interface StrategyResult {
  strategyId: string;
  resultKey: string;
  kind: StrategyKind;
  name: string;
  model: ModelId;
  accuracy: number; // 0-100, scored by the LLM judge in runBenchmark
  passRate: number; // 0-100 schema validity
  latencyMs: number;
  costCents: number;
  worked: boolean; // produced ≥1 schema-valid row
  log: string; // markdown trace with fenced code blocks (syntax-highlighted in the UI)
  isFallback?: boolean;
}

interface BenchTask {
  source: string;
  taskBrief: string; // AI : from the pipeline's LLM step prompt — not hardcoded per project kind
  out: StructureModel; // the report structure every environment must produce
  models: StructureModel[];
  typeAliases: Project["typeAliases"];
  model: ModelId;
  ledger: UsageLedger;
  log: string[];
}

function fence(lang: string, body: string): string {
  return "```" + lang + "\n" + body + "\n```";
}

function rowSchema(task: BenchTask): ZodType {
  return llmSchema(task.out, task.models, true, task.typeAliases ?? []);
}

function validRows(task: BenchTask, rows: unknown): unknown[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => validate(r, task.out, task.models, task.typeAliases ?? []).ok);
}

function resultKeyFor(strategy: Strategy, model: ModelId, isFallback = false): string {
  return isFallback ? `fallback:${strategy.id}@${model}` : `${strategy.id}@${model}`;
}

// ---- the three LLL environments ----

// 1. single-llm — one direct structured call.
async function envSingleLlm(task: BenchTask): Promise<unknown[]> {
  const prompt = `${task.taskBrief}\n\nDOCUMENT:\n${task.source}`;
  task.log.push("## single-llm", "One structured call.", fence("text", prompt.slice(0, 400) + "…"));
  const rows = await llmStructured(prompt, rowSchema(task), { model: task.model, ledger: task.ledger });
  task.log.push("Output:", fence("json", JSON.stringify(rows, null, 2)));
  return rows as unknown[];
}


// 2+3. agent loop — draft, self-validate, critique-and-revise. Shared by claude-code & cheap-agent.
// AI : TODO bug — "claude-code" should spawn a real Claude Code / OpenHands instance with tools;
// AI : the demo runs this same critique loop, just under the claude-code label.
async function envAgentLoop(task: BenchTask, label: string): Promise<unknown[]> {
  task.log.push(`## ${label} (agent loop)`, "draft → validate → critique → revise");
  const draftPrompt = `${task.taskBrief}\n\nDOCUMENT:\n${task.source}`;
  let rows = (await llmStructured(draftPrompt, rowSchema(task), { model: task.model, ledger: task.ledger })) as unknown[];
  task.log.push("### draft", fence("json", JSON.stringify(rows, null, 2)));

  const failures = (Array.isArray(rows) ? rows : []).map((r) => validate(r, task.out, task.models, task.typeAliases ?? [])).filter((v) => !v.ok);
  const critique = `You previously produced this assessment:\n${JSON.stringify(rows, null, 2)}\n\n${
    failures.length ? `Schema errors:\n${failures.map((f) => f.error).join("\n")}` : "Critique it for missed obligations, wrong verdicts, or vague rationales."
  }\nReturn the improved full assessment.\n\nDOCUMENT:\n${task.source}`;
  rows = (await llmStructured(critique, rowSchema(task), { model: task.model, ledger: task.ledger })) as unknown[];
  task.log.push("### critique & revise", fence("json", JSON.stringify(rows, null, 2)));
  return rows;
}

const ENV_RUNNERS: Record<StrategyKind, (task: BenchTask) => Promise<unknown[]>> = {
  "single-llm": envSingleLlm,
  "claude-code": (t) => envAgentLoop(t, "claude-code · TODO placeholder: same loop, not a spawned Claude Code instance"),
  "cheap-agent": (t) => envAgentLoop(t, "cheap-agent"),
};

// AI : run one LLL environment over the pipeline task with real calls; logs are kept per outline.
export async function runStrategy(
  strategy: Strategy,
  project: Project,
  store: Store,
  inputDocId: DocId,
  opts: { model?: ModelId; persistLog?: boolean; isFallback?: boolean } = {},
): Promise<StrategyResult> {
  const model = opts.model ?? strategy.model;
  const isFallback = opts.isFallback ?? false;
  const ledger = new UsageLedger();
  const task: BenchTask = {
    source: (store.docContent(inputDocId) ?? "").slice(0, BENCH_DOC_CHARS),
    taskBrief: pipelineTaskPrompt(project.modules),
    out: pipelineOutputModel(project),
    models: project.models,
    typeAliases: project.typeAliases ?? [],
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
    strategyId: strategy.id,
    resultKey: resultKeyFor(strategy, model, isFallback),
    kind: strategy.kind,
    name: strategy.name,
    model,
    accuracy: 0, // AI : filled in by the judge in runBenchmark; standalone runs carry no score
    passRate,
    latencyMs,
    costCents: +ledger.totalCents().toFixed(4),
    worked: ok.length > 0,
    log,
    isFallback,
  };
}

export interface JudgeVerdict {
  winnerResultKey: string;
  winnerKind: StrategyKind;
  rationale: string;
  scores: { resultKey: string; kind: StrategyKind; accuracy: number }[];
}

const KINDS = STRATEGY_KINDS;

// AI : LLM judge — scores each environment's output quality (accuracy 0-100) and picks the winner.
export async function judgeStrategies(
  results: StrategyResult[],
): Promise<{ verdict: JudgeVerdict; costCents: number }> {
  const ledger = new UsageLedger();
  const schema = z.object({
    winnerResultKey: z.string(),
    rationale: z.string(),
    scores: z.array(
      z.object({
        resultKey: z.string(),
        kind: z.enum(KINDS),
        accuracy: z.number().min(0).max(100),
      }),
    ),
  });
  const table = results
    .map(
      (r) =>
        `### ${r.resultKey} (${r.kind} on ${r.model}) — schema pass ${r.passRate}%, ${r.latencyMs}ms, ${r.costCents.toFixed(2)}c, worked: ${r.worked}\n` +
        `Output sample:\n${r.log.slice(-1200)}`,
    )
    .join("\n\n");
  const prompt = `Judge these strategies for a production legal-compliance pipeline. Each section has a unique resultKey — score and pick winners by resultKey (not kind alone). Score each one's output quality (accuracy 0-100) from its sample, then pick the best overall balancing accuracy, schema reliability, latency and cost.\n\n${table}`;
  const raw = (await llmStructured(prompt, schema, { model: BENCH_CHEAP_MODEL, ledger })) as z.infer<typeof schema>;
  const winner = results.find((r) => r.resultKey === raw.winnerResultKey) ?? results[0];
  return {
    verdict: {
      winnerResultKey: raw.winnerResultKey,
      winnerKind: winner?.kind ?? raw.scores[0]?.kind ?? "single-llm",
      rationale: raw.rationale,
      scores: raw.scores,
    },
    costCents: +ledger.totalCents().toFixed(4),
  };
}

export interface BenchmarkOutcome {
  results: StrategyResult[];
  verdict: JudgeVerdict;
  usedFallback: boolean; // true when no cheap-model environment worked and Sonnet was called
  judgeCostCents: number;
  totalCostCents: number;
}

export function mergeBenchmarkStrategies(project: Project, results: StrategyResult[]): Strategy[] {
  return project.strategies.map((s) => {
    const r = results.find((x) => x.strategyId === s.id && !x.isFallback);
    return r
      ? { ...s, model: r.model, accuracy: r.accuracy, passRate: r.passRate, latencyMs: r.latencyMs, costCents: r.costCents }
      : s;
  });
}

// AI : full benchmark per outline — all enabled environments on the cheap model; if none work,
// AI : one single Sonnet call as fallback; the judge evaluates; all logs persisted.
export async function runBenchmark(project: Project, store: Store, inputDocId: DocId): Promise<BenchmarkOutcome> {
  const enabled = project.strategies.filter((s) => s.enabled);
  const results = await Promise.all(
    enabled.map((s) => runStrategy(s, project, store, inputDocId, { model: BENCH_CHEAP_MODEL })),
  );

  let usedFallback = false;
  if (!results.some((r) => r.worked)) {
    usedFallback = true;
    const single = enabled.find((s) => s.kind === "single-llm") ?? enabled[0];
    results.push(
      await runStrategy(single, project, store, inputDocId, {
        model: BENCH_FALLBACK_MODEL,
        isFallback: true,
      }),
    );
  }

  const { verdict, costCents: judgeCostCents } = await judgeStrategies(results);
  for (const r of results) {
    r.accuracy = verdict.scores.find((s) => s.resultKey === r.resultKey)?.accuracy ?? r.accuracy;
  }

  const totalCostCents = +(
    results.reduce((a, r) => a + r.costCents, 0) + judgeCostCents
  ).toFixed(4);

  const summary = [
    `# A/B benchmark — ${project.name}`,
    `Cheap model: ${BENCH_CHEAP_MODEL} · fallback used: ${usedFallback}`,
    "",
    ...results.map(
      (r) =>
        `- **${r.resultKey}** (${r.kind} / ${r.model}): accuracy ${r.accuracy}%, pass ${r.passRate}%, ${r.latencyMs}ms, ${r.costCents.toFixed(2)}c`,
    ),
    "",
    `**Winner:** ${verdict.winnerResultKey} (${verdict.winnerKind})`,
    verdict.rationale,
    "",
    "---",
    "",
    ...results.map((r) => r.log),
  ].join("\n");
  fileWriteHelper(join(dataDir(), "ab_tests"), "benchmark", "md", summary);

  return { results, verdict, usedFallback, judgeCostCents, totalCostCents };
}

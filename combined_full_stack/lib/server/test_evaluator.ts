// AI : LLM judge for probabilistic structure fields (deterministic:false) — spec § Testing.

import { z } from "zod";
import { llmStructured } from "./llm";
import { UsageLedger } from "./usage";
import type {
  DeterministicDiffEvalPayload,
  DeterministicDiffEvalResult,
  ProbabilisticEvalPayload,
  ProbabilisticEvalResult,
} from "@/lib/testing-files";
import { DEFAULT_MODEL, type ModelId, type RunTestDeterministicDiffResult, type RunTestProbabilisticResult } from "./types";

const probabilisticVerdictSchema = z.object({
  results: z.array(
    z.object({
      path: z.string(),
      pass: z.boolean(),
      reason: z.string(),
    }),
  ),
});

const deterministicDiffVerdictSchema = z.object({
  results: z.array(
    z.object({
      path: z.string(),
      reason: z.string(),
    }),
  ),
});

function buildProbabilisticPrompt(step: ProbabilisticEvalPayload): string {
  const rows = step.fields
    .map(
      (f, i) =>
        `${i + 1}. path: ${f.path}\n   expected (reference): ${JSON.stringify(f.expected)}\n   actual: ${JSON.stringify(f.actual)}`,
    )
    .join("\n\n");
  return `You judge whether ACTUAL values match the EXPECTED reference for probabilistic (non-deterministic) fields in a pipeline test.

Pipeline step: "${step.label}"
These fields are LLM-generated prose (e.g. marking feedback) — exact wording is NOT required, but the meaning and grading judgment must match the reference.

Fields to judge:
${rows}

Rules:
- Return one result per field, same path string, same order.
- pass=true when actual is semantically equivalent to expected (same score rationale, same issues praised/criticised).
- pass=false when actual contradicts expected, omits a critical point, or reflects a different grade judgment.
- Empty or missing actual when expected is substantive → fail.`;
}

function buildDeterministicDiffPrompt(step: DeterministicDiffEvalPayload): string {
  const toleranceNote = step.tolerantPaths?.length
    ? `\nTolerant numeric fields (± compare failed):\n${step.tolerantPaths.map((t) => `- ${t.path} ±${t.tolerance}`).join("\n")}\n`
    : "";
  const rows = step.fields
    .map(
      (f, i) =>
        `${i + 1}. path: ${f.path}\n   expected: ${JSON.stringify(f.expected)}\n   actual: ${JSON.stringify(f.actual)}`,
    )
    .join("\n\n");
  return `You explain why ACTUAL values differ from EXPECTED in a deterministic pipeline test failure.

Pipeline step: "${step.label}"
These fields use exact JSON compare (or ± tolerance for listed numeric fields). The test marked them different because values do not match.
${toleranceNote}
Fields that differ:
${rows}

Think step by step about each mismatch (type change, missing key, wrong number, off-by-one in array, tolerance exceeded, etc.), then return a concise human-readable reason per field.

Rules:
- Return one result per field, same path string, same order.
- reason should be one short sentence — what differs and why it matters for the test (not restating raw JSON).
- For missing values use words like "missing" or "extra field".
- For ± tolerance failures, mention expected tolerance band.`;
}

export async function evaluateProbabilisticFields(
  steps: ProbabilisticEvalPayload[],
  model: ModelId = DEFAULT_MODEL,
): Promise<{ results: ProbabilisticEvalResult[]; costCents: number }> {
  const ledger = new UsageLedger();
  const results: ProbabilisticEvalResult[] = [];

  for (const step of steps) {
    if (!step.fields.length) {
      results.push({ label: step.label, fieldResults: [], pass: true });
      continue;
    }
    const raw = await llmStructured(buildProbabilisticPrompt(step), probabilisticVerdictSchema, {
      model,
      ledger,
    });
    const fieldResults: RunTestProbabilisticResult[] = step.fields.map((f, i) => {
      const hit = raw.results.find((r) => r.path === f.path) ?? raw.results[i];
      return {
        path: f.path,
        pass: hit?.pass ?? false,
        reason: hit?.reason ?? "LLM did not return a verdict for this field",
        expected: f.expected,
        actual: f.actual,
      };
    });
    results.push({
      label: step.label,
      fieldResults,
      pass: fieldResults.every((r) => r.pass),
    });
  }

  return { results, costCents: +ledger.totalCents().toFixed(4) };
}

export async function evaluateDeterministicDiffFields(
  steps: DeterministicDiffEvalPayload[],
  model: ModelId = DEFAULT_MODEL,
): Promise<{ results: DeterministicDiffEvalResult[]; costCents: number }> {
  const ledger = new UsageLedger();
  const results: DeterministicDiffEvalResult[] = [];

  for (const step of steps) {
    if (!step.fields.length) {
      results.push({ label: step.label, fieldResults: [] });
      continue;
    }
    const raw = await llmStructured(buildDeterministicDiffPrompt(step), deterministicDiffVerdictSchema, {
      model,
      ledger,
    });
    const fieldResults: RunTestDeterministicDiffResult[] = step.fields.map((f, i) => {
      const hit = raw.results.find((r) => r.path === f.path) ?? raw.results[i];
      return {
        path: f.path,
        reason: hit?.reason ?? "LLM did not explain this difference",
        expected: f.expected,
        actual: f.actual,
      };
    });
    results.push({ label: step.label, fieldResults });
  }

  return { results, costCents: +ledger.totalCents().toFixed(4) };
}

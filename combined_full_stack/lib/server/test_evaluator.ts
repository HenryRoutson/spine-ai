// AI : LLM judge for probabilistic structure fields (deterministic:false) — spec § Testing.

import { z } from "zod";
import { llmStructured } from "./llm";
import { UsageLedger } from "./usage";
import { DEFAULT_MODEL, type ModelId, type RunTestProbabilisticResult } from "./types";
import type { ProbabilisticEvalPayload, ProbabilisticEvalResult } from "@/lib/testing-files";

const probabilisticVerdictSchema = z.object({
  results: z.array(
    z.object({
      path: z.string(),
      pass: z.boolean(),
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

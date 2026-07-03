// AI : generates *_testing.json files — the model sees the pipeline state types + docs and
// AI : writes per-step expected outputs; result is validated against the live pipeline before save.

import { z } from "zod";
import { llmStructured } from "./llm";
import { pipelineStateTsInterface } from "./pipeline_state";
import { UsageLedger } from "./usage";
import type { ModelId, Project, DocRef } from "./types";
import {
  isTestingFileName,
  probabilisticPathsForModule,
  TESTING_FILE_SUFFIX,
  validateTestFile,
  type SpineTestFile,
  type TestFileIssue,
} from "@/lib/testing-files";

const generatedTestSchema = z.object({
  fileName: z.string(),
  description: z.string(),
  inputs: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  expectedOutputs: z.record(z.string(), z.unknown()),
});

export type GeneratedTestFile = {
  name: string;
  content: string;
  issues: TestFileIssue[];
};

function sanitizeTestFileName(raw: string): string {
  const base = raw
    .replace(/\.json$/i, "")
    .replace(/_testing$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${base || "test"}${TESTING_FILE_SUFFIX}`;
}

function buildPrompt(project: Project, projectDocs: DocRef[], instruction: string): string {
  const steps = project.modules.map((m, i) => ({
    index: i + 1,
    kind: m.kind,
    label: m.label,
    note: m.note,
    prompt: m.prompt,
    inputType: m.inputType,
  }));
  const inputDocs = projectDocs
    .filter((d) => !isTestingFileName(d.name))
    .map((d) => ({ name: d.name, type: d.type, preview: d.preview.slice(0, 300) }));
  const golden = project.expectedOutputs && Object.keys(project.expectedOutputs).length
    ? `Known-good outputs for some steps (reuse these where they fit):\n${JSON.stringify(project.expectedOutputs, null, 2)}`
    : "No golden outputs are stored for this project — derive plausible exact outputs from the step prompts and types.";

  // AI : per-step probabilistic field paths (from structure defs) — the compare ignores these.
  const probabilistic = project.modules
    .map((m) => ({ step: m.label, ignoredFields: probabilisticPathsForModule(m, project.models) }))
    .filter((x) => x.ignoredFields.length);
  const ignoredNote = probabilistic.length
    ? `Probabilistic fields per step (ignored when comparing — values only need to be plausible):\n${JSON.stringify(probabilistic, null, 2)}`
    : "";

  return `You write test files for a linear LLM pipeline. A test file pins input documents and the EXACT expected JSON output at each step, so a run can pinpoint the first step that diverges.

Project: ${project.name} (${project.kind})
${project.documentation ? `\nProject notes:\n${project.documentation}\n` : ""}
Pipeline steps in order:
${JSON.stringify(steps, null, 2)}

Every step's output must match this TypeScript pipeline-state shape (keys are step labels):
${pipelineStateTsInterface(project)}

Documents available in this project (use exact names in "inputs"):
${JSON.stringify(inputDocs, null, 2)}

${golden}
${ignoredNote ? `\n${ignoredNote}\n` : ""}
Rules:
- "inputs" maps every input step label to an existing document name (or list of names).
- "expectedOutputs" maps step labels to the exact expected JSON output of that step; every value must type-check against the pipeline-state shape above.
- Only use step labels that exist in the pipeline. Do not include input steps in expectedOutputs.
- Tests are partial by design: cover only the steps the user asks about (a single step is fine). Only the listed steps are checked.
- Structure fields marked deterministic:false (probabilistic — LLM prose like a summary or feedback that will almost never match exactly) are automatically IGNORED when comparing. Still include a plausible value for them in expectedOutputs (as a reference), but only deterministic fields (maths answers, ids, enums, scores) decide pass/fail — so make those exact.
- "fileName" is a short snake_case base name (the ${TESTING_FILE_SUFFIX} suffix is added automatically).

User request:
${instruction}`;
}

export async function generateTestFile(
  project: Project,
  projectDocs: DocRef[],
  instruction: string,
  model: ModelId,
): Promise<GeneratedTestFile> {
  const ledger = new UsageLedger();
  const generated = await llmStructured(buildPrompt(project, projectDocs, instruction), generatedTestSchema, {
    model,
    ledger,
  });
  const test: SpineTestFile = {
    description: generated.description,
    inputs: generated.inputs,
    expectedOutputs: generated.expectedOutputs,
  };
  return {
    name: sanitizeTestFileName(generated.fileName),
    content: JSON.stringify(test, null, 2),
    issues: validateTestFile(test, project, projectDocs),
  };
}

import { llmStreamString } from "./llm";
import { UsageLedger } from "./usage";
import { DEFAULT_MODEL, type ModelId, type Project } from "./types";

export const PIPELINE_SUMMARY_STREAM_EVENT = {
  DELTA: "delta",
  DONE: "done",
  ERROR: "error",
} as const;

function buildSystemPrompt(): string {
  return `You review linear LLM pipelines for conceptual and logical problems only.

Do NOT report:
- I/O type mismatches, cardinality mismatches, or duplicate structure wiring (the UI already flags these)
- Missing labels or empty step names
- Pure schema/type validation

DO report conceptual issues such as:
- Pipeline doesn't achieve its stated goal end-to-end
- Step order is wrong (e.g. aggregate before per-item extraction)
- LLM prompt asks for data prior steps never produce
- Missing intermediate step (e.g. no quote-linking after factual extraction, no combine when parallel inputs needed)
- Redundant or noop steps
- Batch/list handling that will silently drop items
- Output step doesn't match what upstream work produces
- Prompts vague, contradictory, or misaligned with structure field meanings
- Assert/custom-code logic likely wrong for the task

Write plain markdown:
- One short overview paragraph of what the pipeline does
- If there are issues, add "## Issues" with bullets; tag severity as **high**, **medium**, or **low**
- If sound, say so briefly

Be concise.`;
}

function buildUserPrompt(project: Project): string {
  const modelsJson = JSON.stringify(
    project.models.map((m) => ({
      name: m.name,
      description: m.description,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.type,
        optional: f.optional,
        ref: f.ref ? project.models.find((x) => x.id === f.ref)?.name : undefined,
        description: f.description,
      })),
    })),
    null,
    2,
  );
  const modulesJson = JSON.stringify(
    project.modules.map((m, i) => ({
      index: i + 1,
      kind: m.kind,
      label: m.label,
      note: m.note,
      structureIn: project.models.find((x) => x.id === m.inStructureId)?.name,
      structureOut: project.models.find((x) => x.id === m.outStructureId)?.name,
      inputType: m.inputType,
      inputNameContains: m.inputNameContains,
      inputDescription: m.inputDescription,
      prompt: m.prompt,
      code: m.code,
      model: m.model,
      outIsList: m.outIsList,
      cached: m.cached,
    })),
    null,
    2,
  );
  return `Project: ${project.name} (${project.kind})

Structure models:
${modelsJson}

Pipeline (${project.modules.length} steps, left → right):
${modulesJson}

Review this pipeline. Summarize what it does and list conceptual issues only.`;
}

export async function summarizePipelineStream(
  project: Project,
  globalModel: ModelId,
  onDelta: (delta: string) => void,
): Promise<{ text: string; usageCents: number }> {
  const ledger = new UsageLedger();
  const text = await llmStreamString(
    buildUserPrompt(project),
    { model: globalModel, ledger, system: buildSystemPrompt() },
    onDelta,
  );
  return { text, usageCents: +ledger.totalCents().toFixed(4) };
}

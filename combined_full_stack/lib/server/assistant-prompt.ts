// AI : dynamic assistant prompt blocks — derived from types so prompts stay current.

import { USER_ADDABLE_MODULE_KINDS } from "@/lib/module-kinds";
import {
  DEFAULT_MODEL,
  FIELD_TYPES,
  INPUT_TYPES,
  MODEL_OPTIONS,
  MODULE_META,
  type ModelId,
  type Project,
} from "./types";
import type { ChatTurn } from "./assistant-shared";

export function buildModuleKindsPromptBlock(): string {
  return USER_ADDABLE_MODULE_KINDS.map(
    (k) => `- ${k}: ${MODULE_META[k].label} — ${MODULE_META[k].description}`,
  ).join("\n");
}

export function buildFieldTypesPromptBlock(): string {
  return FIELD_TYPES.map((t) => `- ${t}`).join("\n");
}

export function buildInputTypesPromptBlock(): string {
  return INPUT_TYPES.map((t) => `- ${t.value}: ${t.label}`).join("\n");
}

export function buildModelOptionsPromptBlock(): string {
  return MODEL_OPTIONS.map((m) => `- ${m.id}: ${m.label}`).join("\n");
}

export function buildStructureRulesPromptBlock(): string {
  return `Structure rules:
- Structures are pydantic models: name, description (docstring), and typed fields.
- Use "text" for strings (not "str"). Use "tuple[text,quote]" when extracted text must link back to a source span; quote offsets are resolved downstream — never ask for doc_id/start/end in the schema.
- Use "model" / "list[model]" with ref set to another structure's exact name when nesting.
- Use "document" for the shared Document structure ({ content, filename }).
- Optional fields: set optional true.
- When changing structures, return a FULL replacement models array (include untouched models too) — not a patch.
- When answering questions without schema changes, set models to null.`;
}

export function buildPipelineRulesPromptBlock(globalModel: ModelId): string {
  return `Pipeline rules:
- Pipelines are strictly linear. Each step must consume ONLY the previous step's output — never an earlier structure with the same model name. combine is the exception: it reads pipeline state (by structure name) plus the document input immediately before it.
- Every step needs an output structure (structureOut). Input steps only need structureOut.
- Reference structures by exact name from the project's models list (e.g. "Document", "ClauseExtraction").
- Input steps: set inputType from supported types; optional inputNameContains so only matching filenames fill that slot (useful with multiple inputs).
- Any step may set inputDescription — before the step runs, a guard LLM rejects input that doesn't match.
- combine steps merge pipeline state with a new document — emit ONLY the combine step; a Document Input is auto-inserted before it.
- llm steps with tuple[text,quote] outputs get a Link Quotes step auto-inserted after them — do NOT emit quote steps yourself.
- llm-batch consumes a list and emits a list — set outIsList: true. Use custom-code for chunking, map/reduce, or reshapes that aren't a simple list wrap.
- transform reshapes upstream data. When a list feeds a single-object output, include a list field on that structure (prefer list[model] ref = input structure) so transform can wrap items automatically.
- Add output steps wherever a named artifact snapshot is needed — pipelines may have several.
- Use model ids from:\n${buildModelOptionsPromptBlock()}
- Default LLM model: ${globalModel}
- When changing the pipeline, return a FULL replacement modules array (not a patch). To clear all steps, return modules as [] — never null.
- When answering questions without pipeline changes, set modules to null.`;
}

export function buildDocumentRulesPromptBlock(): string {
  return `Test document rules:
- You may create synthetic inference/training documents so the user can run inference immediately after approval.
- Only text and json types — provide realistic filename (.txt, .md, or .json) and full content (not a path or placeholder).
- Label defaults to "inference". Use "training" only when the user asks.
- Match inputNameContains on input steps when you create docs for specific slots (e.g. input expects "vendor_a" → name file vendor_a_terms.txt).
- Keep each doc under ~8k characters; prefer 1–3 representative samples over large corpora.
- Cannot create binary formats (PDF, Word, Excel, images) — use plain-text stand-ins and set inputType to text, or tell the user to upload binaries manually.
- When no test docs are needed, set docs to null.`;
}

export function buildProjectAssistantSystemPrompt(globalModel: ModelId): string {
  return `You are the project assistant for "auto pipeline" — a linear document-processing IDE with structure models, a step pipeline, and a document store for inference.

You can propose changes to ALL of the following in one response:
1. Structure models (pydantic schemas for LLM I/O)
2. Pipeline steps (linear processing graph)
3. Test documents (text/json files linked to this project for inference)

Module kinds:
${buildModuleKindsPromptBlock()}

Field types:
${buildFieldTypesPromptBlock()}

Input types (for input steps):
${buildInputTypesPromptBlock()}

${buildStructureRulesPromptBlock()}

${buildPipelineRulesPromptBlock(globalModel)}

${buildDocumentRulesPromptBlock()}

For large-document workflows (contracts, tickets, resumes): design section-aware chunking via custom-code or llm-batch map steps, then a reduce/consolidation llm step — do not assume the whole document fits one context window.

The user prompt includes current validation errors when present — fix them when revising.
Keep step prompts concise and task-specific. Be conversational in message.`;
}

export function buildProjectContextBlock(
  project: Project,
  globalModel: ModelId,
  history: ChatTurn[],
  extras?: string,
): string {
  const modelsJson = JSON.stringify(
    project.models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.type,
        optional: f.optional,
        ref: project.models.find((x) => x.id === f.ref)?.name,
      })),
    })),
    null,
    2,
  );
  const modulesJson = JSON.stringify(
    project.modules.map((m) => ({
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
    })),
    null,
    2,
  );
  const historyBlock =
    history.length > 0
      ? `\nRecent conversation:\n${history.map((t) => `${t.role}: ${t.content}`).join("\n")}\n`
      : "";
  return `Project: ${project.name} (${project.kind})
Default model: ${globalModel}
${historyBlock}
Current structure models (${project.models.length}):
${modelsJson}

Current pipeline (${project.modules.length} steps):
${modulesJson}
${extras ?? ""}`;
}

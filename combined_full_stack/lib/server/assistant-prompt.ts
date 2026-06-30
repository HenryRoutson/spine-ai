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
import type { ModuleKind, PipelineModule, StructureModel } from "./types";

function structureName(models: StructureModel[], id: string | undefined): string | undefined {
  if (!id) return undefined;
  return models.find((m) => m.id === id)?.name;
}

function stepEmitsList(kind: ModuleKind, outIsList: boolean | undefined): boolean {
  if (kind === "llm-batch") return true;
  return !!outIsList;
}

/** AI : human-readable spine type for assistant context — matches validity.ts rules. */
export function spineEmitsLabel(m: PipelineModule, models: StructureModel[]): string | undefined {
  const name = structureName(models, m.outStructureId);
  if (!name || m.kind === "output" || m.kind === "assert" || m.kind === "human-review") {
    const passthrough = structureName(models, m.inStructureId ?? m.outStructureId);
    return passthrough ?? undefined;
  }
  return stepEmitsList(m.kind, m.outIsList) ? `list[${name}]` : name;
}

export function spineExpectsLabel(m: PipelineModule, models: StructureModel[]): string | undefined {
  if (m.kind === "input") return undefined;
  const name = structureName(models, m.inStructureId);
  if (!name) return undefined;
  if (m.kind === "llm-batch") return `list[${name}]`;
  return name;
}

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
- Field types must be from the Field types list — no "dict", "str", or ad-hoc types.
- Every field needs a description string (use "" if nothing to add).
- Optional fields: set optional true.
- When changing structures, return a FULL replacement models array (include untouched models too) — not a patch.
- When answering questions without schema changes, set models to null.`;
}

/** AI : spine typing — the #1 source of invalid pipelines; explain without task-specific hardcoding. */
export function buildLinearIoPromptBlock(): string {
  return `Linear spine I/O (CRITICAL — validate mentally before returning modules):
The pipeline is strictly left-to-right. Step N+1 consumes ONLY what step N puts on the spine — both the structure NAME and whether it is a single object or a list.

Spine notation (for reasoning only — never put this in structureIn/structureOut JSON fields):
- Single object: Document
- List of objects: list[ChunkItem]

What each step puts on the spine (emits):
- input → single structureOut (e.g. Document)
- llm / transform (no code) with outIsList false → single structureOut
- llm / transform / custom-code with outIsList true → list[structureOut]
- llm-batch → ALWAYS list[structureOut] (outIsList is implied true)
- quote (auto-inserted "Link Quotes") → INHERITS outIsList from its upstream LLM step. If the LLM has outIsList true the quote step also emits list[structureOut]. Do NOT create transform or quote steps named "Link Quotes ·…" yourself — they are inserted automatically.

What each step requires from the previous step (expects):
- Most steps → single structureIn matching the previous step's emit
- llm-batch → list[structureIn] — the previous step MUST emit that list, not a single object

structureIn and structureOut in your JSON are structure NAMES only (e.g. "ChunkItem"). Never write "list[ChunkItem]" there — set outIsList: true on the emitting step instead.

Common mistakes that fail validation:
1. llm-batch after llm without outIsList — e.g. chunking llm emits single Document but batch expects list[ChunkItem]. Fix: add outIsList: true on the chunking step (or use custom-code to emit the list).
2. Wrong item type on a list — e.g. upstream emits list[Document] but batch expects list[ChunkItem]. Fix: align structureOut on the upstream step.
3. list → single object without a reshape — e.g. list[ExtractedRow] → SummaryRow needs custom-code, or a SummaryRow model with a list[model] field + transform, not a bare transform.
4. Map-reduce on paper but linear types not wired — design the spine chain first: Document → list[Chunk] → list[Candidate] → list[Extracted] → Summary.
5. LLM with outIsList: true followed by a bare transform that expects a single item — the auto-quote step (if the LLM has quote fields) ALSO emits list[T], so every step downstream still sees a list. A bare transform (no code) CANNOT fold list[T] → single T. Fix options: (a) add custom-code or m.code on the transform to fold the list; (b) add a list[model] field on the output structure and let the bare transform auto-wrap; (c) keep outIsList: false on the LLM and put the list field inside the output structure instead; (d) use llm-batch to process each list item downstream.

Before returning modules, walk the chain: for each adjacent pair, confirm previous emits exactly what next expects. If the user prompt lists validation errors, fix every listed mismatch.`;
}

export function buildPipelineRulesPromptBlock(globalModel: ModelId): string {
  return `Pipeline rules:
- Pipelines are strictly linear. Each step must consume ONLY the previous step's output — never an earlier structure with the same model name. combine is the exception: it reads pipeline state (by structure name) plus the document input immediately before it.
- Every step needs an output structure (structureOut). Input steps only need structureOut.

${buildLinearIoPromptBlock()}

- Input steps: set inputType from supported types; optional inputNameContains so only matching filenames fill that slot (useful with multiple inputs).
- Any step may set inputDescription — before the step runs, a guard LLM rejects input that doesn't match. inputDescription MUST describe what the step RECEIVES as input (the upstream data), not what it produces. For export/output steps (e.g. "Export CSV", "Generate Report"), describe the upstream structured data fields, not the output file format.
- input, combine, and llm/llm-batch steps MUST set note (Annotation / purpose) — a short human-readable description of what the step does or what document/data it handles. Never leave note empty on those kinds.
- combine steps merge pipeline state with a new document — emit ONLY the combine step; a Document Input is auto-inserted before it.
- llm steps with tuple[text,quote] outputs get a Link Quotes step auto-inserted after them — do NOT emit quote steps yourself.
- transform reshapes upstream data. When a list feeds a single-object output, include a list field on that structure (prefer list[model] ref = input structure) so transform can wrap items automatically, or use custom-code.
- Add output steps wherever a named artifact snapshot is needed — pipelines may have several.
- Use model ids from:\n${buildModelOptionsPromptBlock()}
- Default LLM model: ${globalModel}
- For large changes (restructuring, new steps, changing the overall flow): set modules to the FULL replacement array and modulePatch to null. To clear all steps, return modules as [] — never null.
- For small targeted changes (fixing a prompt, swapping a model, adding outIsList, editing 1–3 steps): set modules to null and use modulePatch instead. Each entry must include the step's 0-based index (shown in the current pipeline JSON) and ONLY the fields you want to change — untouched fields are preserved as-is.
- When answering questions without pipeline changes, set both modules and modulePatch to null.`;
}

export function buildProjectDocumentationRulesPromptBlock(): string {
  return `Project documentation rules (Docs tab — injected into every future assistant call):
- When you change pipeline steps (modules or modulePatch) or structure models, you MUST return documentationUpdate — the FULL replacement markdown for the project Docs tab.
- Keep docs accurate over time: purpose, pipeline step overview (what each step does), structure glossary, and hard constraints/invariants the user stated or you introduced.
- Preserve user-written rules from the current documentation unless the change explicitly supersedes them.
- Be concise but complete — future assistant calls treat this as ground truth to prevent regressions.
- When only answering questions, creating test documents, or making no pipeline/model changes, set documentationUpdate to null.
- When changing pipeline or models without updating docs, the project drifts — always refresh documentationUpdate alongside those changes.`;
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
  return `You are the project assistant for "Spine" — a linear document-processing IDE with structure models, a step pipeline, and a document store for inference.

You can propose changes to ALL of the following in one response:
1. Structure models (pydantic schemas for LLM I/O)
2. Pipeline steps (linear processing graph)
3. Project documentation (markdown — keeps the Docs tab accurate as the pipeline evolves)
4. Test documents (text/json files linked to this project for inference)

Module kinds:
${buildModuleKindsPromptBlock()}

Field types:
${buildFieldTypesPromptBlock()}

Input types (for input steps):
${buildInputTypesPromptBlock()}

${buildStructureRulesPromptBlock()}

${buildPipelineRulesPromptBlock(globalModel)}

${buildProjectDocumentationRulesPromptBlock()}

${buildDocumentRulesPromptBlock()}

For large-document workflows (contracts, tickets, resumes): design section-aware chunking, then map (llm-batch per item) and reduce (custom-code or llm) — walk the linear spine chain first (see Linear spine I/O); do not assume the whole document fits one context window.

The user prompt includes current pipeline JSON with spineExpects / spineEmits per step — use it to verify adjacent steps match.
The user prompt includes current validation errors when present — fix them when revising.
When validation errors are listed and the user asks to fix them, return a FULL replacement modules array (and models if needed) — modules MUST NOT be null. Do not reply with only a high-level plan.
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
    project.modules.map((m, i) => ({
      index: i,
      kind: m.kind,
      label: m.label,
      note: m.note,
      structureIn: structureName(project.models, m.inStructureId),
      structureOut: structureName(project.models, m.outStructureId),
      spineExpects: spineExpectsLabel(m, project.models),
      spineEmits: spineEmitsLabel(m, project.models),
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
  // AI : documentation block — prepended first so the model sees project constraints before anything else.
  const docsBlock = project.documentation?.trim()
    ? `PROJECT DOCUMENTATION (read first — treat as hard constraints):\n${project.documentation.trim()}\n\n`
    : "";
  return `${docsBlock}Project: ${project.name} (${project.kind})
Default model: ${globalModel}
${historyBlock}
Current structure models (${project.models.length}):
${modelsJson}

Current pipeline (${project.modules.length} steps):
${modulesJson}
${extras ?? ""}`;
}

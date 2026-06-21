import { z } from "zod";
import { llmStructured } from "./llm";
import { UsageLedger } from "./usage";
import {
  DEFAULT_MODEL,
  FIELD_TYPES,
  type FieldType,
  type ModelField,
  type ModelId,
  type Project,
  type StructureModel,
  type StructureModelId,
} from "./types";

const fieldTypeValues = FIELD_TYPES as [FieldType, ...FieldType[]];

const modelSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.enum(fieldTypeValues),
      optional: z.boolean(),
      description: z.string(),
      ref: z.string().optional(),
    }),
  ),
});

const assistantResponseSchema = z.object({
  message: z.string(),
  models: z.array(modelSpecSchema).nullable(),
});

export type StructureAssistantModelSpec = z.infer<typeof modelSpecSchema>;

export type StructureAssistantProposal = {
  models: StructureModel[];
};

export type StructureAssistantResult = {
  message: string;
  proposal: StructureAssistantProposal | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

function uid<T extends string = string>(): T {
  return Math.random().toString(36).slice(2, 9) as T;
}

function resolveStructureId(
  hint: string | undefined,
  byName: Map<string, StructureModelId>,
): StructureModelId | undefined {
  if (!hint?.trim()) return undefined;
  const key = hint.trim().toLowerCase();
  return byName.get(key);
}

function materializeStructures(
  specs: StructureAssistantModelSpec[],
  existing: StructureModel[],
): StructureModel[] {
  const existingByName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));
  const byName = new Map<string, StructureModelId>();

  for (const spec of specs) {
    const prev = existingByName.get(spec.name.toLowerCase());
    byName.set(spec.name.toLowerCase(), prev?.id ?? uid<StructureModelId>());
  }

  return specs.map((spec) => {
    const prev = existingByName.get(spec.name.toLowerCase());
    const id = byName.get(spec.name.toLowerCase())!;
    const prevFieldsByName = new Map(prev?.fields.map((f) => [f.name.toLowerCase(), f]) ?? []);

    const fields: ModelField[] = spec.fields.map((f) => ({
      id: prevFieldsByName.get(f.name.toLowerCase())?.id ?? uid(),
      name: f.name,
      type: f.type,
      optional: f.optional,
      description: f.description,
      ref: resolveStructureId(f.ref, byName),
    }));

    return {
      id,
      name: spec.name,
      description: spec.description,
      fields,
      auto: prev?.auto,
    };
  });
}

function buildSystemPrompt(): string {
  const types = FIELD_TYPES.map((t) => `- ${t}`).join("\n");
  return `You are a structure design assistant for "auto pipeline" — pydantic/zod output schemas for LLM pipeline steps.

Field types:
${types}

Rules:
- Structures are pydantic models: name, description (docstring), and typed fields.
- Use "text" for strings (not "str"). Use "tuple[text,quote]" when extracted text must link back to a source span; the quote offsets are resolved downstream — never ask for doc_id/start/end in the schema.
- Use "model" / "list[model]" with ref set to another structure's exact name when nesting.
- Use "document" for the standard { doc_id, purpose, body } document base.
- Optional fields: set optional true.
- When the user asks to create or change structures, return a FULL replacement models array (all models that should exist after the change — include untouched models too).
- When answering questions without schema changes, set models to null.
- Keep descriptions concise and useful as LLM field hints.
- Be conversational in message.`;
}

function buildUserPrompt(project: Project, message: string, history: ChatTurn[]): string {
  const modelsJson = JSON.stringify(
    project.models.map((m) => ({
      name: m.name,
      description: m.description,
      auto: m.auto ?? false,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.type,
        optional: f.optional,
        description: f.description,
        ref: project.models.find((x) => x.id === f.ref)?.name,
      })),
    })),
    null,
    2,
  );
  const historyBlock =
    history.length > 0
      ? `\nRecent conversation:\n${history.map((t) => `${t.role}: ${t.content}`).join("\n")}\n`
      : "";
  return `Project: ${project.name} (${project.kind})
${historyBlock}
Current structure models (${project.models.length}):
${modelsJson}

User request: ${message}`;
}

export async function proposeStructureChange(
  project: Project,
  message: string,
  history: ChatTurn[],
  globalModel: ModelId = DEFAULT_MODEL,
): Promise<StructureAssistantResult> {
  const ledger = new UsageLedger();
  const raw = await llmStructured(
    buildUserPrompt(project, message, history),
    assistantResponseSchema,
    {
      model: globalModel,
      ledger,
      system: buildSystemPrompt(),
    },
  );

  const proposal: StructureAssistantProposal | null = raw.models?.length
    ? { models: materializeStructures(raw.models, project.models) }
    : null;

  return { message: raw.message, proposal };
}

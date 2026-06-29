import { z } from "zod";
import { llmStructured } from "./llm";
import {
  ChatTurn,
  resolveStructureIdFromMap,
  structureModelSpecSchema,
} from "./assistant-shared";
import { uid } from "@/lib/id";
import { UsageLedger } from "./usage";
import {
  buildFieldTypesPromptBlock,
  buildStructureRulesPromptBlock,
} from "./assistant-prompt";
import {
  DEFAULT_MODEL,
  type FieldType,
  type ModelField,
  type ModelId,
  type Project,
  type StructureModel,
  type StructureModelId,
} from "./types";

const modelSpecSchema = structureModelSpecSchema;

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

export type { ChatTurn };

export function materializeStructureModels(
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
      type: f.type as FieldType,
      optional: f.optional,
      description: f.description,
      ref: resolveStructureIdFromMap(f.ref, byName, existing),
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
  return `You are a structure design assistant for "Spine" — pydantic/zod output schemas for LLM pipeline steps.

Field types:
${buildFieldTypesPromptBlock()}

${buildStructureRulesPromptBlock()}`;
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

  const proposal: StructureAssistantProposal | null =
    raw.models == null ? null : { models: materializeStructureModels(raw.models, project.models) };

  return { message: raw.message, proposal };
}

import { z } from "zod";
// AI : TODO (arch-structure-assistant) — leftover thinner proposer; HTTP structure-assistant uses pipeline_assistant.
// AI :   Delete or make CLI call proposePipelineChange with a structures-only prompt flag.
import { llmStructured } from "./llm";
import {
  ChatTurn,
  materializeStructureModels,
  structureModelSpecSchema,
} from "./assistant-shared";
import { UsageLedger } from "./usage";
import {
  buildFieldTypesPromptBlock,
  buildStructureRulesPromptBlock,
  buildTypeAliasesRulesPromptBlock,
} from "./assistant-prompt";
import { formatTypeExprPy, fieldTypeExprSource } from "@/lib/type-expr-parse";
import {
  DEFAULT_MODEL,
  type ModelId,
  type Project,
  type StructureModel,
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

export { materializeStructureModels } from "./assistant-shared";

function buildSystemPrompt(): string {
  return `You are a structure design assistant for "Spine" — pydantic/zod output schemas for LLM pipeline steps.

Field types:
${buildFieldTypesPromptBlock()}

${buildTypeAliasesRulesPromptBlock()}

${buildStructureRulesPromptBlock()}`;
}

function buildUserPrompt(project: Project, message: string, history: ChatTurn[]): string {
  const typeAliasesJson = JSON.stringify(
    (project.typeAliases ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      expr: formatTypeExprPy(t.expr, project.models),
    })),
    null,
    2,
  );
  const modelsJson = JSON.stringify(
    project.models.map((m) => ({
      name: m.name,
      description: m.description,
      auto: m.auto ?? false,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.type,
        typeExpr: f.typeExpr ? fieldTypeExprSource(f, project.models) : undefined,
        optional: f.optional,
        description: f.description,
        examples: f.examples,
        negativeExamples: f.negativeExamples,
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
Current type aliases (${project.typeAliases?.length ?? 0}):
${typeAliasesJson}

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
    raw.models == null
      ? null
      : {
          models: materializeStructureModels(
            raw.models,
            project.models,
            new Set((project.typeAliases ?? []).map((t) => t.name.toLowerCase())),
          ),
        };

  return { message: raw.message, proposal };
}

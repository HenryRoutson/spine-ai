import { z } from "zod";
import { llmStructured } from "./llm";
import {
  ChatTurn,
  resolveStructureIdFromModels,
  structureModelSpecSchema,
} from "./assistant-shared";
import {
  computeInvalid,
  formatPipelineValidationErrors,
  syncAutoQuoteSteps,
} from "./validity";
import { UsageLedger } from "./usage";
import { createPipelineModule } from "@/lib/pipeline-module-factory";
import { uid } from "@/lib/id";
import { USER_ADDABLE_MODULE_KINDS } from "@/lib/module-kinds";
import {
  DEFAULT_MODEL,
  INPUT_TYPES,
  MODEL_OPTIONS,
  MODULE_META,
  type ModelField,
  type ModelId,
  type ModuleId,
  type ModuleKind,
  type PipelineModule,
  type Project,
  type StructureModel,
  type StructureModelId,
} from "./types";

const MODULE_KINDS = USER_ADDABLE_MODULE_KINDS;

const INPUT_TYPE_VALUES = INPUT_TYPES.map((t) => t.value);

const moduleSpecSchema = z.object({
  kind: z.enum(MODULE_KINDS),
  label: z.string(),
  note: z.string().optional(),
  structureIn: z.string().optional(),
  structureOut: z.string().optional(),
  inputType: z.enum(INPUT_TYPE_VALUES as [string, ...string[]]).optional(),
  inputNameContains: z.string().optional(),
  prompt: z.string().optional(),
  code: z.string().optional(),
  model: z.string().optional(),
  outIsList: z.boolean().optional(),
});

const modelSpecSchema = structureModelSpecSchema;

const assistantResponseSchema = z.object({
  message: z.string(),
  modules: z.array(moduleSpecSchema).nullable(),
  models: z.array(modelSpecSchema).nullable(),
});

export type PipelineAssistantModuleSpec = z.infer<typeof moduleSpecSchema>;
export type PipelineAssistantModelSpec = z.infer<typeof modelSpecSchema>;

export type PipelineAssistantProposal = {
  modules: PipelineModule[];
  models: StructureModel[];
};

export type PipelineAssistantResult = {
  message: string;
  proposal: PipelineAssistantProposal | null;
  invalidCount: number;
  validationErrors: string | null;
  retryCount: number;
};

export type PipelineAssistantOpts = {
  fixValidationErrors?: string;
  fixAttempt?: number;
  onRetry?: (attempt: number) => void;
};

const MAX_VALIDATION_RETRIES = 2;

export type { ChatTurn };

function defaultOutForKind(_kind: ModuleKind, models: StructureModel[]): StructureModelId | undefined {
  return models[0]?.id;
}

function makeModuleFromSpec(
  spec: PipelineAssistantModuleSpec,
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule {
  const inId = resolveStructureIdFromModels(spec.structureIn, models);
  const outId = resolveStructureIdFromModels(spec.structureOut, models) ?? defaultOutForKind(spec.kind, models);
  const modelOpt = MODEL_OPTIONS.find((m) => m.id === spec.model);
  return createPipelineModule(
    {
      id: uid<ModuleId>(),
      kind: spec.kind,
      label: spec.label,
      note: spec.note,
      inputType: spec.kind === "input" ? (spec.inputType as PipelineModule["inputType"]) ?? "pdf" : undefined,
      inputNameContains: spec.inputNameContains,
      inStructureId: spec.kind !== "input" ? inId ?? defaultOutForKind(spec.kind, models) : undefined,
      outStructureId: outId,
      outIsList: spec.outIsList,
      prompt: spec.prompt,
      code: spec.code,
      model: modelOpt?.id,
    },
    models,
    globalModel,
  );
}

function expandModuleSpecs(
  specs: PipelineAssistantModuleSpec[],
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule[] {
  const out: PipelineModule[] = [];
  for (const spec of specs) {
    if (spec.kind === "combine") {
      out.push(
        {
          ...makeModuleFromSpec(
            { kind: "input", label: "Document Input", structureOut: spec.structureIn ?? spec.structureOut },
            models,
            globalModel,
          ),
          label: "Document Input",
        },
        makeModuleFromSpec(spec, models, globalModel),
      );
      continue;
    }
    out.push(makeModuleFromSpec(spec, models, globalModel));
  }
  return out;
}

function materializeModels(
  specs: PipelineAssistantModelSpec[] | null | undefined,
  existing: StructureModel[],
): StructureModel[] {
  if (!specs?.length) return existing;
  const byName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));
  const next = [...existing];
  for (const spec of specs) {
    const key = spec.name.toLowerCase();
    if (byName.has(key)) continue;
    const id = uid<StructureModelId>();
    const fields: ModelField[] = spec.fields.map((f) => ({
      id: uid(),
      name: f.name,
      type: f.type as ModelField["type"],
      optional: f.optional,
      description: f.description,
      ref: resolveStructureIdFromModels(f.ref, next),
    }));
    const model: StructureModel = { id, name: spec.name, description: spec.description, fields };
    next.push(model);
    byName.set(key, model);
  }
  return next;
}

function buildSystemPrompt(): string {
  const kinds = MODULE_KINDS.map(
    (k) => `- ${k}: ${MODULE_META[k].label} — ${MODULE_META[k].description}`,
  ).join("\n");
  const models = MODEL_OPTIONS.map((m) => `- ${m.id}: ${m.label}`).join("\n");
  return `You are a pipeline design assistant for "auto pipeline" — a linear left-to-right document processing system.

Module kinds:
${kinds}

Rules:
- Pipelines are strictly linear. Each step must consume ONLY the previous step's output — never an earlier structure with the same model name. combine is the exception: it reads pipeline state (by structure name) plus the document input immediately before it.
- Every step needs an output structure (structureOut). Input steps only need structureOut.
- Reference structures by exact name from the project's models list (e.g. "SourceDocument", "AtomicRule").
- Input steps may set inputNameContains so only documents whose filename includes that substring can fill that slot (useful when a pipeline has multiple inputs).
- combine steps merge pipeline state with a new document — emit ONLY the combine step; a Document Input is auto-inserted before it.
- llm steps with tuple[text,quote] outputs get a Link Quotes step auto-inserted after them — do NOT emit quote steps yourself.
- llm-batch consumes a list and emits a list — set outIsList: true.
- transform reshapes upstream data. When a list feeds a single-object output, include a list field on that structure (prefer list[model] ref = input structure) so transform can wrap items automatically. For matrix/summary reshapes beyond auto-wrap, use custom-code with \`code\` or an llm step — not a bare transform.
- Add output steps wherever a named artifact snapshot is needed — pipelines may have several; each output's structureIn is the structure it materializes (not necessarily the last step).
- Use model ids from: ${models}
- Default LLM model: ${DEFAULT_MODEL}

When the user asks to create or change the pipeline, return a FULL replacement modules array (not a patch).
To clear or remove all steps, return modules as an empty array [] — never null.
When answering questions without pipeline changes, set modules to null.
When new data structures are needed, return models array with field definitions; otherwise null.
The user prompt includes current pipeline validation errors when present — address them when revising the pipeline.
Keep prompts concise and task-specific. Be conversational in message.`;
}

function buildUserPrompt(
  project: Project,
  message: string,
  history: ChatTurn[],
  globalModel: ModelId,
  opts?: PipelineAssistantOpts,
): string {
  const modelsJson = JSON.stringify(
    project.models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      fields: m.fields.map((f) => ({ name: f.name, type: f.type, optional: f.optional, ref: f.ref })),
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
  const currentValidation = formatPipelineValidationErrors(project.modules, project.models);
  const currentValidationBlock = currentValidation
    ? `\nCurrent pipeline validation errors (fix when changing the pipeline; do not replicate these mistakes):\n${currentValidation}\n`
    : "\nCurrent pipeline: valid (no I/O errors).\n";
  const fixBlock = opts?.fixValidationErrors?.trim()
    ? `\nYour previous proposal failed validation (attempt ${opts.fixAttempt ?? 1}). Fix ALL errors below and return a corrected FULL replacement modules array:\n${opts.fixValidationErrors.trim()}\n`
    : "";
  return `Project: ${project.name} (${project.kind})
Default model: ${globalModel}
${historyBlock}
Current structure models:
${modelsJson}

Current pipeline (${project.modules.length} steps):
${modulesJson}
${currentValidationBlock}${fixBlock}
User request: ${message}`;
}

function materializeProposal(
  raw: z.infer<typeof assistantResponseSchema>,
  project: Project,
  globalModel: ModelId,
): PipelineAssistantProposal | null {
  if (raw.modules === null) return null;
  const models = materializeModels(raw.models, project.models);
  const modules = syncAutoQuoteSteps(
    expandModuleSpecs(raw.modules, models, globalModel),
    models,
  );
  return { modules: modules ?? [], models };
}

export async function proposePipelineChange(
  project: Project,
  message: string,
  history: ChatTurn[],
  globalModel: ModelId = DEFAULT_MODEL,
  opts?: PipelineAssistantOpts,
): Promise<PipelineAssistantResult> {
  const ledger = new UsageLedger();
  let fixErrors = opts?.fixValidationErrors;
  let fixAttempt = opts?.fixAttempt ?? 0;
  let raw = await llmStructured(
    buildUserPrompt(project, message, history, globalModel, {
      fixValidationErrors: fixErrors,
      fixAttempt: fixAttempt || undefined,
    }),
    assistantResponseSchema,
    {
      model: globalModel,
      ledger,
      system: buildSystemPrompt(),
    },
  );

  let proposal = materializeProposal(raw, project, globalModel);
  let retryCount = 0;

  for (let retry = 0; retry < MAX_VALIDATION_RETRIES && proposal; retry++) {
    const validationErrors = formatPipelineValidationErrors(proposal.modules, proposal.models);
    if (!validationErrors) break;

    retryCount += 1;
    fixAttempt = retryCount;
    fixErrors = validationErrors;
    opts?.onRetry?.(retryCount);
    raw = await llmStructured(
      buildUserPrompt(project, message, history, globalModel, {
        fixValidationErrors: fixErrors,
        fixAttempt,
      }),
      assistantResponseSchema,
      {
        model: globalModel,
        ledger,
        system: buildSystemPrompt(),
      },
    );
    proposal = materializeProposal(raw, project, globalModel);
  }

  const invalidCount = proposal ? computeInvalid(proposal.modules, proposal.models).size : 0;
  const validationErrors =
    proposal && invalidCount > 0
      ? formatPipelineValidationErrors(proposal.modules, proposal.models)
      : null;

  return { message: raw.message, proposal, invalidCount, validationErrors, retryCount };
}

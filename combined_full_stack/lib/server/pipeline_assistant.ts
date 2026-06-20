import { z } from "zod";
import { llmStructured } from "./llm";
import { computeInvalid, syncAutoQuoteSteps } from "./validity";
import { UsageLedger } from "./usage";
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

const MODULE_KINDS = [
  "input",
  "doc-to-text",
  "llm",
  "llm-batch",
  "transform",
  "combine",
  "custom-code",
  "output",
] as const;

const INPUT_TYPE_VALUES = INPUT_TYPES.map((t) => t.value);

const moduleSpecSchema = z.object({
  kind: z.enum(MODULE_KINDS),
  label: z.string(),
  note: z.string().optional(),
  structureIn: z.string().optional(),
  structureOut: z.string().optional(),
  inputType: z.enum(INPUT_TYPE_VALUES as [string, ...string[]]).optional(),
  prompt: z.string().optional(),
  code: z.string().optional(),
  model: z.string().optional(),
  outIsList: z.boolean().optional(),
  cached: z.boolean().optional(),
});

const modelSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      optional: z.boolean(),
      description: z.string(),
      ref: z.string().optional(),
    }),
  ),
});

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
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

function uid<T extends string = string>(): T {
  return Math.random().toString(36).slice(2, 9) as T;
}

function resolveStructureId(
  hint: string | undefined,
  models: StructureModel[],
): StructureModelId | undefined {
  if (!hint?.trim()) return undefined;
  const key = hint.trim().toLowerCase();
  const byId = models.find((m) => m.id.toLowerCase() === key);
  if (byId) return byId.id;
  const byName = models.find((m) => m.name.toLowerCase() === key);
  return byName?.id;
}

function defaultOutForKind(_kind: ModuleKind, models: StructureModel[]): StructureModelId | undefined {
  return models[0]?.id;
}

function makeModuleFromSpec(
  spec: PipelineAssistantModuleSpec,
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule {
  const isLlm = spec.kind === "llm" || spec.kind === "llm-batch";
  const inId = resolveStructureId(spec.structureIn, models);
  const outId = resolveStructureId(spec.structureOut, models) ?? defaultOutForKind(spec.kind, models);
  const modelOpt = MODEL_OPTIONS.find((m) => m.id === spec.model);
  return {
    id: uid<ModuleId>(),
    kind: spec.kind,
    label: spec.label,
    note: spec.note,
    cached: spec.cached ?? true,
    avgMs: 0,
    avgCostCents: 0,
    inputType: spec.kind === "input" ? (spec.inputType as PipelineModule["inputType"]) ?? "pdf" : undefined,
    inStructureId: spec.kind !== "input" ? inId ?? defaultOutForKind(spec.kind, models) : undefined,
    outStructureId: outId,
    outIsList: spec.outIsList,
    prompt: isLlm ? spec.prompt ?? "" : undefined,
    code: spec.kind === "custom-code" ? spec.code ?? "(input) => input" : undefined,
    model: isLlm ? (modelOpt?.id ?? globalModel) : undefined,
  };
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
      ref: f.ref as StructureModelId | undefined,
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
- combine steps merge pipeline state with a new document — emit ONLY the combine step; a Document Input is auto-inserted before it.
- llm steps with tuple[text,quote] outputs get a Link Quotes step auto-inserted after them — do NOT emit quote steps yourself.
- llm-batch consumes a list and emits a list — set outIsList: true.
- Add output steps wherever a named artifact snapshot is needed — pipelines may have several; each output's structureIn is the structure it materializes (not necessarily the last step).
- Use model ids from: ${models}
- Default LLM model: ${DEFAULT_MODEL}

When the user asks to create or change the pipeline, return a FULL replacement modules array (not a patch).
When answering questions without pipeline changes, set modules to null.
When new data structures are needed, return models array with field definitions; otherwise null.
Keep prompts concise and task-specific. Be conversational in message.`;
}

function buildUserPrompt(project: Project, message: string, history: ChatTurn[], globalModel: ModelId): string {
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
      cached: m.cached,
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
Current structure models:
${modelsJson}

Current pipeline (${project.modules.length} steps):
${modulesJson}

User request: ${message}`;
}

export async function proposePipelineChange(
  project: Project,
  message: string,
  history: ChatTurn[],
  globalModel: ModelId = DEFAULT_MODEL,
): Promise<PipelineAssistantResult> {
  const ledger = new UsageLedger();
  const raw = await llmStructured(
    buildUserPrompt(project, message, history, globalModel),
    assistantResponseSchema,
    {
      model: globalModel,
      ledger,
      system: buildSystemPrompt(),
    },
  );

  const models = materializeModels(raw.models, project.models);
  const modules = raw.modules?.length
    ? syncAutoQuoteSteps(expandModuleSpecs(raw.modules, models, globalModel), models)
    : null;

  const proposal: PipelineAssistantProposal | null = modules ? { modules, models } : null;

  const invalidCount = modules ? computeInvalid(modules).size : 0;

  return { message: raw.message, proposal, invalidCount };
}

import { z } from "zod";
import { llmStreamString, llmStructured, llmStreamStructured } from "./llm";
import {
  ChatTurn,
  formatValidationBlock,
  parseStructureHint,
  resolveStructureIdFromModels,
  structureModelSpecSchema,
  wantsValidationFix,
} from "./assistant-shared";
import {
  buildProjectAssistantSystemPrompt,
  buildProjectContextBlock,
} from "./assistant-prompt";
import {
  computeInvalid,
  formatPipelineValidationErrors,
  syncAutoQuoteSteps,
} from "./validity";
import { UsageLedger } from "./usage";
import { createPipelineModule } from "@/lib/pipeline-module-factory";
import { uid } from "@/lib/id";
import { USER_ADDABLE_MODULE_KINDS } from "@/lib/module-kinds";
import { materializeStructureModels } from "./structure_assistant";
import { attachAssistantUsage } from "./assistant_billing";
import {
  DEFAULT_MODEL,
  INPUT_TYPES,
  MODEL_OPTIONS,
  type DocLabel,
  type InputType,
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
  inputDescription: z.string().optional(),
  checkInputDescription: z.boolean().optional(),
  prompt: z.string().optional(),
  code: z.string().optional(),
  model: z.string().optional(),
  outIsList: z.boolean().optional(),
});

// AI : patch entry — only the fields the agent wants to change; matched by 0-based index in current pipeline.
const modulePatchEntrySchema = z.object({
  index: z.number().int(),
  label: z.string().optional(),
  note: z.string().optional(),
  structureIn: z.string().optional(),
  structureOut: z.string().optional(),
  inputType: z.enum(INPUT_TYPE_VALUES as [string, ...string[]]).optional(),
  inputNameContains: z.string().optional(),
  inputDescription: z.string().optional(),
  checkInputDescription: z.boolean().optional(),
  prompt: z.string().optional(),
  code: z.string().optional(),
  model: z.string().optional(),
  outIsList: z.boolean().optional(),
});

const modelSpecSchema = structureModelSpecSchema;

const ASSISTANT_DOC_TYPES = ["text", "json"] as const satisfies readonly InputType[];

const docSpecSchema = z.object({
  name: z.string(),
  type: z.enum(ASSISTANT_DOC_TYPES),
  content: z.string().max(32_000),
  label: z.enum(["inference", "training"]).optional(),
});

const assistantResponseSchema = z.object({
  message: z.string(),
  // AI : full replacement wins when non-null; use modulePatch for targeted edits to 1–3 steps.
  modules: z.array(moduleSpecSchema).nullable(),
  modulePatch: z.array(modulePatchEntrySchema).nullable(),
  models: z.array(modelSpecSchema).nullable(),
  docs: z.array(docSpecSchema).nullable(),
});

export type PipelineAssistantModuleSpec = z.infer<typeof moduleSpecSchema>;
export type PipelineAssistantModulePatchEntry = z.infer<typeof modulePatchEntrySchema>;
export type PipelineAssistantModelSpec = z.infer<typeof modelSpecSchema>;
export type ProjectAssistantDocSpec = z.infer<typeof docSpecSchema>;

export type PipelineAssistantProposal = {
  modules: PipelineModule[];
  models: StructureModel[];
  docs: ProjectAssistantDocSpec[];
  changed: {
    modules: boolean;
    models: boolean;
    docs: boolean;
  };
};

export type PipelineAssistantResult = {
  message: string;
  proposal: PipelineAssistantProposal | null;
  invalidCount: number;
  validationErrors: string | null;
  retryCount: number;
  usageCents: number;
};

export type PipelineAssistantOpts = {
  fixValidationErrors?: string;
  fixAttempt?: number;
  onThinkingDelta?: (delta: string) => void;
  onPhase?: (phase: "thinking" | "structuring" | "retrying") => void;
  onThinkingDone?: (text: string) => void;
  // AI : streams the assistant message text as it arrives during the structuring phase.
  onMessageDelta?: (delta: string) => void;
  onLlmResponse?: (label: string, response: unknown) => void;
  onStructuredFailure?: (detail: {
    attempt: number;
    failureKind: string;
    error: string;
  }) => void;
  onValidationFailed?: (attempt: number, errors: string) => void;
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
  const inHint = parseStructureHint(spec.structureIn);
  const outHint = parseStructureHint(spec.structureOut);
  const inId = resolveStructureIdFromModels(inHint?.name ?? spec.structureIn, models);
  const outId =
    resolveStructureIdFromModels(outHint?.name ?? spec.structureOut, models) ??
    defaultOutForKind(spec.kind, models);
  const outIsList = spec.outIsList ?? outHint?.isList ?? false;
  const modelOpt = MODEL_OPTIONS.find((m) => m.id === spec.model);
  return createPipelineModule(
    {
      id: uid<ModuleId>(),
      kind: spec.kind,
      label: spec.label,
      note: spec.note,
      inputType: spec.kind === "input" ? (spec.inputType as PipelineModule["inputType"]) ?? "pdf" : undefined,
      inputNameContains: spec.inputNameContains,
      inputDescription: spec.inputDescription,
      inStructureId: spec.kind !== "input" ? inId ?? defaultOutForKind(spec.kind, models) : undefined,
      outStructureId: outId,
      outIsList,
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
  return materializeStructureModels(specs, existing);
}

// AI : apply a single patch entry onto an existing module — preserves id and all unpatched fields.
function applyModulePatch(
  existing: PipelineModule,
  patch: PipelineAssistantModulePatchEntry,
  models: StructureModel[],
): PipelineModule {
  const inHint = patch.structureIn ? parseStructureHint(patch.structureIn) : undefined;
  const outHint = patch.structureOut ? parseStructureHint(patch.structureOut) : undefined;
  const inId = inHint ? resolveStructureIdFromModels(inHint.name ?? patch.structureIn!, models) : undefined;
  const outId = outHint ? resolveStructureIdFromModels(outHint.name ?? patch.structureOut!, models) : undefined;
  const modelOpt = patch.model ? MODEL_OPTIONS.find((m) => m.id === patch.model) : undefined;
  return { // human - this looks hardcoded
    ...existing,
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(inId !== undefined ? { inStructureId: inId } : {}),
    ...(outId !== undefined ? { outStructureId: outId } : {}),
    ...(patch.inputType !== undefined ? { inputType: patch.inputType as PipelineModule["inputType"] } : {}),
    ...(patch.inputNameContains !== undefined ? { inputNameContains: patch.inputNameContains } : {}),
    ...(patch.inputDescription !== undefined ? { inputDescription: patch.inputDescription } : {}),
    ...(patch.checkInputDescription !== undefined ? { checkInputDescription: patch.checkInputDescription } : {}),
    ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
    ...(patch.code !== undefined ? { code: patch.code } : {}),
    ...(modelOpt !== undefined ? { model: modelOpt.id } : {}),
    ...(patch.outIsList !== undefined ? { outIsList: patch.outIsList } : {}),
  };
}

function applyModulePatches(
  existing: PipelineModule[],
  patches: PipelineAssistantModulePatchEntry[],
  models: StructureModel[],
): PipelineModule[] {
  const result = [...existing];
  for (const patch of patches) {
    if (patch.index >= 0 && patch.index < result.length) {
      result[patch.index] = applyModulePatch(result[patch.index], patch, models);
    }
  }
  return result;
}

function materializeDocs(
  specs: ProjectAssistantDocSpec[] | null | undefined,
): ProjectAssistantDocSpec[] {
  if (!specs?.length) return [];
  return specs.map((d) => ({
    ...d,
    label: (d.label ?? "inference") as DocLabel,
  }));
}

function buildThinkingSystemPrompt(hasValidationErrors: boolean): string {
  return `You are the project assistant for "Spine" — structures, pipeline steps, and inference test documents.

${hasValidationErrors
    ? "The live project has pipeline validation errors — focus on diagnosing and fixing those I/O mismatches. Do not propose a greenfield architecture."
    : "Reason step-by-step: required structures, linear data flow, chunking/map-reduce if inputs may exceed context, which test documents to synthesize, and edge cases."}
Plain text only — no JSON, no markdown headings. Be concise (roughly 150–300 words).`;
}

function buildThinkingUserPrompt(
  project: Project,
  message: string,
  history: ChatTurn[],
  globalModel: ModelId,
  liveValidation: string,
): string {
  const modelsBlock = project.models.length
    ? project.models.map((m) => `- ${m.name}: ${m.description ?? "(no description)"}`).join("\n")
    : "(none yet)";
  const stepsBlock = project.modules.length
    ? project.modules
        .map((m, i) => {
          const outName = project.models.find((x) => x.id === m.outStructureId)?.name;
          const list = m.outIsList ? "list" : "single";
          return `${i + 1}. ${m.label} (${m.kind}) → ${outName ?? "?"} [${list}]`;
        })
        .join("\n")
    : "(empty pipeline)";
  const historyBlock =
    history.length > 0
      ? `\nRecent conversation:\n${history.map((t) => `${t.role}: ${t.content}`).join("\n")}\n`
      : "";
  const validationBlock = formatValidationBlock(
    liveValidation,
    "Current pipeline validation errors (address these if the user wants fixes):",
  );
  return `Project: ${project.name} (${project.kind})
Default model: ${globalModel}
${historyBlock}${validationBlock}
Structure models:
${modelsBlock}

Current pipeline (${project.modules.length} steps):
${stepsBlock}

User request: ${message}`;
}

function buildSystemPrompt(globalModel: ModelId): string {
  return buildProjectAssistantSystemPrompt(globalModel);
}

function buildUserPrompt(
  project: Project,
  message: string,
  history: ChatTurn[],
  globalModel: ModelId,
  opts?: PipelineAssistantOpts,
  thinking?: string,
  liveValidation?: string,
  forceFix?: boolean,
): string {
  const currentValidation =
    liveValidation ?? formatPipelineValidationErrors(project.modules, project.models);
  const currentValidationBlock = formatValidationBlock(
    currentValidation,
    "Current pipeline validation errors (fix when changing the pipeline; do not replicate these mistakes):",
  );
  const fixBlock = opts?.fixValidationErrors?.trim()
    ? `\nYour previous proposal failed validation (attempt ${opts.fixAttempt ?? 1}). Fix ALL errors below and return a corrected FULL replacement modules array (modulePatch MUST be null for validation fixes):\n${opts.fixValidationErrors.trim()}\n`
    : "";
  const forceFixBlock =
    forceFix && currentValidation
      ? `\nThe user asked to fix validation errors on the LIVE project. You MUST return a FULL replacement modules array and models array if needed — modules MUST NOT be null, modulePatch MUST be null. Fix every error above (e.g. add outIsList on upstream steps, align structureIn/structureOut names). In message, briefly say what you fixed — not a generic greenfield overview.\n`
      : "";
  const thinkingBlock = thinking?.trim()
    ? `\nYour prior reasoning (use this; do not repeat it in message):\n${thinking.trim()}\n`
    : "";
  return `${buildProjectContextBlock(project, globalModel, history, `${currentValidationBlock}${thinkingBlock}${fixBlock}${forceFixBlock}`)}
User request: ${message}`;
}

function materializeProposal(
  raw: z.infer<typeof assistantResponseSchema>,
  project: Project,
  globalModel: ModelId,
): PipelineAssistantProposal | null {
  // AI : full rewrite takes priority; patch applies when modules is null but modulePatch has entries.
  const hasPipelineRewrite = raw.modules !== null;
  const hasPipelinePatch = !hasPipelineRewrite && (raw.modulePatch?.length ?? 0) > 0;
  const hasPipelineChange = hasPipelineRewrite || hasPipelinePatch;
  const hasModelChange = raw.models !== null;
  const hasDocChange = raw.docs !== null;
  if (!hasPipelineChange && !hasModelChange && !hasDocChange) return null;

  const models = materializeModels(raw.models, project.models);
  let modules: PipelineModule[];
  if (hasPipelineRewrite) {
    modules = syncAutoQuoteSteps(expandModuleSpecs(raw.modules ?? [], models, globalModel), models) ?? [];
  } else if (hasPipelinePatch) {
    modules = syncAutoQuoteSteps(applyModulePatches(project.modules, raw.modulePatch!, models), models) ?? project.modules;
  } else {
    modules = project.modules;
  }
  const docs = materializeDocs(raw.docs);
  return {
    modules: modules ?? [],
    models,
    docs,
    changed: {
      modules: hasPipelineChange,
      models: hasModelChange,
      docs: hasDocChange,
    },
  };
}

// AI : parses streaming raw JSON and emits only the "message" field value character by character.
// AI : handles JSON string escapes so the emitted text is human-readable, not raw JSON.
function makeMessageExtractor(onMessageDelta: (delta: string) => void): (rawDelta: string) => void {
  let buf = "";
  type State = "searching" | "emitting" | "done";
  let state: State = "searching";

  return (delta: string) => {
    if (state === "done") return;
    buf += delta;

    if (state === "searching") {
      const idx = buf.indexOf('"message"');
      if (idx === -1) {
        // Keep trailing chars in case the key spans a chunk boundary.
        if (buf.length > 20) buf = buf.slice(-20);
        return;
      }
      const after = buf.slice(idx + '"message"'.length);
      const m = after.match(/^\s*:\s*"/);
      if (!m) {
        buf = buf.slice(idx);
        return;
      }
      state = "emitting";
      buf = after.slice(m[0].length);
    }

    if (state === "emitting") {
      let i = 0;
      let toEmit = "";
      while (i < buf.length) {
        const ch = buf[i];
        if (ch === "\\" && i + 1 < buf.length) {
          const esc = buf[i + 1];
          if (esc === "n") toEmit += "\n";
          else if (esc === "t") toEmit += "\t";
          else if (esc === "r") toEmit += "\r";
          else if (esc === '"') toEmit += '"';
          else if (esc === "\\") toEmit += "\\";
          else toEmit += esc;
          i += 2;
        } else if (ch === '"') {
          state = "done";
          i++;
          break;
        } else {
          toEmit += ch;
          i++;
        }
      }
      buf = buf.slice(i);
      if (toEmit) onMessageDelta(toEmit);
    }
  };
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

  const liveValidation = formatPipelineValidationErrors(project.modules, project.models);
  const forceFix = !fixErrors && !!liveValidation && wantsValidationFix(message);

  let thinking = "";
  let llmAttempt = 0;
  try {
    if (!fixErrors && !forceFix) {
      opts?.onPhase?.("thinking");
      thinking = await llmStreamString(
        buildThinkingUserPrompt(project, message, history, globalModel, liveValidation),
        {
          model: globalModel,
          ledger,
          system: buildThinkingSystemPrompt(!!liveValidation),
          maxTokens: 1024,
        },
        (delta) => opts?.onThinkingDelta?.(delta),
      );
      opts?.onThinkingDone?.(thinking);
    }

    opts?.onPhase?.("structuring");
    const msgExtractor = opts?.onMessageDelta
      ? makeMessageExtractor(opts.onMessageDelta)
      : null;
    let raw = await llmStreamStructured(
      buildUserPrompt(
        project,
        message,
        history,
        globalModel,
        {
          fixValidationErrors: fixErrors,
          fixAttempt: fixAttempt || undefined,
        },
        thinking,
        liveValidation,
        forceFix,
      ),
      assistantResponseSchema,
      {
        model: globalModel,
        ledger,
        system: buildSystemPrompt(globalModel),
        onStructuredFailure: (detail) => {
          llmAttempt += 1;
          opts?.onStructuredFailure?.({
            attempt: llmAttempt,
            failureKind: detail.kind,
            error: detail.error,
          });
        },
      },
      (rawDelta) => msgExtractor?.(rawDelta),
    );
    llmAttempt += 1;
    opts?.onLlmResponse?.(fixErrors ? `retry-${fixAttempt}` : "initial", raw);

    let proposal = materializeProposal(raw, project, globalModel);
    let retryCount = 0;

    for (let retry = 0; retry < MAX_VALIDATION_RETRIES && proposal; retry++) {
      const validationErrors = formatPipelineValidationErrors(proposal.modules, proposal.models);
      if (!validationErrors) break;

      retryCount += 1;
      fixAttempt = retryCount;
      fixErrors = validationErrors;
      opts?.onValidationFailed?.(retryCount, validationErrors);
      opts?.onPhase?.("retrying");
    raw = await llmStructured(
      buildUserPrompt(
        project,
        message,
        history,
        globalModel,
        {
          fixValidationErrors: fixErrors,
          fixAttempt,
        },
        thinking,
        liveValidation,
        forceFix,
      ),
        assistantResponseSchema,
        {
          model: globalModel,
          ledger,
          system: buildSystemPrompt(globalModel),
          onStructuredFailure: (detail) => {
            llmAttempt += 1;
            opts?.onStructuredFailure?.({
              attempt: llmAttempt,
              failureKind: detail.kind,
              error: detail.error,
            });
          },
        },
      );
      llmAttempt += 1;
      opts?.onLlmResponse?.(`retry-${retryCount}`, raw);
      proposal = materializeProposal(raw, project, globalModel);
    }

    const invalidCount = proposal ? computeInvalid(proposal.modules, proposal.models).size : 0;
    const validationErrors =
      proposal && invalidCount > 0
        ? formatPipelineValidationErrors(proposal.modules, proposal.models)
        : null;

    return {
      message: raw.message,
      proposal,
      invalidCount,
      validationErrors,
      retryCount,
      usageCents: ledger.totalCents(),
    };
  } catch (err) {
    attachAssistantUsage(err, ledger.totalCents());
    throw err;
  }
}

// AI : unified entry point — structures + pipeline + test docs.
export const proposeProjectChange = proposePipelineChange;

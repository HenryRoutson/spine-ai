import { z } from "zod";
import { llmStreamString, llmStructured, llmStreamStructured } from "./llm";
import {
  ChatTurn,
  collectTypeAliasNames,
  formatValidationBlock,
  materializeStructureModels,
  materializeTypeAliases,
  parseStructureHint,
  resolveStructureIdFromModels,
  structureModelSpecSchema,
  typeAliasSpecSchema,
  wantsValidationFix,
} from "./assistant-shared";
import {
  buildProjectAssistantSystemPrompt,
  buildProjectContextBlock,
  resolveAssistantUserMessage,
} from "./assistant-prompt";
import { stripBuiltinTypeAliases } from "./builtin_types";
import {
  computeInvalid,
  formatPipelineValidationErrors,
  syncManagedPipelineSteps,
} from "./validity";
import { UsageLedger } from "./usage";
import { createPipelineModule } from "@/lib/pipeline-module-factory";
import { migrateModuleSpineTypes, patchSpineOutList } from "./spine_types";
import { stepEmitsList } from "./type_expr";
import { uid } from "@/lib/id";
import { inputTypesAreAllJsonNative } from "@/lib/inference-input-core";
import { USER_ADDABLE_MODULE_KINDS, stepRequiresNote } from "@/lib/module-kinds";
import { attachAssistantUsage } from "./assistant_billing";
import { isUnnamedProjectName } from "@/lib/project-assistant-types";
import { catalogHasModel, resolveModelId } from "./model_catalog";
import {
  DEFAULT_MODEL,
  DocLabel,
  INPUT_TYPES,
  InputType,
  ModuleKind,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type Project,
  type StructureModel,
  type StructureModelId,
  type TypeAlias,
} from "./types";

const MODULE_KINDS = USER_ADDABLE_MODULE_KINDS;

const INPUT_TYPE_VALUES = INPUT_TYPES.map((t) => t.value);

const moduleSpecSchema = z
  .object({
    kind: z.enum(MODULE_KINDS),
    label: z.string(),
    note: z.string().optional(),
    structureIn: z
      .string()
      .optional()
      .describe(
        "Structure name the step reads — combine: pipeline-state structure from an earlier step (required, not list[...])",
      ),
    structureOut: z
      .string()
      .optional()
      .describe("Structure name emitted onto spine — prefix list[...] when step emits multiple items (input multi-upload, llm-batch upstream, custom-code map)"),
    inputType: z
      .enum(INPUT_TYPE_VALUES as [string, ...string[]])
      .optional()
      .describe("input steps: upload type; on combine-only specs: applies to auto-inserted side Document input"),
    inputNameContains: z
      .string()
      .optional()
      .describe("filename substring for this input slot — on combine-only specs: applies to auto-inserted side input"),
    inputDescription: z.string().optional(),
    checkInputDescription: z.boolean().optional(),
    prompt: z.string().optional(),
    code: z
      .string()
      .optional()
      .describe("custom-code only — TypeScript arrow expression e.g. (rows) => rows.map(...)"),
    model: z.string().optional(),
    inputMinCount: z.number().int().min(1).optional(),
  })
  .superRefine((spec, ctx) => {
    if (stepRequiresNote(spec.kind) && !spec.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "note is required for input, combine, and llm steps",
        path: ["note"],
      });
    }
    if (spec.kind === ModuleKind.Input && spec.structureOut?.trim()) {
      const hint = parseStructureHint(spec.structureOut);
      const jsonNative =
        spec.inputType != null && inputTypesAreAllJsonNative([spec.inputType as InputType]);
      if (hint && !jsonNative && hint.name.toLowerCase() !== "document") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "non-JSON input steps must structureOut Document or list[Document] — typed parsing belongs in a later llm/custom-code step",
          path: ["structureOut"],
        });
      }
    }
    if (spec.kind === ModuleKind.LlmBatch && spec.structureIn?.trim()) {
      const inHint = parseStructureHint(spec.structureIn);
      if (inHint?.isList) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "llm-batch structureIn is the list ITEM type (e.g. Document), not list[Document]",
          path: ["structureIn"],
        });
      }
    }
    if (spec.kind === ModuleKind.Combine) {
      if (!spec.structureIn?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "combine requires structureIn — pipeline-state structure from an earlier step (not list[...])",
          path: ["structureIn"],
        });
      }
      const inHint = parseStructureHint(spec.structureIn);
      if (inHint?.isList) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "combine structureIn is the state structure name (e.g. TableRow), not list[TableRow]",
          path: ["structureIn"],
        });
      }
    }
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
  inputMinCount: z.number().int().min(1).optional(),
});

const modelSpecSchema = structureModelSpecSchema;

const ASSISTANT_DOC_TYPES = [InputType.Text, InputType.Json] as const satisfies readonly InputType[];

const docSpecSchema = z.object({
  name: z.string(),
  type: z.enum(ASSISTANT_DOC_TYPES),
  content: z.string().max(32_000),
  label: z.enum([DocLabel.Inference, DocLabel.Training]).optional(),
});

const assistantResponseSchema = z.object({
  message: z.string().describe("Short user-facing summary — not a design doc"),
  // AI : full replacement wins when non-null; use modulePatch for targeted edits to 1–3 steps.
  modules: z
    .array(moduleSpecSchema)
    .nullable()
    .describe("FULL pipeline replacement when restructuring; null when using modulePatch or no pipeline change"),
  modulePatch: z
    .array(modulePatchEntrySchema)
    .nullable()
    .describe("Targeted edits by 0-based step index — null when modules is non-null or on validation-fix retries"),
  models: z
    .array(modelSpecSchema)
    .nullable()
    .describe("FULL structure models array when changing schemas; null when unchanged"),
  typeAliases: z.array(typeAliasSpecSchema).nullable(),
  docs: z.array(docSpecSchema).nullable(),
  // AI : full replacement markdown for project.documentation when pipeline/models change.
  documentationUpdate: z.string().max(48_000).nullable(),
  // AI : rename only when project is still "Untitled Pipeline" — server enforces.
  projectNameUpdate: z.string().max(120).nullable(),
});

export type PipelineAssistantModuleSpec = z.infer<typeof moduleSpecSchema>;
export type PipelineAssistantModulePatchEntry = z.infer<typeof modulePatchEntrySchema>;
export type PipelineAssistantModelSpec = z.infer<typeof modelSpecSchema>;
export type ProjectAssistantDocSpec = z.infer<typeof docSpecSchema>;

export type PipelineAssistantProposal = {
  modules: PipelineModule[];
  models: StructureModel[];
  typeAliases: TypeAlias[];
  docs: ProjectAssistantDocSpec[];
  documentation: string;
  projectName?: string;
  changed: {
    modules: boolean;
    models: boolean;
    typeAliases: boolean;
    docs: boolean;
    documentation: boolean;
    name?: boolean;
  };
};

export type PipelineAssistantResult = {
  message: string;
  proposal: PipelineAssistantProposal | null;
  invalidCount: number;
  validationErrors: string | null;
  retryCount: number;
  usageCents: number;
  promptTokens: number;
  completionTokens: number;
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
  const emitsList = outHint?.isList ?? false;
  const modelId = spec.model && catalogHasModel(spec.model) ? resolveModelId(spec.model) : undefined;
  return createPipelineModule(
    {
      id: uid<ModuleId>(),
      kind: spec.kind,
      label: spec.label,
      note: spec.note,
      inputType: spec.kind === ModuleKind.Input ? (spec.inputType as PipelineModule["inputType"]) ?? InputType.Pdf : undefined,
      inputNameContains: spec.inputNameContains,
      inputDescription: spec.inputDescription,
      inputMinCount: spec.inputMinCount,
      inStructureId: spec.kind !== "input" ? inId ?? defaultOutForKind(spec.kind, models) : undefined,
      outStructureId: outId,
      emitsList,
      prompt: spec.prompt,
      code: spec.code,
      model: modelId,
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
      // AI : skip auto side input when agent already emitted an input step immediately before combine.
      const sideInputPresent = out[out.length - 1]?.kind === ModuleKind.Input;
      if (!sideInputPresent) {
        out.push(
          makeModuleFromSpec(
            {
              kind: ModuleKind.Input,
              label: spec.label?.trim() ? `${spec.label} Document` : "Document Input",
              note: spec.note?.trim() || `Side document for "${spec.label}"`,
              structureOut: "Document",
              inputType: (spec.inputType as InputType | undefined) ?? InputType.Text,
              inputNameContains: spec.inputNameContains,
              inputMinCount: spec.inputMinCount,
              inputDescription:
                spec.inputDescription?.trim() ||
                `Document for combine side slot "${spec.label}"`,
            },
            models,
            globalModel,
          ),
        );
      }
      out.push(makeModuleFromSpec(spec, models, globalModel));
      continue;
    }
    out.push(makeModuleFromSpec(spec, models, globalModel));
  }
  return out;
}

function materializeModels(
  specs: PipelineAssistantModelSpec[] | null | undefined,
  existing: StructureModel[],
  typeAliasNames: Set<string>,
): StructureModel[] {
  if (!specs?.length) return existing;
  return materializeStructureModels(specs, existing, typeAliasNames);
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
  const modelId = patch.model && catalogHasModel(patch.model) ? resolveModelId(patch.model) : undefined;
  let next: PipelineModule = {
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
    ...(modelId !== undefined ? { model: modelId } : {}),
    ...(patch.inputMinCount !== undefined ? { inputMinCount: patch.inputMinCount } : {}),
  };
  if (outHint?.isList !== undefined) {
    next = { ...next, ...patchSpineOutList(next, outHint.isList) };
  }
  return migrateModuleSpineTypes(next);
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
    label: d.label ?? DocLabel.Inference,
  }));
}

function buildThinkingSystemPrompt(hasValidationErrors: boolean): string {
  return `You are the Agent for "Spine" — structures, pipeline steps, and inference test documents.

${hasValidationErrors
    ? "The live project has pipeline validation errors — diagnose each listed mismatch (structure name vs list[structure] cardinality). Plan exact structureOut/list[...] fixes per step. Do not propose a greenfield architecture."
    : "Reason step-by-step: (1) structures needed, (2) linear spine chain with single vs list at each hop, (3) many same-kind files → list[Document] + llm-batch (NOT one llm), (4) two different doc kinds → combine after first doc is processed on spine, (5) synthetic test docs. Flag where validation would fail if list-ness is wrong."}
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
          const list = stepEmitsList(m) ? "list" : "single";
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

User request: ${resolveAssistantUserMessage(project, message, history)}`;
}

function buildSystemPrompt(globalModel: ModelId, projectName: string): string {
  return buildProjectAssistantSystemPrompt(globalModel, projectName);
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
  const userMessage = resolveAssistantUserMessage(project, message, history, {
    fixValidationErrors: opts?.fixValidationErrors,
    forceFix,
  });
  const currentValidation =
    liveValidation ??
      formatPipelineValidationErrors(project.modules, project.models, project.typeAliases ?? []);
  const currentValidationBlock = formatValidationBlock(
    currentValidation,
    "Current pipeline validation errors (fix when changing the pipeline; do not replicate these mistakes):",
  );
  const fixBlock = opts?.fixValidationErrors?.trim()
    ? `\nYour previous proposal failed validation (attempt ${opts.fixAttempt ?? 1}). Fix ALL errors below and return a corrected FULL replacement modules array (modulePatch MUST be null for validation fixes):\n${opts.fixValidationErrors.trim()}\n`
    : "";
  const forceFixBlock =
    forceFix && currentValidation
      ? `\nThe user asked to fix validation errors on the LIVE project. You MUST return a FULL replacement modules array and models array if needed — modules MUST NOT be null, modulePatch MUST be null. Fix every error above (e.g. set structureOut to list[Foo] on upstream steps, align structureIn/structureOut names). In message, briefly say what you fixed — not a generic greenfield overview.\n`
      : "";
  const thinkingBlock = thinking?.trim()
    ? `\nYour prior reasoning (use this; do not repeat it in message):\n${thinking.trim()}\n`
    : "";
  return `${buildProjectContextBlock(project, globalModel, history, `${currentValidationBlock}${thinkingBlock}${fixBlock}${forceFixBlock}`)}
User request: ${userMessage}`;
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
  const hasTypeAliasChange = raw.typeAliases !== null;
  const hasDocChange = raw.docs !== null;
  const hasDocumentationChange = raw.documentationUpdate !== null;
  const trimmedNameUpdate = raw.projectNameUpdate?.trim();
  const hasNameChange =
    !!trimmedNameUpdate &&
    isUnnamedProjectName(project.name) &&
    trimmedNameUpdate !== project.name;
  if (
    !hasPipelineChange &&
    !hasModelChange &&
    !hasTypeAliasChange &&
    !hasDocChange &&
    !hasDocumentationChange &&
    !hasNameChange
  ) {
    return null;
  }

  const aliasNames = collectTypeAliasNames(project.typeAliases ?? [], raw.typeAliases);
  const models = materializeModels(raw.models, project.models, aliasNames);
  const typeAliases =
    raw.typeAliases !== null
      ? stripBuiltinTypeAliases(materializeTypeAliases(raw.typeAliases, project.typeAliases ?? [], models))
      : (project.typeAliases ?? []);
  let modules: PipelineModule[];
  if (hasPipelineRewrite) {
    modules = syncManagedPipelineSteps(expandModuleSpecs(raw.modules ?? [], models, globalModel), models, globalModel) ?? [];
  } else if (hasPipelinePatch) {
    modules = syncManagedPipelineSteps(applyModulePatches(project.modules, raw.modulePatch!, models), models, globalModel) ?? project.modules;
  } else {
    modules = project.modules;
  }
  const docs = materializeDocs(raw.docs);
  return {
    modules: modules ?? [],
    models,
    typeAliases,
    docs,
    documentation: hasDocumentationChange
      ? raw.documentationUpdate!.trim()
      : (project.documentation ?? ""),
    changed: {
      modules: hasPipelineChange,
      models: hasModelChange,
      typeAliases: hasTypeAliasChange,
      docs: hasDocChange,
      documentation: hasDocumentationChange,
      name: hasNameChange,
    },
    ...(hasNameChange ? { projectName: trimmedNameUpdate } : {}),
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

  const liveValidation = formatPipelineValidationErrors(
    project.modules,
    project.models,
    project.typeAliases ?? [],
  );
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
        system: buildSystemPrompt(globalModel, project.name),
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
      const validationErrors = formatPipelineValidationErrors(
        proposal.modules,
        proposal.models,
        proposal.typeAliases ?? [],
      );
      if (!validationErrors) break;

      retryCount += 1;
      fixAttempt = retryCount;
      fixErrors = validationErrors;
      opts?.onValidationFailed?.(retryCount, validationErrors);
      opts?.onPhase?.("retrying");
      // AI : retry must show the failed proposal in context — blank landing projects stay empty otherwise.
      const retryProject: Project = {
        ...project,
        modules: proposal.modules,
        models: proposal.models,
        typeAliases: proposal.typeAliases ?? [],
        documentation: proposal.documentation,
      };
      raw = await llmStructured(
        buildUserPrompt(
          retryProject,
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
          system: buildSystemPrompt(globalModel, project.name),
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
      proposal = materializeProposal(raw, retryProject, globalModel);
    }

    const invalidCount = proposal
      ? computeInvalid(proposal.modules, proposal.models, { typeAliases: proposal.typeAliases ?? [] }).size
      : 0;
    const validationErrors =
      proposal && invalidCount > 0
        ? formatPipelineValidationErrors(
            proposal.modules,
            proposal.models,
            proposal.typeAliases ?? [],
          )
        : null;

    const tokens = ledger.tokenTotals();
    return {
      message: raw.message,
      proposal,
      invalidCount,
      validationErrors,
      retryCount,
      usageCents: ledger.totalCents(),
      promptTokens: tokens.promptTokens,
      completionTokens: tokens.completionTokens,
    };
  } catch (err) {
    attachAssistantUsage(err, ledger.totalCents());
    throw err;
  }
}

// AI : unified entry point — structures + pipeline + test docs.
export const proposeProjectChange = proposePipelineChange;

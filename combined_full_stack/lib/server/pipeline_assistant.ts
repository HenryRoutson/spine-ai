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
  defaultMessageForUiContextOnly,
  dedupeUiContextRefs,
  buildUiContextPromptBlock,
  type UiContextRef,
} from "@/lib/ui-context-types";
import {
  buildHumanSurfacePromptBlock,
  buildProjectAssistantSystemPrompt,
  buildProjectContextBlock,
  buildTestDocsCatalogPromptBlock,
  resolveAssistantUserMessage,
  type AssistantHumanSurface,
  type AssistantTestDocCatalogEntry,
} from "./assistant-prompt";
import {
  buildLastFailedRunPromptBlock,
  buildRecentRunsSummaryPromptBlock,
  type AssistantRunSummary,
} from "@/lib/assistant-observe";
import {
  buildObservePlanSystemPrompt,
  buildObservePlanUserPrompt,
  buildObserveToolResultsPromptBlock,
  executeObserveTools,
  observeToolPlanSchema,
  shouldPlanObserveTools,
} from "./assistant_observe_tools";
import type { Store } from "./store";
import { stripBuiltinTypeAliases } from "./builtin_types";
import { withSharedModels } from "./builtin_models";
import {
  computeInvalid,
  formatPipelineValidationErrors,
  syncManagedPipelineSteps,
} from "./validity";
import { isAutoQuoteStep } from "./validity-sync";
import { UsageLedger } from "./usage";
import { createPipelineModule } from "@/lib/pipeline-module-factory";
import { migrateModuleSpineTypes, patchSpineOutList } from "./spine_types";
import { stepEmitsList } from "./type_expr";
import { uid } from "@/lib/id";
import { inputTypesAreAllJsonNative, inputTypesForModule, isDocToTextInputType } from "@/lib/inference-input-core";
import { USER_ADDABLE_MODULE_KINDS, asModuleKind, kindAlwaysEmitsList, stepRequiresNote } from "@/lib/module-kinds";
import { getConnectAction } from "@/lib/connect-catalog";
import { attachAssistantUsage } from "./assistant_billing";
import { isUnnamedProjectName } from "@/lib/project-assistant-types";
import { diffStructureModels } from "@/lib/proposal-shape-diff";
import { catalogHasModel, resolveModelId } from "./model_catalog";
import {
  DEFAULT_MODEL,
  DocLabel,
  INPUT_TYPES,
  InputType,
  ModuleKind,
  ChatbotMode,
  IfConditionKind,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type Project,
  type StructureModel,
  type StructureModelId,
  type TypeAlias,
} from "./types";
import { blankPipelineModules, functionsOnProject, functionsPromptSummary } from "@/lib/pipeline-functions";
import { flattenPipelineModules, syncForkModules } from "@/lib/fork-pipeline";
import { tryCompileCustomCodeEntry } from "@/lib/custom_code";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { lintPipeline } from "./pipeline_lint";
import { VIBE_THINKING_MAX_TOKENS, coerceVibePipelineModules, type VibeWorkspaceDraft } from "./vibe-coding-workspace";
import {
  harnessDraftHasPipelineWork,
  runVibeCodingHarness,
  vibeHarnessEnabled,
} from "./vibe-coding-harness";
import { buildVibeTopologyPromptBlock, formatTopologyRetryErrors, topologyAdvice } from "./vibe-coding-topology";

const MODULE_KINDS = USER_ADDABLE_MODULE_KINDS;

const INPUT_TYPE_VALUES = INPUT_TYPES.map((t) => t.value);

const assembleBindingsSchema = z.record(
  z.string(),
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("spine") }),
    z.object({ kind: z.literal("state"), label: z.string() }),
    z.object({
      kind: z.literal("path"),
      from: z.union([z.literal("spine"), z.object({ label: z.string() })]),
      path: z.string(),
    }),
  ]),
);

// AI : moduleSpecSchema nested forkBranches; materialize lane modules via expandModuleSpecs.
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
      .describe("Emitted structure — list[Name] for input/llm/custom-code list emit; item name only for llm-batch/example-select/chunk (those always emit list[item])"),
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
    chatbotMode: z.enum(["single", "until-exit"]).optional(),
    maxTurns: z.number().int().min(1).max(200).optional(),
    code: z
      .string()
      .optional()
      .describe("custom-code only — TypeScript arrow expression e.g. (rows) => rows.map(...)"),
    model: z.string().optional(),
    inputMinCount: z.number().int().min(1).optional(),
    assembleBindings: assembleBindingsSchema
      .optional()
      .describe(
        "assemble only — field → spine | { kind: state, label } | { kind: path, from: spine|{label}, path: dotted }",
      ),
    // AI : parallel — author-time fixed branches; structureOut names resolve against project models
    parallelBranches: z
      .array(
        z.object({
          field: z.string(),
          prompt: z.string(),
          structureOut: z.string(),
          model: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .max(32)
      .optional()
      .describe("parallel only — each branch: product field name, prompt, and structureOut model name"),
    forkJoin: z
      .enum(["product", "assemble", "merge"])
      .optional()
      .describe("fork only — product (auto field per lane), assemble (bindings), or merge"),
    forkBranches: z
      .array(
        z.object({
          label: z.string(),
          modules: z.array(z.any()).max(50),
        }),
      )
      .min(1)
      .max(12)
      .optional()
      .describe("fork / if-else — linear lanes; if-else is Then then Else (Else may be empty)"),
    ifCondition: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("path"), path: z.string() }),
        z.object({ kind: z.literal("equals"), path: z.string(), value: z.unknown() }),
      ])
      .optional()
      .describe("if-else only — bool spine path, or equals path + JSON value"),
    n8nNodeType: z
      .string()
      .optional()
      .describe("n8n only — catalog id e.g. piece.set or n8n-nodes-base.set (list_pieces)"),
    n8nParameters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("n8n only — piece params matching the auto-generated form"),
    n8nCode: z.string().optional().describe("n8n only — optional Code-node JS override"),
    connectActionId: z
      .string()
      .optional()
      .describe("connect only — catalog id from list_connect_actions e.g. slack.postMessage"),
    connectParameters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("connect only — params matching the action props"),
  })
  .superRefine((spec, ctx) => {
    if (stepRequiresNote(asModuleKind(spec.kind)) && !spec.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "note is required for input, combine, assemble, parallel, and llm steps",
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
    if (spec.kind === ModuleKind.Assemble && !spec.assembleBindings) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assemble requires assembleBindings",
        path: ["assembleBindings"],
      });
    }
    if (spec.kind === ModuleKind.Fork) {
      if (!spec.forkBranches || spec.forkBranches.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fork requires forkBranches (2–12 linear lanes)",
          path: ["forkBranches"],
        });
      }
    }
    if (spec.kind === ModuleKind.IfElse) {
      if (!spec.ifCondition?.path?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "if-else requires ifCondition.path on the spine",
          path: ["ifCondition"],
        });
      }
    }
    if (spec.kind === ModuleKind.Connect) {
      if (!spec.connectActionId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "connect requires connectActionId from list_connect_actions",
          path: ["connectActionId"],
        });
      } else if (!getConnectAction(spec.connectActionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unknown connect action "${spec.connectActionId}" — use list_connect_actions`,
          path: ["connectActionId"],
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
  assembleBindings: assembleBindingsSchema.optional(),
  ifCondition: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("path"), path: z.string() }),
      z.object({ kind: z.literal("equals"), path: z.string(), value: z.unknown() }),
    ])
    .optional(),
  n8nNodeType: z.string().optional(),
  n8nParameters: z.record(z.string(), z.unknown()).optional(),
  connectActionId: z.string().optional(),
  connectParameters: z.record(z.string(), z.unknown()).optional(),
});

const modelSpecSchema = structureModelSpecSchema;

const ASSISTANT_DOC_TYPES = [InputType.Text, InputType.Markdown, InputType.Latex, InputType.Json] as const satisfies readonly InputType[];
// AI : TODO (media-view-A-types) — assistant-created docs stay text/json; binary clips are uploaded or ingested, not authored as content strings.

const docSpecSchema = z.object({
  name: z.string(),
  type: z.enum(ASSISTANT_DOC_TYPES),
  content: z.string().max(32_000),
  label: z.enum([DocLabel.Inference, DocLabel.Training]).optional(),
});

const proposedActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run_inference"),
    // AI : omit docs → client uses current / default inference assignment.
  }),
  z.object({
    type: z.literal("run_test"),
    testDocName: z.string().min(1).max(256).optional(),
  }),
]);

const assistantResponseSchema = z.object({
  message: z.string().describe(
    "Short user-facing proposal summary — present/future tense ('I'll add…'), never past tense as if already applied. User must Approve first.",
  ),
  // AI : full replacement wins when non-null; use modulePatch for targeted edits to 1–3 steps.
  modules: z
    .array(moduleSpecSchema)
    .nullable()
    .describe("FULL pipeline replacement when restructuring; null when using modulePatch or no pipeline change (prefer modulePatch for small edits to existing steps)"),
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
  // AI : named pipeline for these modules — a new name adds a function and leaves the others unchanged.
  targetFunctionName: z
    .string()
    .max(80)
    .nullish()
    .describe(
      "Name of the function (pipeline) these modules belong to. Null = the currently active function. A new name adds a function without replacing the others.",
    ),
  // AI : client runs these after approve — never claim finished in this turn.
  proposedActions: z.array(proposedActionSchema).max(3).nullish(),
});

export type PipelineAssistantModuleSpec = z.infer<typeof moduleSpecSchema>;
export type PipelineAssistantModulePatchEntry = z.infer<typeof modulePatchEntrySchema>;
export type PipelineAssistantModelSpec = z.infer<typeof modelSpecSchema>;
export type ProjectAssistantDocSpec = z.infer<typeof docSpecSchema>;
export type AssistantProposedAction = z.infer<typeof proposedActionSchema>;

export type PipelineAssistantProposal = {
  modules: PipelineModule[];
  models: StructureModel[];
  typeAliases: TypeAlias[];
  docs: ProjectAssistantDocSpec[];
  documentation: string;
  projectName?: string;
  targetFunctionName?: string;
  proposedActions?: AssistantProposedAction[];
  changed: {
    modules: boolean;
    models: boolean;
    typeAliases: boolean;
    docs: boolean;
    documentation: boolean;
    name?: boolean;
    actions?: boolean;
    function?: boolean;
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
  uiContext?: UiContextRef[];
  // AI : Vibe vs Build — awareness only; never reduces write power.
  humanSurface?: AssistantHumanSurface;
  // AI : Testing-tab catalog so Vibe agent sees the same docs list as Build.
  testDocsCatalog?: AssistantTestDocCatalogEntry[];
  recentRuns?: AssistantRunSummary[];
  lastFailedRun?: AssistantRunSummary | null;
  // AI : Phase 4 — store-backed read tools (get_run / cache / logs) inside the propose loop.
  store?: Store;
  // AI : injected after observe-tool planning; not set by callers.
  observeToolResults?: string;
  onThinkingDelta?: (delta: string) => void;
  onPhase?: (phase: "thinking" | "observing" | "coding" | "structuring" | "retrying") => void;
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

function makeModuleFromSpec(
  spec: PipelineAssistantModuleSpec,
  models: StructureModel[],
  globalModel: ModelId,
  existingId?: ModuleId,
): PipelineModule {
  const inHint = parseStructureHint(spec.structureIn);
  const outHint = parseStructureHint(spec.structureOut);
  const inName = inHint?.name ?? spec.structureIn;
  const outName = outHint?.name ?? spec.structureOut;
  const lookup = withSharedModels(models);
  const inId = resolveStructureIdFromModels(inName, lookup);
  const outId = resolveStructureIdFromModels(outName, lookup);
  // AI : llm-batch/example-select/chunk always emit a list even when the agent wrote the item name.
  const emitsList = kindAlwaysEmitsList(spec.kind) || (outHint?.isList ?? false);
  const modelId = spec.model && catalogHasModel(spec.model) ? resolveModelId(spec.model) : undefined;
  // AI : parallel branches resolve structureOut names → model ids; ids assigned at materialize time
  const parallelBranches =
    spec.kind === ModuleKind.Parallel
      ? (spec.parallelBranches ?? []).map((b) => {
          const hint = parseStructureHint(b.structureOut);
          const branchOut =
            resolveStructureIdFromModels(hint?.name ?? b.structureOut, lookup) ??
            ("" as StructureModelId);
          return {
            id: uid("pbr_"),
            field: b.field,
            prompt: b.prompt,
            outStructureId: branchOut,
            model:
              b.model && catalogHasModel(b.model) ? resolveModelId(b.model) : undefined,
            note: b.note,
          };
        })
      : undefined;

  const forkBranches =
    spec.kind === ModuleKind.Fork || spec.kind === ModuleKind.IfElse
      ? (spec.forkBranches ?? []).map((b) => ({
          id: uid("fbr_"),
          label: b.label,
          modules: expandModuleSpecs(
            (Array.isArray(b.modules) ? b.modules : []) as PipelineAssistantModuleSpec[],
            models,
            globalModel,
          ),
        }))
      : undefined;

  let mod = createPipelineModule(
    {
      id: existingId ?? uid<ModuleId>(),
      kind: asModuleKind(spec.kind),
      label: spec.label,
      note: spec.note,
      inputType: spec.kind === ModuleKind.Input ? (spec.inputType as PipelineModule["inputType"]) ?? InputType.Text : undefined,
      inputNameContains: spec.inputNameContains,
      inputDescription: spec.inputDescription,
      inputMinCount: spec.inputMinCount,
      inStructureId:
        spec.kind !== "input" &&
        spec.kind !== ModuleKind.Assemble &&
        spec.kind !== ModuleKind.Parallel &&
        spec.kind !== ModuleKind.Fork &&
        spec.kind !== ModuleKind.IfElse
          ? inId
          : undefined,
      // AI : assemble/parallel/fork/if-else without structureOut → auto-derive on sync
      outStructureId:
        (spec.kind === ModuleKind.Assemble || spec.kind === ModuleKind.Parallel || spec.kind === ModuleKind.Fork || spec.kind === ModuleKind.IfElse) &&
        !outHint
          ? undefined
          : outId,
      emitsList,
      prompt: spec.prompt,
      code: spec.code,
      model: modelId,
      assembleBindings:
        spec.kind === ModuleKind.Assemble || (spec.kind === ModuleKind.Fork && spec.forkJoin === "assemble")
          ? spec.assembleBindings
          : undefined,
      chatbotMode:
        spec.kind === ModuleKind.Chatbot
          ? (spec.chatbotMode === "single" ? ChatbotMode.Single : ChatbotMode.UntilExit)
          : undefined,
      maxTurns: spec.kind === ModuleKind.Chatbot ? spec.maxTurns : undefined,
      parallelBranches,
      forkJoin: spec.kind === ModuleKind.Fork ? (spec.forkJoin ?? "product") : undefined,
      forkBranches,
      ifCondition:
        spec.kind === ModuleKind.IfElse && spec.ifCondition
          ? spec.ifCondition.kind === "equals"
            ? { kind: IfConditionKind.Equals, path: spec.ifCondition.path, value: spec.ifCondition.value }
            : { kind: IfConditionKind.Path, path: spec.ifCondition.path }
          : undefined,
      n8nNodeType: spec.kind === "n8n" ? spec.n8nNodeType : undefined,
      n8nParameters: spec.kind === "n8n" ? spec.n8nParameters : undefined,
      n8nCode: spec.kind === "n8n" ? spec.n8nCode : undefined,
      connectActionId: spec.kind === "connect" ? spec.connectActionId : undefined,
      connectParameters: spec.kind === "connect" ? spec.connectParameters : undefined,
    },
    models,
    globalModel,
  );
  // AI : do not silently wire models[0] when the agent named a structure that does not exist.
  if (spec.kind !== ModuleKind.Chatbot && outName?.trim() && !outId) {
    const { outType: _drop, ...rest } = mod;
    mod = migrateModuleSpineTypes({ ...rest, outStructureId: undefined });
  }
  if (spec.kind !== ModuleKind.Input && spec.kind !== ModuleKind.Chatbot && inName?.trim() && !inId) {
    const { inType: _drop, ...rest } = mod;
    mod = migrateModuleSpineTypes({ ...rest, inStructureId: undefined });
  }
  return mod;
}

function takeExistingModuleId(
  spec: { kind: string; label?: string },
  existing: PipelineModule[],
  used: Set<string>,
): ModuleId | undefined {
  const label = spec.label?.trim();
  if (label) {
    const hit = existing.find((m) => !used.has(m.id) && m.kind === spec.kind && m.label.trim() === label);
    if (hit) {
      used.add(hit.id);
      return hit.id;
    }
  }
  const hit = existing.find((m) => !used.has(m.id) && m.kind === spec.kind);
  if (hit) {
    used.add(hit.id);
    return hit.id;
  }
  return undefined;
}

function expandModuleSpecs(
  specs: PipelineAssistantModuleSpec[],
  models: StructureModel[],
  globalModel: ModelId,
  existing: PipelineModule[] = [],
): PipelineModule[] {
  const out: PipelineModule[] = [];
  const used = new Set<string>();
  for (const spec of specs) {
    if ((spec as { kind?: string }).kind === ModuleKind.DocToText) continue;
    if (spec.kind === "combine") {
      // AI : skip auto side input when agent already emitted an input step immediately before combine.
      // AI : also skip when 2+ inputs already exist — inserting another Document slot is a phantom third upload.
      const sideInputPresent = out[out.length - 1]?.kind === ModuleKind.Input;
      const existingInputs = out.filter((m) => m.kind === ModuleKind.Input).length;
      if (!sideInputPresent && existingInputs < 2) {
        const sideSpec: PipelineAssistantModuleSpec = {
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
        };
        out.push(
          makeModuleFromSpec(
            sideSpec,
            models,
            globalModel,
            takeExistingModuleId(sideSpec, existing, used),
          ),
        );
      }
      out.push(makeModuleFromSpec(spec, models, globalModel, takeExistingModuleId(spec, existing, used)));
      continue;
    }
    out.push(makeModuleFromSpec(spec, models, globalModel, takeExistingModuleId(spec, existing, used)));
  }
  return out;
}

// AI : assemble consumes the previous spine via bindings — never models[0] leftover from combine structureIn.
function wireAssembleSpineIn(modules: PipelineModule[]): PipelineModule[] {
  return modules.map((m, i) => {
    if (m.kind !== ModuleKind.Assemble) return m;
    const prevOut = i > 0 ? modules[i - 1]?.outStructureId : undefined;
    if (!prevOut) return migrateModuleSpineTypes({ ...m, inStructureId: undefined });
    if (m.inStructureId === prevOut) return m;
    return migrateModuleSpineTypes({ ...m, inStructureId: prevOut });
  });
}

// AI : llm after fork defaults inStructureId to models[0] — consume the auto-derived fork product instead.
function wireForkProductSpineIn(modules: PipelineModule[]): PipelineModule[] {
  return modules.map((m, i) => {
    const prev = i > 0 ? modules[i - 1] : undefined;
    if (!prev || prev.kind !== ModuleKind.Fork) return m;
    if (
      m.kind === ModuleKind.Fork ||
      m.kind === ModuleKind.Assemble ||
      m.kind === ModuleKind.Input ||
      m.kind === ModuleKind.IfElse ||
      m.kind === ModuleKind.Parallel
    ) {
      return m;
    }
    const prevOut = prev.outStructureId;
    if (!prevOut || m.inStructureId === prevOut) return m;
    // AI : drop stale inType so migrate re-derives from the fork product, not models[0].
    return migrateModuleSpineTypes({ ...m, inStructureId: prevOut, inType: undefined });
  });
}

// AI : quoted llm-batch is followed by auto Link Quotes — state["Extract …"] should read the linked list.
function wireAssembleQuoteLabels(modules: PipelineModule[]): PipelineModule[] {
  return modules.map((m) => {
    if (m.kind !== ModuleKind.Assemble || !m.assembleBindings) return m;
    let changed = false;
    const assembleBindings = Object.fromEntries(
      Object.entries(m.assembleBindings).map(([field, src]) => {
        const label =
          src.kind === "state" ? src.label : src.kind === "path" && typeof src.from === "object" ? src.from.label : null;
        if (!label) return [field, src];
        const idx = modules.findIndex((x) => x.label.trim() === label.trim());
        const next = idx >= 0 ? modules[idx + 1] : undefined;
        if (!next || !isAutoQuoteStep(next)) return [field, src];
        changed = true;
        if (src.kind === "state") return [field, { ...src, label: next.label }];
        if (src.kind === "path" && typeof src.from === "object") {
          return [field, { ...src, from: { label: next.label } }];
        }
        return [field, src];
      }),
    );
    return changed ? { ...m, assembleBindings } : m;
  });
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
  const lookup = withSharedModels(models);
  const inId = inHint ? resolveStructureIdFromModels(inHint.name ?? patch.structureIn!, lookup) : undefined;
  const outId = outHint ? resolveStructureIdFromModels(outHint.name ?? patch.structureOut!, lookup) : undefined;
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
    ...(patch.assembleBindings !== undefined ? { assembleBindings: patch.assembleBindings } : {}),
    ...(patch.n8nNodeType !== undefined ? { n8nNodeType: patch.n8nNodeType } : {}),
    ...(patch.n8nParameters !== undefined ? { n8nParameters: patch.n8nParameters } : {}),
    ...(patch.connectActionId !== undefined ? { connectActionId: patch.connectActionId } : {}),
    ...(patch.connectParameters !== undefined ? { connectParameters: patch.connectParameters } : {}),
  };
  if (outHint) {
    next = { ...next, ...patchSpineOutList(next, kindAlwaysEmitsList(existing.kind) || outHint.isList) };
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

function inputsNeedStandInAlign(modules: PipelineModule[], docs: { type: string }[]): boolean {
  if (!docs.length) return false;
  const inputs = modules.filter((m) => m.kind === ModuleKind.Input);
  if (!inputs.length) return false;
  const catalogTypes = new Set(docs.map((d) => d.type));
  const anyMatch = inputs.some((m) => inputTypesForModule(m).some((t) => catalogTypes.has(t)));
  if (anyMatch) return false;
  return docs.every((d) => d.type === InputType.Text || d.type === InputType.Json || d.type === InputType.Markdown);
}

function alignInputTypesToSyntheticDocs(
  modules: PipelineModule[],
  docs: { type: string }[],
): PipelineModule[] {
  if (!docs.length) return modules;
  const jsonOnly = docs.every((d) => d.type === InputType.Json);
  const standInType = jsonOnly ? InputType.Json : InputType.Text;
  return modules.map((m) => {
    if (m.kind !== ModuleKind.Input) return m;
    if (!inputTypesForModule(m).some(isDocToTextInputType)) return m;
    return { ...m, inputType: standInType };
  });
}

function buildThinkingSystemPrompt(hasValidationErrors: boolean): string {
  return `You are the Agent for "Spine" — structures, pipeline steps, and inference test documents.

${hasValidationErrors
    ? "The live project has pipeline validation errors — diagnose each listed mismatch (structure name vs list[structure] cardinality). Plan exact structureOut/list[...] fixes per step. Do not propose a greenfield architecture."
    : `First line MUST be: TOPOLOGY: batch-map | explode | split-join | combine | assemble | fork
${buildVibeTopologyPromptBlock()}
Then reason thoroughly: (1) structures needed, (2) series-parallel spine with single vs list at each hop, (3) many same-kind files → list[Document] + llm-batch (NOT one llm), (4) two different doc kinds: process first on spine, then either combine (raw side upload immediately before combine) OR assemble after both are parsed — never a third upload, (5) independent mixed-kind sub-pipelines that share one input → Fork (lanes + join; lane structureIn is Document), not Parallel (LLM-only) and not serialize, (6) synthetic test docs. Flag where validation would fail if list-ness is wrong.`}
Budget real reasoning — do not rush. Plain text only after the TOPOLOGY line — no JSON, no markdown headings.`;
}

function buildThinkingUserPrompt(
  project: Project,
  message: string,
  history: ChatTurn[],
  globalModel: ModelId,
  liveValidation: string,
  uiContext?: UiContextRef[],
  humanSurface?: AssistantHumanSurface,
  testDocsCatalog?: AssistantTestDocCatalogEntry[],
  recentRuns?: AssistantRunSummary[],
  lastFailedRun?: AssistantRunSummary | null,
): string {
  const modelsBlock = project.models.length
    ? project.models
        .map((m) => {
          const fields = m.fields.map((f) => `${f.name}:${f.type}${f.optional ? "?" : ""}`).join(", ");
          return `- ${m.name} (${fields || "no fields"}): ${m.description ?? ""}`;
        })
        .join("\n")
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
  const uiBlock = buildUiContextPromptBlock(uiContext);
  const surfaceBlock = buildHumanSurfacePromptBlock(humanSurface);
  const testDocsBlock = buildTestDocsCatalogPromptBlock(testDocsCatalog ?? []);
  const recentRunsBlock = buildRecentRunsSummaryPromptBlock(recentRuns ?? []);
  const lastFailedBlock = buildLastFailedRunPromptBlock(lastFailedRun ?? null);
  return `Project: ${project.name} (${project.kind})
Default model: ${globalModel}
${historyBlock}${surfaceBlock}${validationBlock}${uiBlock}${testDocsBlock}${recentRunsBlock}${lastFailedBlock}
${functionsPromptSummary(project)}
Structure models:
${modelsBlock}

Current pipeline (${project.modules.length} steps):
${stepsBlock}

${buildVibeTopologyPromptBlock()}

User request: ${resolveAssistantUserMessage(project, message, history)}
First line of your reply: TOPOLOGY: <name>`;
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
  const uiBlock = buildUiContextPromptBlock(opts?.uiContext);
  const surfaceBlock = buildHumanSurfacePromptBlock(opts?.humanSurface);
  const testDocsBlock = buildTestDocsCatalogPromptBlock(opts?.testDocsCatalog ?? []);
  const recentRunsBlock = buildRecentRunsSummaryPromptBlock(opts?.recentRuns ?? []);
  const lastFailedBlock = buildLastFailedRunPromptBlock(opts?.lastFailedRun ?? null);
  const observeBlock = opts?.observeToolResults?.trim()
    ? `\n${opts.observeToolResults.trim()}\n`
    : "";
  return `${buildProjectContextBlock(project, globalModel, history, `${surfaceBlock}${uiBlock}${testDocsBlock}${recentRunsBlock}${lastFailedBlock}${observeBlock}${currentValidationBlock}${thinkingBlock}${fixBlock}${forceFixBlock}`)}
User request: ${userMessage}`;
}

export function materializeProposal(
  raw: z.infer<typeof assistantResponseSchema>,
  project: Project,
  globalModel: ModelId,
  alignDocs: { type: string }[] = [],
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
  const proposedActions = (raw.proposedActions ?? []).filter(Boolean);
  const hasActions = proposedActions.length > 0;
  const targetFunctionName = raw.targetFunctionName?.trim() || undefined;
  if (
    !hasPipelineChange &&
    !hasModelChange &&
    !hasTypeAliasChange &&
    !hasDocChange &&
    !hasDocumentationChange &&
    !hasNameChange &&
    !hasActions
  ) {
    return null;
  }

  const aliasNames = collectTypeAliasNames(project.typeAliases ?? [], raw.typeAliases);
  let models = materializeModels(raw.models, project.models, aliasNames);
  const modelsReallyChanged = hasModelChange && diffStructureModels(project.models, models).length > 0;
  if (
    !hasPipelineChange &&
    !modelsReallyChanged &&
    !hasTypeAliasChange &&
    !hasDocChange &&
    !hasDocumentationChange &&
    !hasNameChange &&
    !hasActions
  ) {
    return null;
  }
  const typeAliases =
    raw.typeAliases !== null
      ? stripBuiltinTypeAliases(materializeTypeAliases(raw.typeAliases, project.typeAliases ?? [], models))
      : (project.typeAliases ?? []);
  const named = targetFunctionName
    ? functionsOnProject(project).find((fn) => fn.name.toLowerCase() === targetFunctionName.toLowerCase())
    : undefined;
  const baseModules = named
    ? named.modules
    : targetFunctionName
      ? hasPipelineRewrite
        ? []
        : blankPipelineModules()
      : project.modules;
  let modules: PipelineModule[];
  if (hasPipelineRewrite) {
    modules = expandModuleSpecs(raw.modules ?? [], models, globalModel, baseModules);
  } else if (hasPipelinePatch) {
    modules = applyModulePatches(baseModules, raw.modulePatch!, models);
  } else {
    modules = baseModules.length ? baseModules : project.modules;
  }
  const docs = materializeDocs(raw.docs);
  const shouldAlign = docs.length > 0 || inputsNeedStandInAlign(modules, alignDocs);
  if (shouldAlign) {
    modules = alignInputTypesToSyntheticDocs(modules, docs.length ? docs : alignDocs);
  }
  if (hasPipelineChange || shouldAlign) {
    modules = syncManagedPipelineSteps(modules, models, globalModel) ?? modules;
  }
  if (hasPipelineChange) {
    const forkSynced = syncForkModules(modules, models, typeAliases);
    modules = wireAssembleQuoteLabels(wireAssembleSpineIn(wireForkProductSpineIn(forkSynced.modules)));
    models = forkSynced.models;
  }
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
      models: modelsReallyChanged,
      typeAliases: hasTypeAliasChange,
      docs: hasDocChange,
      documentation: hasDocumentationChange,
      name: hasNameChange,
      actions: hasActions,
      function: Boolean(targetFunctionName),
    },
    ...(hasNameChange ? { projectName: trimmedNameUpdate } : {}),
    ...(targetFunctionName ? { targetFunctionName } : {}),
    ...(hasActions ? { proposedActions } : {}),
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

function parseAssistantDraft(draft: VibeWorkspaceDraft): {
  raw: z.infer<typeof assistantResponseSchema> | null;
  schemaErrors: string[];
} {
  if (draft.errors.length) return { raw: null, schemaErrors: [] };
  const parsed = assistantResponseSchema.safeParse({
    message: draft.message || "I'll update the project.",
    modules: draft.modules,
    modulePatch: null,
    models: draft.models,
    typeAliases: draft.typeAliases,
    docs: draft.docs,
    documentationUpdate: draft.documentationUpdate,
    projectNameUpdate: draft.projectNameUpdate,
    targetFunctionName: draft.targetFunctionName,
    proposedActions: draft.proposedActions,
  });
  if (parsed.success) return { raw: parsed.data, schemaErrors: [] };
  return {
    raw: null,
    schemaErrors: parsed.error.issues
      .slice(0, 12)
      .map((i) => `${i.path.length ? i.path.join(".") : "root"}: ${i.message}`),
  };
}

function draftToAssistantRaw(draft: VibeWorkspaceDraft): z.infer<typeof assistantResponseSchema> | null {
  return parseAssistantDraft(draft).raw;
}

export function runVibeWorkspaceChecks(
  draft: VibeWorkspaceDraft,
  project: Project,
  globalModel: ModelId,
  testDocsCatalog: AssistantTestDocCatalogEntry[],
  task?: string,
): string {
  if (draft.errors.length) {
    return `FAIL parse\n${draft.errors.map((e) => `- ${e}`).join("\n")}`;
  }
  const parsed = parseAssistantDraft(draft);
  if (!parsed.raw) {
    const details = parsed.schemaErrors.length
      ? parsed.schemaErrors.map((e) => `- ${e}`).join("\n")
      : "- pipeline.json / structures/*.json / aliases.json do not match the assistant schema";
    return `FAIL schema\n${details}\nFix: non-JSON inputs structureOut Document or list[Document]; llm-batch structureIn is the item name (Document), not list[Document].`;
  }
  const raw = parsed.raw;
  const proposal = materializeProposal(raw, project, globalModel, testDocsCatalog);
  if (!proposal) {
    return "PASS (no project file changes — Q&A only). Write message.md if the user should see a reply.";
  }
  const validation = formatPipelineValidationErrors(
    proposal.modules,
    proposal.models,
    proposal.typeAliases ?? [],
  );
  const compileErrors: string[] = [];
  for (const m of flattenPipelineModules(proposal.modules)) {
    for (const entry of customCodeEntriesForModule(m)) {
      const err = tryCompileCustomCodeEntry(entry);
      if (err) compileErrors.push(`${m.label}: ${err}`);
    }
  }
  const lint = lintPipeline(
    {
      ...project,
      modules: proposal.modules,
      models: proposal.models,
      typeAliases: proposal.typeAliases,
    },
    { includeExport: false },
  );
  const lintErrors = lint.lints.filter((l) => l.severity === "error");
  const ok = !validation && compileErrors.length === 0 && lintErrors.length === 0;
  const kinds = flattenPipelineModules(proposal.modules).map((m) => m.kind);
  const topoHints = task ? topologyAdvice(task, kinds) : [];
  const lines = [ok && !topoHints.length ? "PASS" : topoHints.length && ok ? "FAIL topology" : "FAIL"];
  if (validation) lines.push("I/O:", validation.trim());
  if (compileErrors.length) lines.push("custom-code:", ...compileErrors.map((e) => `- ${e}`));
  if (lintErrors.length) {
    lines.push(
      "lint:",
      ...lintErrors.map((l) => `- ${l.stepLabel ?? l.structureName ?? l.code}: ${l.message}`),
    );
  }
  if (topoHints.length) {
    lines.push("topology:", ...topoHints.map((h) => `- ${h}`));
  }
  if (ok && !topoHints.length) lines.push("I/O valid, custom-code compiled, lint clean.");
  else if (topoHints.length) {
    lines.push("Fix: rewrite pipeline.json from examples/few-shot.md for this TOPOLOGY — do not patch a wrong spine.");
  }
  return lines.join("\n");
}

async function tryVibeFileHarness(args: {
  project: Project;
  task: string;
  thinking: string;
  extraPrompt: string;
  globalModel: ModelId;
  ledger: UsageLedger;
  testDocsCatalog: AssistantTestDocCatalogEntry[];
  onTurn?: (label: string, response: unknown) => void;
  onStructuredFailure?: (detail: { attempt: number; failureKind: string; error: string }) => void;
}): Promise<{
  raw: z.infer<typeof assistantResponseSchema>;
  proposal: PipelineAssistantProposal;
  turns: number;
} | null> {
  const harness = await runVibeCodingHarness({
    project: args.project,
    task: args.task,
    thinking: args.thinking,
    extraPrompt: args.extraPrompt,
    globalModel: args.globalModel,
    ledger: args.ledger,
    testDocsCatalog: args.testDocsCatalog,
    runChecks: (draft) =>
      runVibeWorkspaceChecks(draft, args.project, args.globalModel, args.testDocsCatalog, args.task),
    onTurn: args.onTurn,
    onStructuredFailure: args.onStructuredFailure,
  });
  let draft = harness.draft;
  let harnessRaw = draftToAssistantRaw(draft);
  if (!harnessRaw && Array.isArray(draft.modules)) {
    draft = { ...draft, modules: coerceVibePipelineModules(draft.modules) };
    harnessRaw = draftToAssistantRaw(draft);
  }
  if (!harnessRaw) return null;
  const proposal = materializeProposal(harnessRaw, args.project, args.globalModel, args.testDocsCatalog);
  // AI : empty / Q&A / stub Input+Output file loops must not replace the JSON few-shot path.
  if (!proposal || !harnessDraftHasPipelineWork(draft)) return null;
  return { raw: harnessRaw, proposal, turns: harness.turns };
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
  const uiContext = dedupeUiContextRefs(opts?.uiContext ?? []);
  const effectiveMessage =
    message.trim() || defaultMessageForUiContextOnly(uiContext);

  const liveValidation = formatPipelineValidationErrors(
    project.modules,
    project.models,
    project.typeAliases ?? [],
  );
  const forceFix = !fixErrors && !!liveValidation && wantsValidationFix(effectiveMessage);

  let thinking = "";
  let llmAttempt = 0;
  try {
    if (!fixErrors) {
      opts?.onPhase?.("thinking");
      thinking = await llmStreamString(
        buildThinkingUserPrompt(
          project,
          effectiveMessage,
          history,
          globalModel,
          liveValidation,
          uiContext,
          opts?.humanSurface,
          opts?.testDocsCatalog,
          opts?.recentRuns,
          opts?.lastFailedRun,
        ),
        {
          model: globalModel,
          ledger,
          system: buildThinkingSystemPrompt(!!liveValidation),
          maxTokens: VIBE_THINKING_MAX_TOKENS,
        },
        (delta) => opts?.onThinkingDelta?.(delta),
      );
      opts?.onThinkingDone?.(thinking);
    }

    // AI : Phase 4 — optional read-tool round before structuring (store required).
    let observeToolResults = opts?.observeToolResults;
    if (
      !fixErrors &&
      !forceFix &&
      opts?.store &&
      shouldPlanObserveTools(effectiveMessage, uiContext)
    ) {
      opts.onPhase?.("observing");
      try {
        const plan = await llmStructured(
          buildObservePlanUserPrompt({
            message: effectiveMessage,
            thinking,
            recentRuns: opts.recentRuns,
            lastFailedRun: opts.lastFailedRun,
            uiContext,
          }),
          observeToolPlanSchema,
          {
            model: globalModel,
            ledger,
            system: buildObservePlanSystemPrompt(),
            maxTokens: 512,
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
        opts?.onLlmResponse?.("observe-plan", plan);
        if (plan.tools.length) {
          const results = executeObserveTools(opts.store, project, plan.tools);
          observeToolResults = buildObserveToolResultsPromptBlock(results);
        }
      } catch {
        // AI : observe planning is best-effort — structuring continues without tools.
      }
    }

    const promptOpts: PipelineAssistantOpts = {
      ...opts,
      fixValidationErrors: fixErrors,
      fixAttempt: fixAttempt || undefined,
      uiContext,
      observeToolResults,
    };

    let raw: z.infer<typeof assistantResponseSchema> | undefined;
    let proposal: PipelineAssistantProposal | null = null;
    let harnessUsed = false;
    const catalog = opts?.testDocsCatalog ?? [];
    const extraHarnessPrompt = [
      buildVibeTopologyPromptBlock(),
      buildHumanSurfacePromptBlock(opts?.humanSurface),
      buildUiContextPromptBlock(uiContext),
      formatValidationBlock(
        liveValidation,
        "Current pipeline validation errors (fix when changing the pipeline):",
      ),
      observeToolResults?.trim() ?? "",
    ]
      .filter((b) => b.trim())
      .join("\n");

    // AI : SPINE_VIBE_HARNESS=1 turns the file loop on; miss falls back to few-shot JSON.
    if (!fixErrors && vibeHarnessEnabled()) {
      opts?.onPhase?.("coding");
      try {
        const hit = await tryVibeFileHarness({
          project,
          task: effectiveMessage,
          thinking,
          extraPrompt: extraHarnessPrompt,
          globalModel,
          ledger,
          testDocsCatalog: catalog,
          onTurn: (label, response) => opts?.onLlmResponse?.(label, response),
          onStructuredFailure: (detail) => {
            llmAttempt += 1;
            opts?.onStructuredFailure?.(detail);
          },
        });
        if (hit) {
          harnessUsed = true;
          raw = hit.raw;
          proposal = hit.proposal;
          llmAttempt += hit.turns;
          opts?.onLlmResponse?.("harness-done", { turns: hit.turns });
          if (raw.message && opts?.onMessageDelta) opts.onMessageDelta(raw.message);
        }
      } catch {
        // AI : harness miss — few-shot JSON still runs so the flag cannot ship an empty reply.
      }
    }

    if (!harnessUsed) {
      opts?.onPhase?.("structuring");
      const msgExtractor = opts?.onMessageDelta
        ? makeMessageExtractor(opts.onMessageDelta)
        : null;
      try {
        raw = await llmStreamStructured(
          buildUserPrompt(
            project,
            effectiveMessage,
            history,
            globalModel,
            promptOpts,
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
        proposal = materializeProposal(raw, project, globalModel, catalog);
      } catch (err) {
        // AI : JSON fallback after a file-loop miss must not 500 — the live KYC run threw here.
        raw = {
          message: `I couldn't produce a valid pipeline JSON (${(err as Error).message.slice(0, 240)}). Try the request again.`,
          modules: null,
          modulePatch: null,
          models: null,
          typeAliases: null,
          docs: null,
          documentationUpdate: null,
          projectNameUpdate: null,
          targetFunctionName: null,
          proposedActions: null,
        };
        proposal = null;
      }
    }

    if (!raw) {
      throw new Error("assistant produced no response");
    }

    let retryCount = 0;

    for (let retry = 0; retry < MAX_VALIDATION_RETRIES && proposal; retry++) {
      const ioErrors = formatPipelineValidationErrors(
        proposal.modules,
        proposal.models,
        proposal.typeAliases ?? [],
      );
      const kinds = flattenPipelineModules(proposal.modules).map((m) => m.kind);
      const validationErrors = [ioErrors.trim(), formatTopologyRetryErrors(effectiveMessage, kinds)]
        .filter(Boolean)
        .join("\n\n");
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
          effectiveMessage,
          history,
          globalModel,
          {
            ...promptOpts,
            fixValidationErrors: fixErrors,
            fixAttempt,
            uiContext,
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
      proposal = materializeProposal(raw, retryProject, globalModel, catalog);
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
    const message =
      invalidCount > 0 && validationErrors
        ? `${raw.message}\n\nStill invalid after retries:\n${validationErrors}`
        : raw.message;
    return {
      message,
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

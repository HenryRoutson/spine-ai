// AI : DONE (jank-pipeline-god-object) / DONE (arch-module-union) — PipelineModule is a
// AI :   discriminated union per ModuleKind. Kind-specific keys live only on that variant;
// AI :   other keys type as `undefined` and normalizePipelineModule strips them from storage.
// AI : Wire JSON may still be a flat bag (PipelineModuleBag). Call normalize on ingest.

import {
  ModuleKind,
  type AssembleSource,
  type ChatbotMode,
  type CustomCodeEntry,
  type ForkBranch,
  type ForkJoin,
  type IfCondition,
  type InputCompatWith,
  type InputType,
  type InputTypeSpec,
  type MergePolicy,
  type ModelId,
  type ModuleId,
  type ParallelBranch,
  type StructureModelId,
  type TypeExpr,
  type WebhookBodyMode,
  type WebhookMethod,
} from "./types";

export type PipelineModuleShared = {
  id: ModuleId;
  label: string;
  note: string;
  inStructureId?: StructureModelId;
  outStructureId?: StructureModelId;
  inType?: TypeExpr;
  outType?: TypeExpr;
  cached: boolean;
  auto?: boolean;
  avgMs: number;
  avgCostCents: number;
  // AI : LLM input gate — authored on any kind; shouldCheckInputDescription decides if it runs.
  inputDescription?: string;
  checkInputDescription?: boolean;
};

type InputSlotFields = {
  inputType?: InputTypeSpec;
  inputNameContains?: string;
  inputMinCount?: number;
};

// AI : authored JSON keeps OCR on Input; syncAutoDocToTextSteps expands a derived DocToText step.
type InputOcrAuthoredFields = {
  useOcr?: boolean;
  model?: ModelId;
  prompt?: string;
};

type LlmFields = {
  prompt?: string;
  model?: ModelId;
  costLimitCents?: number;
};

type ExampleSelectFields = LlmFields & {
  exampleContextLabel?: string;
  exampleContextField?: string;
  exampleReasonField?: string;
  examplePreFilterMax?: number;
  examplePromptFields?: string[];
  examplePromptView?: string;
};

type DocToTextFields = {
  prompt?: string;
  model?: ModelId;
  useOcr?: boolean;
};

type CodeFields = {
  code?: string;
  fallbackList?: CustomCodeEntry[];
  maxRunMs?: number;
};

type ChunkFields = {
  chunkSize?: number;
  chunkOverlap?: number;
  chunkTextField?: string;
  fallbackList?: CustomCodeEntry[];
};

type MergeFields = {
  mergePolicy?: MergePolicy;
  mergeCustom?: string;
  mergeStateLabel?: string;
  mergeWrapListField?: string;
  fallbackList?: CustomCodeEntry[];
};

type AssembleFields = {
  assembleBindings?: Record<string, AssembleSource>;
};

type ParallelFields = {
  parallelBranches?: ParallelBranch[];
  costLimitCents?: number;
  model?: ModelId;
};

type ForkFields = {
  forkBranches?: ForkBranch[];
  forkJoin?: ForkJoin;
  assembleBindings?: Record<string, AssembleSource>;
  mergePolicy?: MergePolicy;
};

type ExclusiveFields = {
  forkBranches?: ForkBranch[];
  ifCondition?: IfCondition;
};

type WebhookFields = {
  webhookUrl?: string;
  webhookMethod?: WebhookMethod;
  webhookAuthEnv?: string;
  webhookTimeoutMs?: number;
  webhookIncludeState?: boolean;
  webhookResponsePath?: string;
  webhookBodyMode?: WebhookBodyMode;
  webhookPollStatusUrlPath?: string;
  webhookPollStatusPath?: string;
  webhookPollDoneWhen?: string[];
  webhookPollFailWhen?: string[];
  webhookIngestUrlPath?: string;
  webhookIngestInputType?: InputType;
};

type SqlFields = {
  sql?: string;
  sqlSeedRows?: Record<string, unknown>[];
};

type N8nFields = {
  n8nNodeType?: string;
  n8nNodeVersion?: number;
  n8nParameters?: Record<string, unknown>;
  n8nCode?: string;
  n8nTimeoutMs?: number;
  n8nResponseMode?: "first" | "all" | "jsonPath";
  n8nResponsePath?: string;
};

type ConnectFields = {
  connectActionId?: string;
  connectConnectionId?: string;
  connectParameters?: Record<string, unknown>;
};

type ChatbotFields = {
  chatbotMode?: ChatbotMode;
  maxTurns?: number;
  model?: ModelId;
};

export type PipelineModuleKindFields = {
  [ModuleKind.Input]: InputSlotFields & { inputCompatWith?: InputCompatWith } & InputOcrAuthoredFields;
  [ModuleKind.Combine]: InputSlotFields;
  [ModuleKind.Llm]: LlmFields;
  [ModuleKind.LlmBatch]: LlmFields;
  [ModuleKind.ExampleSelect]: ExampleSelectFields;
  [ModuleKind.DocToText]: DocToTextFields;
  [ModuleKind.Transform]: CodeFields;
  [ModuleKind.CustomCode]: CodeFields;
  [ModuleKind.Assert]: CodeFields;
  [ModuleKind.Chunk]: ChunkFields;
  [ModuleKind.Merge]: MergeFields;
  [ModuleKind.Assemble]: AssembleFields;
  [ModuleKind.Parallel]: ParallelFields;
  [ModuleKind.Fork]: ForkFields;
  [ModuleKind.IfElse]: ExclusiveFields;
  [ModuleKind.Case]: ExclusiveFields;
  [ModuleKind.ControlJoin]: Record<never, never>;
  [ModuleKind.Quote]: Record<never, never>;
  [ModuleKind.HumanReview]: Record<never, never>;
  [ModuleKind.Output]: Record<never, never>;
  [ModuleKind.Webhook]: WebhookFields;
  [ModuleKind.Sql]: SqlFields;
  [ModuleKind.N8n]: N8nFields;
  [ModuleKind.Connect]: ConnectFields;
  [ModuleKind.Chatbot]: ChatbotFields;
};

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

export type PipelineModuleBag = PipelineModuleShared & { kind: ModuleKind } & UnionToIntersection<
  PipelineModuleKindFields[ModuleKind]
>;

export type PipelineModulePatch = Partial<Omit<PipelineModuleBag, "id" | "kind">> &
  Partial<Pick<PipelineModuleBag, "kind">>;

type KindSpecificKey = {
  [K in ModuleKind]: keyof PipelineModuleKindFields[K] & string;
}[ModuleKind];

type PipelineModuleFor<K extends ModuleKind> = PipelineModuleShared & { kind: K } & PipelineModuleKindFields[K] & {
  [P in Exclude<KindSpecificKey, keyof PipelineModuleKindFields[K]>]?: undefined;
};

export type PipelineModule = { [K in ModuleKind]: PipelineModuleFor<K> }[ModuleKind];

export type PipelineModuleOf<K extends ModuleKind> = PipelineModuleFor<K>;

const SHARED_KEYS = [
  "id",
  "kind",
  "label",
  "note",
  "inStructureId",
  "outStructureId",
  "inType",
  "outType",
  "cached",
  "auto",
  "avgMs",
  "avgCostCents",
  "inputDescription",
  "checkInputDescription",
] as const;

export const PIPELINE_MODULE_KIND_KEYS: { [K in ModuleKind]: readonly (keyof PipelineModuleKindFields[K] & string)[] } =
  {
    [ModuleKind.Input]: [
      "inputType",
      "inputNameContains",
      "inputMinCount",
      "inputCompatWith",
      "useOcr",
      "model",
      "prompt",
    ],
    [ModuleKind.Combine]: ["inputType", "inputNameContains", "inputMinCount"],
    [ModuleKind.Llm]: ["prompt", "model", "costLimitCents"],
    [ModuleKind.LlmBatch]: ["prompt", "model", "costLimitCents"],
    [ModuleKind.ExampleSelect]: [
      "prompt",
      "model",
      "costLimitCents",
      "exampleContextLabel",
      "exampleContextField",
      "exampleReasonField",
      "examplePreFilterMax",
      "examplePromptFields",
      "examplePromptView",
    ],
    [ModuleKind.DocToText]: ["prompt", "model", "useOcr"],
    [ModuleKind.Transform]: ["code", "fallbackList", "maxRunMs"],
    [ModuleKind.CustomCode]: ["code", "fallbackList", "maxRunMs"],
    [ModuleKind.Assert]: ["code", "fallbackList", "maxRunMs"],
    [ModuleKind.Chunk]: ["chunkSize", "chunkOverlap", "chunkTextField", "fallbackList"],
    [ModuleKind.Merge]: ["mergePolicy", "mergeCustom", "mergeStateLabel", "mergeWrapListField", "fallbackList"],
    [ModuleKind.Assemble]: ["assembleBindings"],
    [ModuleKind.Parallel]: ["parallelBranches", "costLimitCents", "model"],
    [ModuleKind.Fork]: ["forkBranches", "forkJoin", "assembleBindings", "mergePolicy"],
    [ModuleKind.IfElse]: ["forkBranches", "ifCondition"],
    [ModuleKind.Case]: ["forkBranches", "ifCondition"],
    [ModuleKind.ControlJoin]: [],
    [ModuleKind.Quote]: [],
    [ModuleKind.HumanReview]: [],
    [ModuleKind.Output]: [],
    [ModuleKind.Webhook]: [
      "webhookUrl",
      "webhookMethod",
      "webhookAuthEnv",
      "webhookTimeoutMs",
      "webhookIncludeState",
      "webhookResponsePath",
      "webhookBodyMode",
      "webhookPollStatusUrlPath",
      "webhookPollStatusPath",
      "webhookPollDoneWhen",
      "webhookPollFailWhen",
      "webhookIngestUrlPath",
      "webhookIngestInputType",
    ],
    [ModuleKind.Sql]: ["sql", "sqlSeedRows"],
    [ModuleKind.N8n]: [
      "n8nNodeType",
      "n8nNodeVersion",
      "n8nParameters",
      "n8nCode",
      "n8nTimeoutMs",
      "n8nResponseMode",
      "n8nResponsePath",
    ],
    [ModuleKind.Connect]: ["connectActionId", "connectConnectionId", "connectParameters"],
    [ModuleKind.Chatbot]: ["chatbotMode", "maxTurns", "model"],
  };

const NESTED_LANE_KINDS = new Set<ModuleKind>([ModuleKind.Fork, ModuleKind.IfElse, ModuleKind.Case]);

function allowedKeys(kind: ModuleKind): Set<string> {
  return new Set<string>([...SHARED_KEYS, ...PIPELINE_MODULE_KIND_KEYS[kind]]);
}

export function normalizePipelineModule(raw: PipelineModuleBag | PipelineModule): PipelineModule {
  const kind = raw.kind;
  const allow = allowedKeys(kind);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || !allow.has(key)) continue;
    out[key] = value;
  }
  if (NESTED_LANE_KINDS.has(kind) && Array.isArray(out.forkBranches)) {
    out.forkBranches = (out.forkBranches as ForkBranch[]).map((b) => ({
      ...b,
      modules: normalizePipelineModules(b.modules),
    }));
  }
  return out as PipelineModule;
}

export function normalizePipelineModules(modules: Array<PipelineModuleBag | PipelineModule>): PipelineModule[] {
  return modules.map(normalizePipelineModule);
}

// AI : `{ ...m, field }` on the union loses the discriminant — always go through here.
export function applyPipelineModulePatch(
  current: PipelineModule,
  patch: PipelineModulePatch,
): PipelineModule {
  return normalizePipelineModule({ ...current, ...patch, kind: patch.kind ?? current.kind } as PipelineModuleBag);
}

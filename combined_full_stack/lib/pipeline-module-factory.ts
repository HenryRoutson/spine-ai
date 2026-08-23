import type { CustomCodeEntry, ModelId, ModuleId, PipelineModule, StructureModel, StructureModelId } from "@/lib/types"
import { makeCustomCodeEntry } from "@/lib/custom_code_entries"
import { DEFAULT_ASSERT_TS } from "@/lib/assert_steps"
import { DEFAULT_EXAMPLE_SELECT_PROMPT } from "@/lib/example-select"
import { DEFAULT_CUSTOM_CODE_MAX_RUN_MS } from "@/lib/custom-code-max-run"
import { DEFAULT_LLM_STEP_COST_LIMIT_CENTS } from "@/lib/llm-cost-limit"
import { DEFAULT_WEBHOOK_TIMEOUT_MS } from "@/lib/webhook-step"
import { DEFAULT_N8N_TIMEOUT_MS, piecePropDefaults, getN8nNode } from "@/lib/n8n-catalog"
import {
  DEFAULT_CHATBOT_MAX_TURNS,
  DEFAULT_CHATBOT_MODE,
} from "@/lib/chatbot-step"
import {
  BUILTIN_CHATBOT_PROMPT_ID,
  BUILTIN_CHATBOT_RESULT_ID,
} from "@/lib/server/builtin_models"
import { ChatbotMode, CustomCodeLanguage, InputType, ModuleKind, MODULE_META, WebhookMethod } from "@/lib/types"
import {
  DEFAULT_CHUNK_SIZE,
  resolveMergePolicy,
  syncListOpsStepModule,
} from "@/lib/list-ops-steps"
import { uid } from "@/lib/id"
import { isLlmKind, kindAlwaysEmitsList, stepRequiresNote, usesPassthroughStructure } from "@/lib/module-kinds"
import { defaultForkBranches } from "@/lib/fork-pipeline"
import { migrateModuleSpineTypes, patchSpineOutList } from "@/lib/server/spine_types"
import type { TypeExpr } from "@/lib/server/type_expr"

export type ModuleFactoryOpts = {
  id?: ModuleId
  kind: ModuleKind
  label?: string
  note?: string
  inputType?: PipelineModule["inputType"]
  inputNameContains?: string
  inputDescription?: string
  inputMinCount?: number
  inStructureId?: StructureModelId
  outStructureId?: StructureModelId
  outType?: TypeExpr
  emitsList?: boolean
  prompt?: string
  code?: string
  fallbackList?: CustomCodeEntry[]
  maxRunMs?: number
  model?: ModelId
  costLimitCents?: number
  chunkSize?: number
  chunkOverlap?: number
  chunkTextField?: string
  mergePolicy?: import("@/lib/types").MergePolicy
  mergeCustom?: string
  assembleBindings?: import("@/lib/types").PipelineModule["assembleBindings"]
  parallelBranches?: import("@/lib/types").PipelineModule["parallelBranches"]
  forkBranches?: import("@/lib/types").PipelineModule["forkBranches"]
  forkJoin?: import("@/lib/types").PipelineModule["forkJoin"]
  webhookMethod?: WebhookMethod
  webhookTimeoutMs?: number
  n8nNodeType?: string
  n8nParameters?: Record<string, unknown>
  n8nCode?: string
  n8nTimeoutMs?: number
  chatbotMode?: ChatbotMode
  maxTurns?: number
}

// AI : fallback when legacy data omits note on steps that require it.
export function resolveModuleNote(
  kind: ModuleKind,
  note: string | undefined,
  fallbacks?: { label?: string; inputDescription?: string },
): string {
  const trimmed = note?.trim() ?? ""
  if (trimmed) return trimmed
  if (!stepRequiresNote(kind)) return ""
  return fallbacks?.inputDescription?.trim() || fallbacks?.label?.trim() || ""
}

// AI : shared defaults for UI "add step" and pipeline-assistant materialization.
export function createPipelineModule(
  opts: ModuleFactoryOpts,
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule {
  const { kind } = opts
  const isLlm = isLlmKind(kind)
  const isChatbot = kind === ModuleKind.Chatbot
  const defaultModel = models[0]?.id
  const outStructureId = isChatbot
    ? BUILTIN_CHATBOT_RESULT_ID
    : kind === ModuleKind.Assemble || kind === ModuleKind.Parallel || kind === ModuleKind.Fork
      ? opts.outStructureId
      : usesPassthroughStructure(kind)
        ? opts.outStructureId ?? opts.inStructureId ?? defaultModel
        : opts.outStructureId ?? defaultModel
  const inStructureId = isChatbot
    ? BUILTIN_CHATBOT_PROMPT_ID
    : kind === ModuleKind.Assemble || kind === ModuleKind.Parallel || kind === ModuleKind.Fork
      ? opts.inStructureId
      : kind !== ModuleKind.Input
        ? opts.inStructureId ?? defaultModel
        : undefined
  const spineList = kindAlwaysEmitsList(kind)
    ? true
    : opts.outType != null
      ? opts.outType.kind === "list"
      : opts.emitsList ?? false
  const outType =
    opts.outType ??
    (outStructureId
      ? patchSpineOutList({ outStructureId } as PipelineModule, spineList).outType
      : undefined)
  const base = migrateModuleSpineTypes({
    id: opts.id ?? uid<ModuleId>(),
    kind,
    label: opts.label ?? MODULE_META[kind].label,
    note: resolveModuleNote(kind, opts.note, {
      label: opts.label ?? MODULE_META[kind].label,
      inputDescription: opts.inputDescription,
    }),
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    inputType: kind === ModuleKind.Input ? (opts.inputType ?? InputType.Pdf) : undefined,
    inputNameContains: kind === ModuleKind.Input ? opts.inputNameContains?.trim() || undefined : undefined,
    inputDescription: opts.inputDescription?.trim() || undefined,
    inputMinCount: kind === ModuleKind.Input ? opts.inputMinCount : undefined,
    inStructureId,
    outStructureId,
    ...(outType ? { outType } : {}),
    assembleBindings: kind === ModuleKind.Assemble || (kind === ModuleKind.Fork && opts.forkJoin === "assemble")
      ? (opts.assembleBindings ?? {})
      : undefined,
    parallelBranches: kind === ModuleKind.Parallel ? (opts.parallelBranches ?? []) : undefined,
    forkBranches: kind === ModuleKind.Fork ? (opts.forkBranches ?? defaultForkBranches()) : undefined,
    forkJoin: kind === ModuleKind.Fork ? (opts.forkJoin ?? "product") : undefined,
    prompt: isLlm
      ? opts.prompt ?? (kind === ModuleKind.ExampleSelect ? DEFAULT_EXAMPLE_SELECT_PROMPT : "")
      : undefined,
    fallbackList:
      kind === ModuleKind.CustomCode
        ? (opts.fallbackList ?? [makeCustomCodeEntry(CustomCodeLanguage.TypeScript, opts.code ?? "(input) => input")])
        : kind === ModuleKind.Assert
          ? (opts.fallbackList ?? [makeCustomCodeEntry(CustomCodeLanguage.TypeScript, DEFAULT_ASSERT_TS)])
          : undefined,
    maxRunMs:
      kind === ModuleKind.CustomCode || kind === ModuleKind.Assert
        ? (opts.maxRunMs ?? DEFAULT_CUSTOM_CODE_MAX_RUN_MS)
        : undefined,
    chunkSize: kind === ModuleKind.Chunk ? (opts.chunkSize ?? DEFAULT_CHUNK_SIZE) : undefined,
    chunkOverlap: kind === ModuleKind.Chunk ? (opts.chunkOverlap ?? 0) : undefined,
    chunkTextField: kind === ModuleKind.Chunk ? opts.chunkTextField : undefined,
    mergePolicy:
      kind === ModuleKind.Merge || (kind === ModuleKind.Fork && (opts.forkJoin ?? "product") === "merge")
        ? (opts.mergePolicy ?? resolveMergePolicy({ kind: ModuleKind.Merge } as PipelineModule))
        : undefined,
    mergeCustom: kind === ModuleKind.Merge ? opts.mergeCustom : undefined,
    model: isLlm || isChatbot ? opts.model ?? globalModel : undefined,
    costLimitCents:
      isLlm || kind === ModuleKind.Parallel
        ? opts.costLimitCents ?? DEFAULT_LLM_STEP_COST_LIMIT_CENTS
        : undefined,
    webhookMethod: kind === ModuleKind.Webhook ? (opts.webhookMethod ?? WebhookMethod.Post) : undefined,
    webhookTimeoutMs: kind === ModuleKind.Webhook ? (opts.webhookTimeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS) : undefined,
    n8nNodeType: kind === ModuleKind.N8n ? (opts.n8nNodeType ?? "n8n-nodes-base.set") : undefined,
    n8nParameters:
      kind === ModuleKind.N8n
        ? (opts.n8nParameters ??
          piecePropDefaults(getN8nNode(opts.n8nNodeType ?? "n8n-nodes-base.set") ?? { props: [], id: "", n8nNodeType: "", displayName: "", description: "", category: "", n8nCode: "" }))
        : undefined,
    n8nCode: kind === ModuleKind.N8n ? opts.n8nCode : undefined,
    n8nTimeoutMs: kind === ModuleKind.N8n ? (opts.n8nTimeoutMs ?? DEFAULT_N8N_TIMEOUT_MS) : undefined,
    chatbotMode: isChatbot
      ? (opts.chatbotMode ??
        (DEFAULT_CHATBOT_MODE === "single" ? ChatbotMode.Single : ChatbotMode.UntilExit))
      : undefined,
    maxTurns: isChatbot ? (opts.maxTurns ?? DEFAULT_CHATBOT_MAX_TURNS) : undefined,
  })
  if (kind === ModuleKind.Chunk || kind === ModuleKind.Merge) {
    return syncListOpsStepModule(base, models).module
  }
  return base
}

export function makeModule(
  kind: ModuleKind,
  models: StructureModel[],
  globalModel: ModelId,
): PipelineModule {
  return createPipelineModule({ kind }, models, globalModel)
}

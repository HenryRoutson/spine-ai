import { LegacyModuleKind, ModuleKind } from "@/lib/types"
import type { RunStepKind } from "@/lib/types"

// AI : kinds users can add in the builder / pipeline assistant (quote is auto-managed).
// AI : string literals — tsx can drop ModuleKind.Fork from the enum re-export.
export const USER_ADDABLE_MODULE_KINDS = [
  "input",
  "llm",
  "llm-batch",
  "example-select",
  "transform",
  "chunk",
  "merge",
  "assemble",
  "parallel",
  "fork",
  "if-else",
  "case",
  "control-join",
  "combine",
  "custom-code",
  "assert",
  "human-review",
  "webhook",
  "sql",
  "n8n",
  "connect",
  "chatbot",
  "output",
] as const

export type UserAddableModuleKind = (typeof USER_ADDABLE_MODULE_KINDS)[number]

const ADDABLE_KIND_ALIASES: Record<string, UserAddableModuleKind> = {
  code: "custom-code",
  js: "custom-code",
  javascript: "custom-code",
  llmbatch: "llm-batch",
  http: "webhook",
  sql: "sql",
  piece: "n8n",
  app: "connect",
  dag: "fork",
  ifelse: "if-else",
  if: "if-else",
  cond: "if-else",
  router: "if-else",
  switch: "case",
  match: "case",
  join: "control-join",
  "xor-join": "control-join",
}

export function parseUserAddableKind(raw: string): UserAddableModuleKind | undefined {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, "-")
  if ((USER_ADDABLE_MODULE_KINDS as readonly string[]).includes(key)) return key as UserAddableModuleKind
  return ADDABLE_KIND_ALIASES[key]
}

// AI : builder picker — Parallel is Fork+product; extra files go through Combine, not a second Input.
export function builderInsertModuleKinds(opts: {
  inForkLane: boolean
  rootInsertAt: number
}): UserAddableModuleKind[] {
  return USER_ADDABLE_MODULE_KINDS.filter((kind) => {
    if (kind === "parallel") return false
    if (opts.inForkLane) return kind !== "input"
    if (opts.rootInsertAt === 0) return kind !== "combine"
    return kind !== "input"
  })
}

// AI : string-enum ModuleKind is nominal — literals need a cast at the enum boundary.
export function asModuleKind(kind: UserAddableModuleKind): ModuleKind {
  return kind as ModuleKind
}

// AI : output/assert/human-review use inStructureId as the spine passthrough contract.
// AI : Chatbot is NOT passthrough — in=ChatbotPrompt, out=ChatbotResult.
// AI : SQL mutates app_sql_rows — cache would freeze the shared number after the first double.
export function stepNeverCaches(kind: ModuleKind | string): boolean {
  return kind === ModuleKind.Sql || kind === "sql"
}

export function usesPassthroughStructure(kind: ModuleKind): boolean {
  return kind === ModuleKind.Output || kind === ModuleKind.Assert || kind === ModuleKind.HumanReview || kind === ModuleKind.ControlJoin
}

// AI : llm + llm-batch share prompt/model fields across UI and server validity.
export const LLM_KINDS: ModuleKind[] = [ModuleKind.Llm, ModuleKind.LlmBatch, ModuleKind.ExampleSelect]

export function isLlmKind(kind: RunStepKind): boolean {
  // AI : string literals — tsx `export *` can drop ModuleKind enum values; LLM_KINDS.includes then misses.
  return kind === "llm" || kind === "llm-batch" || kind === "example-select"
}

// AI : these kinds always put list[item] on the spine — structureOut is the ITEM name, not list[Name].
export function kindAlwaysEmitsList(kind: ModuleKind | string): boolean {
  return kind === ModuleKind.LlmBatch || kind === ModuleKind.ExampleSelect || kind === ModuleKind.Chunk
}

// AI : merge step + legacy list-merge kind string on run logs / migrated modules.
export function isMergeModuleKind(kind: string): boolean {
  return kind === ModuleKind.Merge || kind === LegacyModuleKind.ListMerge
}

// AI : input/combine/llm steps expose Annotation / purpose — must be non-empty when the pipeline is valid.
export function stepRequiresNote(kind: ModuleKind): boolean {
  return (
    kind === ModuleKind.Input ||
    kind === ModuleKind.Combine ||
    kind === ModuleKind.Assemble ||
    kind === ModuleKind.Parallel ||
    kind === ModuleKind.Fork ||
    kind === ModuleKind.IfElse ||
    kind === ModuleKind.Case ||
    kind === ModuleKind.ControlJoin ||
    isLlmKind(kind)
  )
}

// AI : llm steps use prompt/response wording; quote step shows source + extracts → linked spans.
export function stepIoLabels(kind: RunStepKind) {
  if (kind === ModuleKind.Quote) {
    return { inTitle: "Source + extracts", outTitle: "Linked quotes" }
  }
  if (kind === ModuleKind.Chatbot) {
    return { inTitle: "Prompt (ChatbotPrompt)", outTitle: "Chat result" }
  }
  const isLlm = kind === ModuleKind.Llm || kind === ModuleKind.LlmBatch || kind === ModuleKind.ExampleSelect
  return {
    inTitle: isLlm ? "Prompt" : "Input",
    outTitle: isLlm ? "Response" : "Output",
  }
}

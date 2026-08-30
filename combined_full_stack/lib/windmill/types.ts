// AI : Windmill OpenFlow subset — established flow IR. Spine extras live in summaries + x-spine JSON Schema.
export type json_schema = Record<string, unknown>

export type WindmillInputTransform =
  | { type: "static"; value: unknown }
  | { type: "javascript"; expr: string }

export type WindmillRawScriptLanguage = "bun" | "python3" | "postgresql" | "deno" | "nativets"

export type WindmillRawScript = {
  type: "rawscript"
  language: WindmillRawScriptLanguage
  content: string
  input_transforms: Record<string, WindmillInputTransform>
}

export type WindmillIdentity = {
  type: "identity"
}

export type WindmillAiAgent = {
  type: "aiagent"
  input_transforms: {
    user_message: WindmillInputTransform
    system_prompt?: WindmillInputTransform
    output_schema?: WindmillInputTransform
    output_type?: WindmillInputTransform
  }
  tools: unknown[]
}

export type WindmillForloopFlow = {
  type: "forloopflow"
  iterator: WindmillInputTransform
  skip_failures: boolean
  parallel: boolean
  modules: WindmillFlowModule[]
}

export type WindmillBranchOne = {
  type: "branchone"
  branches: { summary?: string; expr: string; modules: WindmillFlowModule[] }[]
  default: WindmillFlowModule[]
}

export type WindmillBranchAll = {
  type: "branchall"
  parallel: boolean
  branches: { summary?: string; skip_failure: boolean; modules: WindmillFlowModule[] }[]
}

export type WindmillFlowModuleValue =
  | WindmillRawScript
  | WindmillIdentity
  | WindmillAiAgent
  | WindmillForloopFlow
  | WindmillBranchOne
  | WindmillBranchAll

export type WindmillFlowModule = {
  id: string
  summary?: string
  value: WindmillFlowModuleValue
  suspend?: { required_events: number }
}

export type WindmillOpenFlow = {
  summary: string
  description: string
  schema: json_schema
  value: { modules: WindmillFlowModule[] }
}

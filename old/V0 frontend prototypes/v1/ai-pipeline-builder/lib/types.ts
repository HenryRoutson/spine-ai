export type FieldType =
  | "str"
  | "int"
  | "float"
  | "bool"
  | "list[str]"
  | "datetime"
  | "model"

export interface ModelField {
  id: string
  name: string
  type: FieldType
  optional: boolean
  description: string
  ref?: string // referenced model id when type === "model"
}

export interface StructureModel {
  id: string
  name: string
  description: string
  fields: ModelField[]
}

export type InputType = "pdf" | "excel" | "word" | "json" | "text" | "image"

export type ModuleKind =
  | "input"
  | "extract"
  | "transform"
  | "llm"
  | "validate"
  | "output"

export interface PipelineModule {
  id: string
  kind: ModuleKind
  label: string
  // config
  inputType?: InputType
  structureId?: string
  prompt?: string
  cached: boolean
  // simulated metrics
  avgMs: number
  avgCostCents: number
}

export type StrategyKind =
  | "single-llm"
  | "rlm"
  | "claude-code"
  | "cheap-agent"

export interface Strategy {
  id: string
  kind: StrategyKind
  name: string
  enabled: boolean
  model: string
  // simulated benchmark results
  accuracy: number // 0-100
  latencyMs: number
  costCents: number
  passRate: number // 0-100 schema validity
}

export const FIELD_TYPES: FieldType[] = [
  "str",
  "int",
  "float",
  "bool",
  "list[str]",
  "datetime",
  "model",
]

export const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel" },
  { value: "word", label: "Word" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
]

export const MODULE_META: Record<
  ModuleKind,
  { label: string; description: string }
> = {
  input: { label: "Input", description: "Ingest a source document" },
  extract: { label: "Extract", description: "Parse raw content to text" },
  transform: { label: "Transform", description: "Reshape or chunk data" },
  llm: { label: "LLM Call", description: "Run a model with a prompt" },
  validate: { label: "Validate", description: "Check output against schema" },
  output: { label: "Output", description: "Emit final structured result" },
}

export const STRATEGY_META: Record<
  StrategyKind,
  { name: string; description: string }
> = {
  "single-llm": {
    name: "Single LLM Call",
    description: "One direct call to a frontier model.",
  },
  rlm: {
    name: "Recursive LM (RLM)",
    description: "Recursively decompose then synthesize.",
  },
  "claude-code": {
    name: "Agent (Frontier)",
    description: "A full coding-agent instance tackling the task.",
  },
  "cheap-agent": {
    name: "Agent (Cheap Model)",
    description: "Agent loop running on a low-cost open model.",
  },
}

export type FieldType =
  | "text"
  | "int"
  | "float"
  | "bool"
  | "datetime"
  | "document"
  | "list[text]"
  | "tuple[text,quote]"
  | "list[tuple[text,quote]]"
  | "model"
  | "list[model]"

export interface ModelField {
  id: string
  name: string
  type: FieldType
  optional: boolean
  description: string
  ref?: string // referenced model id when type === "model" | "list[model]"
}

export interface StructureModel {
  id: string
  name: string
  description: string
  fields: ModelField[]
  auto?: boolean // generated automatically (e.g. by a combine step)
}

export type InputType = "pdf" | "excel" | "word" | "json" | "text" | "web" | "image"

export type ModuleKind =
  | "input"
  | "doc-to-text"
  | "llm"
  | "transform"
  | "combine"
  | "custom-code"
  | "output"

export interface PipelineModule {
  id: string
  kind: ModuleKind
  label: string
  note?: string // annotation, e.g. the "purpose" of a doc-to-text step
  // io contract — every step declares the structure it consumes and emits
  inStructureId?: string
  outStructureId?: string
  // config
  inputType?: InputType
  prompt?: string
  code?: string // for custom-code steps
  model?: string // per-step model override
  cached: boolean
  // simulated metrics
  avgMs: number
  avgCostCents: number
}

export type StrategyKind = "single-llm" | "rlm" | "claude-code" | "cheap-agent"

export interface Strategy {
  id: string
  kind: StrategyKind
  name: string
  enabled: boolean
  model: string
  accuracy: number // 0-100
  latencyMs: number
  costCents: number
  passRate: number // 0-100 schema validity
}

export type DocLabel = "inference" | "training"

export interface DocRef {
  id: string // content hash
  name: string
  type: InputType
  label: DocLabel
  sizeKb: number
  uploadedAt: number
  preview: string
}

// A clickable span that links extracted text back to a source document offset.
export interface SourceQuote {
  text: string
  docId: string
  start: number
  end: number
}

export interface RunStep {
  moduleId: string
  kind: ModuleKind
  label: string
  model?: string
  status: "ok" | "cached" | "error"
  ms: number
  costCents: number
  inputPreview: string
  outputPreview: string
  outputJson?: string
}

export interface PipelineRun {
  id: string
  startedAt: number
  status: "ok" | "error" | "running"
  totalMs: number
  billedCents: number
  savedCents: number
  model: string
  steps: RunStep[]
  inputDocId?: string
}

export interface BillingPoint {
  day: string
  [model: string]: number | string
}

export interface ModelOption {
  id: string
  label: string
  provider: string
  flag: string // origin marker for the demo
  costPer1k: number // cents per 1k tokens (blended)
  cheap?: boolean
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "qwen-2.5-72b", label: "Qwen 2.5 72B", provider: "openrouter", flag: "CN", costPer1k: 0.09, cheap: true },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "openrouter", flag: "CN", costPer1k: 0.14, cheap: true },
  { id: "glm-4-plus", label: "GLM-4 Plus", provider: "openrouter", flag: "CN", costPer1k: 0.21, cheap: true },
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "openai", flag: "US", costPer1k: 0.6 },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6", provider: "anthropic", flag: "US", costPer1k: 2.4 },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "google", flag: "US", costPer1k: 0.35 },
]

export const DEFAULT_MODEL = "qwen-2.5-72b"

export const FIELD_TYPES: FieldType[] = [
  "text",
  "int",
  "float",
  "bool",
  "datetime",
  "document",
  "list[text]",
  "tuple[text,quote]",
  "list[tuple[text,quote]]",
  "model",
  "list[model]",
]

export const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
  { value: "web", label: "Web" },
  { value: "image", label: "Image" },
]

export const MODULE_META: Record<
  ModuleKind,
  { label: string; description: string }
> = {
  input: { label: "Input", description: "Ingest a source (pdf, word, web, json…)" },
  "doc-to-text": { label: "Doc → Text", description: "Prebuilt parser, document to text" },
  llm: { label: "LLM Call", description: "Run a model against a prompt + schema" },
  transform: { label: "Transform", description: "Reshape, chunk, or map data" },
  combine: { label: "Combine Inputs", description: "Merge a new input with the pipeline state" },
  "custom-code": { label: "Custom Code", description: "Hand-written step for loops / glue logic" },
  output: { label: "Output", description: "Emit the final structured document" },
}

export const STRATEGY_META: Record<
  StrategyKind,
  { name: string; description: string }
> = {
  "single-llm": { name: "Single LLM Call", description: "One direct call to the model." },
  rlm: { name: "Recursive LM (RLM)", description: "Recursively decompose then synthesize." },
  "claude-code": { name: "Agent (Frontier)", description: "A full coding-agent instance on the task." },
  "cheap-agent": { name: "Agent (Cheap Model)", description: "Agent loop on a low-cost open model." },
}

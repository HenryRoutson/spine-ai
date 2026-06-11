// AI : canonical contract shared with the V0 frontend (`ai-pipeline-builder/lib/types.ts`).
// AI : the frontend stub is presentation-only; this is the real, combinable definition.
// AI : backend-only additions are marked. Everything else is byte-compatible with the stub.

// ---- branded id types (rule 4: differentiate otherwise-shared strings) ----
export type ProjectId = string & { __brand: "ProjectId" };
export type StructureModelId = string & { __brand: "StructureModelId" };
export type ModuleId = string & { __brand: "ModuleId" };
export type DocId = string & { __brand: "ContentHash" }; // content hash == id
export type RunId = string & { __brand: "RunId" };
export type ModelId = string; // demo model id, e.g. "qwen-2.5-72b" (see MODEL_OPTIONS)
export type OpenRouterSlug = string & { __brand: "OpenRouterSlug" };

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
  | "list[model]";

export interface ModelField {
  id: string;
  name: string;
  type: FieldType;
  optional: boolean;
  description: string;
  ref?: StructureModelId; // referenced model id when type === "model" | "list[model]"
}

export interface StructureModel {
  id: StructureModelId;
  name: string;
  description: string;
  fields: ModelField[];
  auto?: boolean; // generated automatically (e.g. by a combine step)
}

export type InputType = "pdf" | "excel" | "word" | "json" | "text" | "web" | "image";

export type ModuleKind =
  | "input"
  | "doc-to-text"
  | "llm"
  | "llm-batch" // AI : backend addition — one structured call per list item, merged typed list out
  | "transform"
  | "combine"
  | "custom-code"
  | "output";

export interface PipelineModule {
  id: ModuleId;
  kind: ModuleKind;
  label: string;
  note?: string; // annotation, e.g. the "purpose" of a doc-to-text step
  // io contract — every step declares the structure it consumes and emits
  inStructureId?: StructureModelId;
  outStructureId?: StructureModelId;
  // config
  inputType?: InputType;
  prompt?: string;
  code?: string; // for custom-code steps
  model?: ModelId; // per-step model override
  cached: boolean;
  // AI : backend-only — llm/transform steps may emit a list of `outStructure` rather than one.
  outIsList?: boolean;
  // metrics (real ones are recomputed from run history, see billing.ts)
  avgMs: number;
  avgCostCents: number;
}

// AI : a project owns its own models, pipeline, strategies (mirrors frontend store.tsx Project).
export interface Project {
  id: ProjectId;
  name: string;
  kind: string;
  models: StructureModel[];
  modules: PipelineModule[];
  strategies: Strategy[];
}

export type StrategyKind = "single-llm" | "rlm" | "claude-code" | "cheap-agent";

export interface Strategy {
  id: string;
  kind: StrategyKind;
  name: string;
  enabled: boolean;
  model: ModelId;
  accuracy: number; // 0-100
  latencyMs: number;
  costCents: number;
  passRate: number; // 0-100 schema validity
}

export type DocLabel = "inference" | "training";

export interface DocRef {
  id: DocId; // content hash
  name: string;
  type: InputType;
  label: DocLabel;
  sizeKb: number;
  uploadedAt: number;
  preview: string;
}

// A clickable span that links extracted text back to a source document offset.
export interface SourceQuote {
  text: string;
  docId: DocId;
  start: number;
  end: number;
}

export type RunStepStatus = "ok" | "cached" | "error";

export interface RunStep {
  moduleId: ModuleId;
  kind: ModuleKind;
  label: string;
  model?: ModelId;
  status: RunStepStatus;
  ms: number;
  costCents: number;
  inputPreview: string;
  outputPreview: string;
  outputJson?: string;
}

export interface PipelineRun {
  id: RunId;
  startedAt: number;
  status: "ok" | "error" | "running";
  totalMs: number;
  billedCents: number;
  savedCents: number;
  model: ModelId;
  steps: RunStep[];
  inputDocId?: DocId;
}

export interface BillingPoint {
  day: string;
  [modelOrService: string]: number | string;
}

export interface ModelOption {
  id: ModelId;
  label: string;
  provider: string;
  flag: string; // origin marker for the demo
  costPer1k: number; // cents per 1k tokens (blended)
  cheap?: boolean;
  // AI : backend-only — the real OpenRouter slug this demo id maps to.
  slug: OpenRouterSlug;
}

// AI : token usage captured on every real LLM call (feeds Logging + Billing).
export interface TokenUsage {
  model: ModelId;
  promptTokens: number;
  completionTokens: number;
}

// ---- registries (kept identical to the frontend stub, plus `slug`) ----

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "qwen-2.5-72b", label: "Qwen 2.5 72B", provider: "openrouter", flag: "CN", costPer1k: 0.09, cheap: true, slug: "qwen/qwen-2.5-72b-instruct" as OpenRouterSlug },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "openrouter", flag: "CN", costPer1k: 0.14, cheap: true, slug: "deepseek/deepseek-chat" as OpenRouterSlug },
  { id: "glm-4-plus", label: "GLM-4 Plus", provider: "openrouter", flag: "CN", costPer1k: 0.21, cheap: true, slug: "z-ai/glm-4-32b" as OpenRouterSlug },
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "openai", flag: "US", costPer1k: 0.6, slug: "openai/gpt-4o-mini" as OpenRouterSlug },
  // AI : bug fix — old slug anthropic/claude-3.5-sonnet is gone from OpenRouter (404).
  { id: "claude-opus-4.6", label: "Claude Opus 4.6", provider: "anthropic", flag: "US", costPer1k: 2.4, slug: "anthropic/claude-opus-4.1" as OpenRouterSlug },
  // AI : demo_outline §3 — the A/B fallback model "if nothing else works well".
  { id: "sonnet-4.7", label: "Claude Sonnet 4.7", provider: "anthropic", flag: "US", costPer1k: 1.5, slug: "anthropic/claude-sonnet-4.5" as OpenRouterSlug },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "google", flag: "US", costPer1k: 0.35, slug: "google/gemini-flash-1.5" as OpenRouterSlug },
];

// AI : default to DeepSeek V3 — cheap Chinese model, maps to deepseek/deepseek-chat, fast + reliable
// AI : for large structured outputs (qwen-2.5-72b on OpenRouter is markedly slower here).
export const DEFAULT_MODEL: ModelId = "deepseek-v3";

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
];

export const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
  { value: "web", label: "Web" },
  { value: "image", label: "Image" },
];

export const MODULE_META: Record<ModuleKind, { label: string; description: string }> = {
  input: { label: "Input", description: "Ingest a source (pdf, word, web, json…)" },
  "doc-to-text": { label: "Doc → Text", description: "Prebuilt parser, document to text" },
  llm: { label: "LLM Call", description: "Run a model against a prompt + schema" },
  "llm-batch": { label: "Batch LLM", description: "One structured call per list item → typed list out" },
  transform: { label: "Transform", description: "Reshape, chunk, or map data" },
  combine: { label: "Combine Inputs", description: "Merge a new input with the pipeline state" },
  "custom-code": { label: "Custom TS Function", description: "Saved (input) => output code step, no LLM cost" },
  output: { label: "Output", description: "Emit the final structured document" },
};

export const STRATEGY_META: Record<StrategyKind, { name: string; description: string }> = {
  "single-llm": { name: "Single LLM Call", description: "One direct call to the model." },
  rlm: { name: "Recursive LM (RLM)", description: "Recursively decompose then synthesize." },
  "claude-code": { name: "Agent (Frontier)", description: "A full coding-agent instance on the task." },
  "cheap-agent": { name: "Agent (Cheap Model)", description: "Agent loop on a low-cost open model." },
};

// AI : map a demo model id to its real OpenRouter slug; falls back to the cheap default.
export function slugFor(modelId: ModelId | undefined): OpenRouterSlug {
  const opt = MODEL_OPTIONS.find((m) => m.id === modelId);
  return opt?.slug ?? ("deepseek/deepseek-chat" as OpenRouterSlug);
}

export function modelOption(modelId: ModelId): ModelOption {
  return MODEL_OPTIONS.find((m) => m.id === modelId) ?? MODEL_OPTIONS[0];
}

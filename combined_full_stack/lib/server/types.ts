// AI : canonical contract shared with the V0 frontend (`ai-pipeline-builder/lib/types.ts`).
// AI : the frontend stub is presentation-only; this is the real, combinable definition.
// AI : backend-only additions are marked. Everything else is byte-compatible with the stub.
// AI : TODO bug — known drift vs the v2 frontend stub to reconcile at merge time:
// AI :   - frontend ModuleKind/MODULE_META lack "llm-batch" (any Record<ModuleKind,…> in
// AI :     frontend COMPONENTS will fail to typecheck once these types land),
// AI :   - frontend DEFAULT_MODEL is "qwen-2.5-72b" (backend: "deepseek-v3"),
// AI :   - frontend MODEL_CATALOG may drift from backend until merge.

import type { TypeExpr } from "./type_expr";

export type { TypeExpr } from "./type_expr";

export type ProjectId = string & { __brand: "ProjectId" };
export type StructureModelId = string & { __brand: "StructureModelId" };
export type TypeAliasId = string & { __brand: "TypeAliasId" };
export type ModuleId = string & { __brand: "ModuleId" };
export type DocId = string & { __brand: "ContentHash" }; // content hash == id
export type RunId = string & { __brand: "RunId" };
export type ModelId = string; // demo model id or routed ref "provider:modelId" (see parseRoutedModel)
export type OpenRouterSlug = string & { __brand: "OpenRouterSlug" };
export type LlmProviderId = string & { __brand: "LlmProviderId" };
export type ProviderModelId = string & { __brand: "ProviderModelId" };

// AI : string values are the persisted wire/DB format (seeds/*.json + supabase rows) — do not rename.
export enum FieldType {
  Text = "text",
  Int = "int",
  Float = "float",
  Bool = "bool",
  Datetime = "datetime",
  Document = "document",
  ListDocument = "list[document]",
  Json = "json",
  ListText = "list[text]",
  TupleTextQuote = "tuple[text,quote]",
  ListTupleTextQuote = "list[tuple[text,quote]]",
  Model = "model",
  ListModel = "list[model]",
}

// AI : shown in Structure builder when a field uses type json
export const JSON_FIELD_PREFER_STRUCTURE_MSG =
  "JSON fields store serialized data — prefer a typed structure (model / list[model]) when you can.";

export interface ModelField {
  id: string;
  name: string;
  type: FieldType;
  optional: boolean;
  description: string;
  examples?: string[]; // AI : sample values — shown in structure UI and emitted in pydantic / LLM schema hints
  negativeExamples?: string[]; // AI : counterexamples — invalid values the LLM must not emit
  ref?: StructureModelId; // referenced model id when type === "model" | "list[model]"
  minItems?: number; // AI : minimum list length when type is a list[…] field
  typeExpr?: TypeExpr; // AI : when set, overrides type/ref — full Python-style type expression
  // AI : field-level flag (spec § Testing) — false = probabilistic, the value varies across runs
  // AI : (LLM prose like a summary or feedback) so tests ignore it. Missing/true = deterministic
  // AI : (a maths answer, an enum like answer_ABCD) → exact-compared.
  deterministic?: boolean;
  // AI : ± allowed on int/float test compare — field-level (spec § Testing), not per test file.
  testTolerance?: number;
}

// AI : meta-type — one field row inside a StructureDef (structure-of-structures)
export type StructureFieldDef = Pick<
  ModelField,
  "id" | "name" | "type" | "optional" | "description" | "examples" | "negativeExamples" | "ref" | "minItems" | "typeExpr" | "deterministic" | "testTolerance"
>;

export type TolerantFieldPath = {
  path: string;
  tolerance: number;
};

// AI : meta-type — JSON-serializable shape used to define StructureModel entries in seeds / assistants
export type StructureDef = {
  id: StructureModelId;
  name: string;
  description: string;
  fields: StructureFieldDef[];
  auto?: boolean;
  dynamic?: boolean; // AI : inferred at runtime (e.g. homework MarkingSchema from template)
  sourceDocId?: DocId; // AI : document this structure was inferred from
};

export interface StructureModel {
  id: StructureModelId;
  name: string;
  description: string;
  fields: ModelField[];
  auto?: boolean; // generated automatically (e.g. by a combine step)
  dynamic?: boolean; // AI : content shape varies per run — validated against this generic schema
  shared?: boolean; // AI : injected into every project — not persisted per project
  locked?: boolean; // AI : read-only in Structure UI — cannot rename, edit fields, or delete
  sourceDocId?: DocId; // AI : document this structure was inferred from — links back in Structure tab
}

// AI : standalone reusable type — not a struct with fields; referenced by name in type expressions.
export interface TypeAlias {
  id: TypeAliasId;
  name: string;
  description: string;
  expr: TypeExpr;
  shared?: boolean; // AI : injected into every project — not persisted per project
  locked?: boolean; // AI : read-only in Structure UI
}

// AI : string values are the persisted wire/DB format — do not rename.
export enum InputType {
  Pdf = "pdf",
  Excel = "excel",
  Word = "word",
  Json = "json",
  Text = "text",
  Web = "web",
  Image = "image",
}

// AI : input steps accept one type or a subset — e.g. ["word", "pdf"] for company filings.
export type InputTypeSpec = InputType | InputType[];

// AI : string values are the persisted wire/DB format — do not rename.
export enum ModuleKind {
  Input = "input",
  Llm = "llm",
  LlmBatch = "llm-batch", // AI : backend addition — one structured call per list item, merged typed list out
  Quote = "quote", // AI : deterministic — resolve LLM quote strings → source-linked spans
  Transform = "transform",
  Combine = "combine",
  CustomCode = "custom-code",
  Assert = "assert", // AI : validate pipeline state — passthrough spine; code reads step["Label"] keys
  HumanReview = "human-review", // AI : pause in Inference — operator approves or rejects before continuing
  Output = "output",
}

export enum CustomCodeLanguage {
  TypeScript = "typescript",
  Python = "python",
}

// AI : one language key per entry — e.g. { "typescript": "(input) => input" } or { "python": "..." }.
export type CustomCodeEntry = { typescript?: string; python?: string };

// AI : input — built-in PDF/text parser at upload vs OpenRouter vision OCR (handwriting, scans).
export enum DocParseMode {
  Parser = "parser",
  Llm = "llm",
}

// AI : legacy run logs may still reference folded doc-to-text steps.
export enum LegacyModuleKind {
  DocToText = "doc-to-text",
}
export type RunStepKind = ModuleKind | LegacyModuleKind;

export interface PipelineModule {
  id: ModuleId;
  kind: ModuleKind;
  label: string;
  note: string; // annotation / purpose — required on input, combine, and llm steps
  // io contract — every step declares the structure it consumes and emits
  inStructureId?: StructureModelId;
  outStructureId?: StructureModelId;
  // AI : explicit spine types — canonical when set; legacy in/outStructureId + outIsList are synced from these.
  inType?: TypeExpr;
  outType?: TypeExpr;
  // config
  inputType?: InputTypeSpec;
  inputNameContains?: string; // AI : optional filename substring — only matching docs can fill this input slot
  inputDescription?: string; // AI : optional expected input — LLM guard rejects mismatches before the step runs
  checkInputDescription?: boolean; // AI : when false, skip the LLM guard even if inputDescription is set
  // AI : TODO (spec) — outputDescription?: string + checkOutputDescription?: boolean (post-step LLM output guard).
  // AI : TODO (spec) — dynamicOutputSchema?: boolean on llm steps for variable homework-style marking schemas.
  inputMinCount?: number; // AI : minimum documents for this input slot (default 1); pair with outIsList for N submissions
  prompt?: string;
  code?: string; // AI : transform steps with custom code only
  fallbackList?: CustomCodeEntry[]; // AI : custom-code — ordered attempts, first is primary
  model?: ModelId; // per-step model override
  costLimitCents?: number; // AI : per-llm-step spend cap — defaults to $1 when unset
  useOcr?: boolean; // input only — vision OCR when PDF/image is accepted (built-in parser when off)
  cached: boolean;
  // AI : backend-only — llm/transform steps may emit a list of `outStructure` rather than one.
  outIsList?: boolean;
  // AI : pipeline-managed step — auto-inserted Link Quotes; locked in the builder UI.
  auto?: boolean;
  // metrics (real ones are recomputed from run history, see billing.ts)
  avgMs: number;
  avgCostCents: number;
}

type step_label_string = string;
type doc_name_string = string;

// AI : a named, pre-selected inference run — input step label → bundled doc name(s).
// AI : optional per-preset golden outputs let assert steps pass on non-default inputs.
export interface InferencePreset {
  name: string;
  description?: string;
  inputs: Record<step_label_string, doc_name_string | doc_name_string[]>;
  expectedOutputs?: Record<step_label_string, unknown>;
}

// AI : a project owns its own models, pipeline, strategies (mirrors frontend store.tsx Project).
export interface Project {
  id: ProjectId;
  name: string;
  kind: string;
  models: StructureModel[];
  typeAliases?: TypeAlias[];
  modules: PipelineModule[];
  strategies: Strategy[];
  seedDocNames?: string[]; // AI : filenames from seeds/*.json — scopes inference inputs to this project
  expectedOutputs?: Record<string, unknown>; // AI : golden step outputs keyed by step label — assert steps compare at run time
  inferencePresets?: InferencePreset[]; // AI : legacy seed examples — prefer *_inference.json setup files in Documents
  createdAt?: number; // AI : ms since epoch — set when blank/cloned; templates from seeds/*.json omit this
  lastOpenedAt?: number; // AI : ms since epoch — updated when user opens/switches to this project
  documentation?: string; // AI : freeform markdown — prepended to every agent/assistant prompt call to prevent regressions
  teamId?: import("@/lib/team-types").team_id_string; // AI : when set, team members can view/run; bills team owner
  teamReadOnly?: boolean; // AI : true when loaded from another member's account — client disables edits
  teamProjectOwnerId?: import("./require_auth").user_id_string; // AI : runtime-only — owner's user_id when viewing a shared team project
}

export enum StrategyKind {
  SingleLlm = "single-llm",
  ClaudeCode = "claude-code",
  CheapAgent = "cheap-agent",
}

export const STRATEGY_KINDS = [
  StrategyKind.SingleLlm,
  StrategyKind.ClaudeCode,
  StrategyKind.CheapAgent,
] as const satisfies readonly StrategyKind[];

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

// AI : string values are the persisted wire/DB format (seeds/*.json + supabase rows) — do not rename.
// AI : Training is legacy naming for what the UI calls "testing" — see docLabelDisplay().
export enum DocLabel {
  Inference = "inference",
  Training = "training",
}

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

export enum RunStepStatus {
  Ok = "ok",
  Cached = "cached",
  Error = "error",
}

export enum LlmCallStatus {
  Ok = "ok",
  Error = "error",
}

// AI : what failed — provider HTTP, JSON parse, zod/pydantic schema, or post-step output check.
export enum FailureKind {
  Provider = "provider",
  JsonParse = "json_parse",
  Schema = "schema",
  StepOutput = "step_output",
  CostLimit = "cost_limit",
}

export interface RunFailureRecord {
  kind: FailureKind;
  detail: string;
  attempt?: number;
  recovered: boolean;
}

// AI : one OpenRouter round-trip — feeds Logging length + latency distributions.
export interface LlmCallRecord {
  inputChars: number;
  outputChars: number;
  latencyMs: number;
  status: LlmCallStatus;
  attempt?: number;
  promptIndex?: number; // AI : llm-batch item index — rows in the retry grid
  round?: number; // AI : 0-indexed logical attempt column (0 = first try, no retry)
  httpStatus?: number;
  failureKind?: FailureKind;
  failureDetail?: string;
}

export type InputDescriptionCheckItem = {
  matches: boolean;
  reason: string;
  label?: string;
};

export type InputDescriptionCheckResult = {
  matches: boolean;
  reason: string;
  items?: InputDescriptionCheckItem[];
};

export type InputPreviewItem = { label: string; text: string };

export type StepDescriptionFields = {
  outputPreview?: string;
  inputDescriptionCheck?: InputDescriptionCheckResult;
  descriptionCheckLlmCalls?: LlmCallRecord[];
  descriptionCheckCostCents?: number;
};

export interface RunStep extends Omit<StepDescriptionFields, "outputPreview"> {
  moduleId: ModuleId;
  kind: RunStepKind;
  label: string;
  model?: ModelId;
  status: RunStepStatus;
  ms: number;
  costCents: number;
  savedCostCents?: number; // AI : cache hit — original step cost avoided this run (costCents stays 0)
  inputPreview: string;
  inputPreviewItems?: InputPreviewItem[];
  outputPreview: string;
  outputJson?: string;
  inputDescription?: string; // AI : snapshot at run time — expected input for this step
  docId?: DocId; // AI : source doc for input steps — powers logging trace links
  llmCalls?: LlmCallRecord[];
  failures?: RunFailureRecord[];
  serverLogs?: import("@/lib/run-types").JobLogEntry[]; // AI : mirrored ServerLogger lines for this step
}

export type RunFingerprint = string & { __brand: "RunFingerprint" };
export type SharedLinkId = string & { __brand: "SharedLinkId" };
export type HostedApiId = string & { __brand: "HostedApiId" };
export type MarketplaceListingId = string & { __brand: "MarketplaceListingId" };
// AI : Testing — run started from the Testing tab; flagged in Logging (spec § Testing).
export enum RunSource {
  App = "app",
  SharedLink = "shared_link",
  HostedApi = "hosted_api",
  Assistant = "assistant",
  Testing = "testing",
}

// AI : persisted test verdict — expected vs actual per pinned step, attached to the run
// AI : after the Testing tab compares the finished run against its *_testing.json file.
export enum RunTestStepStatus {
  Pass = "pass",
  Fail = "fail",
  // AI : Skipped = input/combine — same data as expected, but run trace is refs/summary only (see skipReason).
  Skipped = "skipped",
  NotReached = "not-reached",
}

export type RunTestProbabilisticResult = {
  path: string;
  pass: boolean;
  reason: string;
  // AI : persisted for Testing/Logging — side-by-side LLM semantic check display.
  expected?: unknown;
  actual?: unknown;
};

export type RunTestDeterministicDiffResult = {
  path: string;
  reason: string;
  expected?: unknown;
  actual?: unknown;
};

export type RunTestStepResult = {
  label: string;
  status: RunTestStepStatus;
  diffPath?: string;
  // AI : per-step input guard verdict from the run — combine + scored steps with inputDescription.
  inputDescriptionCheck?: InputDescriptionCheckResult;
  // AI : why a skipped step was not scored — input/combine traces are refs or summaries, not full values.
  skipReason?: string;
  // AI : probabilistic field paths (ModelField.deterministic === false) excluded from exact JSON compare.
  ignoredPaths?: string[];
  // AI : int/float fields with ModelField.testTolerance — compared with ± instead of exact match.
  tolerantPaths?: TolerantFieldPath[];
  // AI : LLM semantic check for probabilistic fields after deterministic JSON match (spec § Testing).
  probabilisticResults?: RunTestProbabilisticResult[];
  llmEvaluated?: boolean;
  // AI : git-diff style unified diff of deterministic JSON cores when compare fails.
  deterministicDiff?: string;
  // AI : LLM chain-of-thought explanations for each deterministic diff field (spec § Testing).
  deterministicDiffExplanations?: RunTestDeterministicDiffResult[];
  expected?: unknown;
  actual?: unknown;
};

export type RunTestReport = {
  testDocName: string;
  results: RunTestStepResult[];
  // AI : persisted on the run row in Supabase — separate hashes so revert-to-old test/pipeline
  // AI : re-matches a prior verdict without any client-side verdict cache.
  testContentSig?: string;
  pipelineSig?: string;
  /** @deprecated legacy combined sig — match via testReportMatchesSigs only */
  contextSig?: string;
};
export enum SharedLinkFundingMode {
  SharerPays = "sharer_pays",
  ViewerPays = "viewer_pays",
  // AI : owner pays — viewer must sign in but is not billed.
  ViewerSignsIn = "viewer_signs_in",
}

export enum HostedApiFundingMode {
  OwnerPays = "owner_pays",
  CallerPays = "caller_pays",
}

export enum RunStatus {
  Ok = "ok",
  Error = "error",
  Running = "running",
}

export interface PipelineRun {
  id: RunId;
  startedAt: number;
  status: RunStatus;
  totalMs: number;
  billedCents: number;
  savedCents: number;
  model: ModelId;
  steps: RunStep[];
  inputDocId?: DocId;
  inputDocIds?: DocId[]; // AI : all inference inputs, in slot order — powers run dedup + logging
  fingerprint?: RunFingerprint; // AI : hash of pipeline + inputs — identical reruns link here
  notes?: string; // AI : freeform context for this run — set before or after inference
  source?: RunSource;
  test?: RunTestReport; // AI : only on source "testing" runs — keeps the verdict in Logging

  sharedLinkId?: SharedLinkId;
  hostedApiId?: HostedApiId;
  viewerName?: string;
  viewerSessionId?: string;
  triggerUserId?: string;
  triggerUserEmail?: string;
}

export interface BillingPoint {
  day: string;
  [modelOrService: string]: number | string;
}

// AI : client-safe model picker row — no OpenRouter slug or raw token rates.
export interface ModelOptionPublic {
  id: ModelId;
  label: string;
  provider: string; // AI : model vendor from slug prefix (anthropic, openai, …)
  providerId: string; // AI : LLM infrastructure id (openrouter, custom_provider, …)
  costPer1k: number; // cents per 1k tokens (blended, OpenRouter + 40%)
}

export interface ModelOption extends ModelOptionPublic {
  promptUsdPerToken: number; // raw OpenRouter prompt rate (USD/token)
  completionUsdPerToken: number; // raw OpenRouter completion rate (USD/token)
  // AI : backend-only — the real OpenRouter slug this demo id maps to.
  slug: OpenRouterSlug;
}

export { MODEL_CATALOG, catalogEntry, catalogLabel, slugFor, providerFor, providerModelFor, parseRoutedModel, formatRoutedModel, wireModelId, type ModelCatalogEntry } from "./model_catalog";
export { OPENROUTER_PROVIDER_ID } from "./openrouter_slugs";

// AI : token usage captured on every real LLM call (feeds Logging + Billing).
export interface TokenUsage {
  model: ModelId;
  promptTokens: number;
  completionTokens: number;
}

// AI : live pricing — hydrated via GET /api/state → modelOptions (see openrouter_models.ts).

// AI : default to DeepSeek V3 — cheap Chinese model, maps to deepseek/deepseek-chat, fast + reliable
// AI : for large structured outputs (qwen-2.5-72b on OpenRouter is markedly slower here).
export const DEFAULT_MODEL: ModelId = "openrouter:deepseek-v3";

// AI : default vision model for input OCR — Gemini reads images/PDFs/handwriting well.
export const DEFAULT_VISION_DOC_PARSE_MODEL: ModelId = "gemini-3-flash";

// AI : input-description guard — DeepSeek V3 is reliable on OpenRouter (gemini-2-flash-lite slug 404s).
export const DEFAULT_INPUT_CHECK_MODEL: ModelId = "deepseek-v3";

export const DOC_PARSE_MODES: { value: DocParseMode; label: string; hint: string }[] = [
  { value: DocParseMode.Parser, label: "Built-in parser", hint: "PDF.js text extract at upload — stored in docs.content" },
  { value: DocParseMode.Llm, label: "Vision OCR", hint: "OpenRouter vision — cached separately in doc_vision_cache" },
];

export function docParseModeForModule(m: PipelineModule): DocParseMode {
  if (m.kind === ModuleKind.Input) return m.useOcr ? DocParseMode.Llm : DocParseMode.Parser;
  return DocParseMode.Parser;
}

export function inputUsesVisionOcr(m: PipelineModule): boolean {
  return m.kind === ModuleKind.Input && docParseModeForModule(m) === DocParseMode.Llm;
}

// AI : step-cache model slug — vision OCR steps must not share keys with the global run model.
export function stepModelForCache(m: PipelineModule, globalModel: ModelId): ModelId {
  if (inputUsesVisionOcr(m)) return m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
  if (m.kind === ModuleKind.Llm || m.kind === ModuleKind.LlmBatch) return m.model ?? globalModel;
  return m.model ?? globalModel;
}

export const FIELD_TYPES: FieldType[] = Object.values(FieldType);

export const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: InputType.Pdf, label: "PDF" },
  { value: InputType.Word, label: "Word" },
  { value: InputType.Excel, label: "Excel" },
  { value: InputType.Json, label: "JSON" },
  { value: InputType.Text, label: "Text" },
  { value: InputType.Web, label: "Web" },
  { value: InputType.Image, label: "Image" },
];

export const MODULE_META: Record<ModuleKind, { label: string; description: string }> = {
  [ModuleKind.Input]: {
    label: "Input",
    description: "Ingest a source (pdf, word, web, json…) — built-in parser or optional vision OCR",
  },
  [ModuleKind.Llm]: { label: "LLM Call", description: "Run a model against a prompt + schema" },
  [ModuleKind.LlmBatch]: { label: "Batch LLM", description: "list in → list out (one structured call per item). Wrap with Custom TS before/after when upstream/downstream is a single object." },
  [ModuleKind.Quote]: {
    label: "Link Quotes",
    description: "Match verbatim LLM quote strings against the source document and attach byte offsets (zero LLM cost)",
  },
  [ModuleKind.Transform]: {
    label: "Transform",
    description: "Deterministic reshape — list→object wrap needs a list field on the output structure, or custom TS code",
  },
  [ModuleKind.Combine]: { label: "Combine Inputs", description: "Merge a new input with the pipeline state" },
  [ModuleKind.CustomCode]: {
    label: "Custom Code",
    description: "TypeScript or Python (input) => output with ordered fallbacks on failure",
  },
  [ModuleKind.Assert]: {
    label: "Assert",
    description: "Check pipeline state (step[\"Label\"], len) — runs after referenced steps; passthrough",
  },
  [ModuleKind.HumanReview]: {
    label: "Human Review",
    description: "Pause in Inference for approve or reject — passthrough on approval",
  },
  [ModuleKind.Output]: {
    label: "Output",
    description: "Materialize a named snapshot of a structure — not the pipeline's only output; add one anywhere you want an artifact",
  },
};

export const STRATEGY_META: Record<StrategyKind, { name: string; description: string }> = {
  [StrategyKind.SingleLlm]: { name: "Single LLM Call", description: "One direct call to the model." },
  [StrategyKind.ClaudeCode]: { name: "Agent (Frontier)", description: "A full coding-agent instance on the task." },
  [StrategyKind.CheapAgent]: { name: "Agent (Cheap Model)", description: "Agent loop on a low-cost open model." },
};

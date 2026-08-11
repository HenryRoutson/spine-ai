// AI : canonical contract shared with the V0 frontend (`ai-pipeline-builder/lib/types.ts`).
// AI : the frontend stub is presentation-only; this is the real, combinable definition.
// AI : backend-only additions are marked. Everything else is byte-compatible with the stub.
// AI : TODO bug — known drift vs the v2 frontend stub to reconcile at merge time:
// AI :   - frontend ModuleKind/MODULE_META lack "llm-batch" (any Record<ModuleKind,…> in
// AI :     frontend COMPONENTS will fail to typecheck once these types land),
// AI :   - frontend DEFAULT_MODEL is "qwen-2.5-72b" (backend: "deepseek-v4"),
// AI :   - frontend MODEL_CATALOG may drift from backend until merge.

import type { TypeExpr } from "./type_expr";
import type { ExampleSelectVerdict } from "@/lib/example-select-verdicts";

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
  minItems?: number; // AI : min length for list[…] / set[…]; min entry count for map[…, …]
  maxItems?: number; // AI : max length for list[…] / set[…]; max entry count for map[…, …]
  minLength?: number; // AI : minimum string length when type is text (or text-like)
  maxLength?: number; // AI : maximum string length when type is text (or text-like)
  typeExpr?: TypeExpr; // AI : when set, overrides type/ref — full Python-style type expression
  // AI : field-level flag (spec § Testing) — false = probabilistic, the value varies across runs
  // AI : (LLM prose like a summary or feedback) so tests ignore it. Missing/true = deterministic
  // AI : (a maths answer, an enum like answer_ABCD) → exact-compared.
  deterministic?: boolean;
  // AI : ± allowed on int/float test compare — field-level (spec § Testing), not per test file.
  testTolerance?: number;
}

// AI : ModelField keys that resolve a field's TypeExpr — typeExpr overrides legacy type/ref.
export enum ModelFieldTypeSource {
  Type = "type",
  Ref = "ref",
  TypeExpr = "typeExpr",
}

export type ModelFieldTypeSourcePick = Pick<
  ModelField,
  ModelFieldTypeSource.Type | ModelFieldTypeSource.Ref | ModelFieldTypeSource.TypeExpr
>;

export type ModelFieldLegacyTypePick = Pick<ModelField, ModelFieldTypeSource.Type | ModelFieldTypeSource.Ref>;

// AI : meta-type — one field row inside a StructureDef (structure-of-structures)
export type StructureFieldDef = Pick<
  ModelField,
  "id" | "name" | "type" | "optional" | "description" | "examples" | "negativeExamples" | "ref" | "minItems" | "maxItems" | "minLength" | "maxLength" | "typeExpr" | "deterministic" | "testTolerance"
>;

export interface TolerantFieldPath {
  path: string;
  tolerance: number;
}

// AI : meta-type — JSON-serializable shape used to define StructureModel entries in seeds / assistants
export interface StructureDef {
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
  // AI : type params — Ref { modelId, args } / Generic Name[T] instantiate field typeExprs.
  params?: string[];
}

// AI : standalone reusable type — not a struct with fields; referenced by name in type expressions.
export interface TypeAlias {
  id: TypeAliasId;
  name: string;
  description: string;
  expr: TypeExpr;
  shared?: boolean; // AI : injected into every project — not persisted per project
  locked?: boolean; // AI : read-only in Structure UI
  // AI : parametric alias — Pair[A,B] via Generic name+args → substitute into expr.
  params?: string[];
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
  ExampleSelect = "example-select", // AI : LLM relevance filter per list item — chain_of_thought + is_relevant, not embedding RAG
  Quote = "quote", // AI : deterministic — resolve LLM quote strings → source-linked spans
  Transform = "transform",
  // AI : zip spine + state["Label"] → flat product (not Combine — that is upload ⊕ one state struct).
  Assemble = "assemble",
  // AI : fixed author-time LLM branches on same spine input → Promise.all → flat product join.
  Parallel = "parallel",
  Combine = "combine",
  Chunk = "chunk", // AI : split text / document into list chunks (generated TS)
  Merge = "merge", // AI : recursive structural merge — dict deep, list concat/union/dedupe, per-path rules
  CustomCode = "custom-code",
  Assert = "assert", // AI : validate pipeline state — passthrough spine; code reads step["Label"] keys
  HumanReview = "human-review", // AI : pause in Inference — operator approves or rejects before continuing
  Webhook = "webhook", // AI : server-side HTTP call — search APIs, Zapier, internal services (generic URL)
  // AI : TODO (n8n-stage-A) — add N8n = "n8n" — 1:1 wrap of one n8n node type (see lib/server/n8n-roadmap.ts).
  Output = "output",
}

// AI : webhook step HTTP verbs — GET omitted (no JSON body contract).
export enum WebhookMethod {
  Post = "POST",
  Put = "PUT",
  Patch = "PATCH",
}

export enum CustomCodeLanguage {
  TypeScript = "typescript",
  Python = "python",
}

// AI : structural merge strategies — mirror atomic_code/merger/merger.py wire values.
export enum MergeListStrategy {
  Concat = "concat",
  ConcatDedupe = "concat_dedupe",
  ConcatAssertNoDuplicates = "concat_assert_no_duplicates",
  Union = "union",
  UnionAssert = "union_assert",
  Intersect = "intersect",
  IntersectAssert = "intersect_assert",
  Replace = "replace",
  ReplaceAssert = "replace_assert",
  Prepend = "prepend",
  PrependAssert = "prepend_assert",
  // AI : pairwise deep-merge by index; leftover items from the longer list are kept
  Zip = "zip",
}

export enum MergeDictStrategy {
  Deep = "deep",
  Shallow = "shallow",
  Replace = "replace",
}

export enum MergeScalarStrategy {
  Last = "last",
  First = "first",
  Error = "error",
}

export interface MergeLayerPolicy {
  list?: MergeListStrategy;
  dict?: MergeDictStrategy;
  scalar?: MergeScalarStrategy;
  // AI : property path on list items for union/intersect/dedupe — e.g. "id" or "meta.id".
  itemKey?: string;
}

export interface MergePolicyRule {
  path: string;
  policy: MergeLayerPolicy;
};

export interface MergePolicy {
  default?: MergeLayerPolicy;
  rules?: MergePolicyRule[];
};

// AI : assemble field source — spine / state label / dotted path into either.
export type AssembleSource =
  | { kind: "spine" }
  | { kind: "state"; label: string }
  | { kind: "path"; from: "spine" | { label: string }; path: string };

// AI : parallel branch — one structured LLM call; field becomes a key on the joined product.
export type ParallelBranch = {
  id: string;
  field: string;
  prompt: string;
  outStructureId: StructureModelId;
  model?: ModelId;
  note?: string;
};

// AI : one language key per entry — e.g. { "typescript": "(input) => input" } or { "python": "..." }.
export interface CustomCodeEntry { typescript?: string; python?: string };

// AI : input — built-in PDF/text parser at upload vs OpenRouter vision OCR (handwriting, scans).
export enum DocParseMode {
  Parser = "parser",
  Llm = "llm",
}

// AI : legacy run logs may still reference folded doc-to-text steps.
export enum LegacyModuleKind {
  DocToText = "doc-to-text",
  ListMerge = "list-merge", // AI : migrated to ModuleKind.Merge on project sync
}
export type RunStepKind = ModuleKind | LegacyModuleKind;

export interface PipelineModule { // TODO this is bad, it contains multiple possible kinds of modules!!! TODO refactor.
  id: ModuleId;
  kind: ModuleKind;
  label: string;
  note: string; // annotation / purpose — required on input, combine, and llm steps
  // io contract — every step declares the structure it consumes and emits
  inStructureId?: StructureModelId;
  outStructureId?: StructureModelId;
  // AI : explicit spine types — canonical; list[T] vs T lives here, not a separate boolean flag.
  inType?: TypeExpr;
  outType?: TypeExpr;
  // config
  inputType?: InputTypeSpec;
  inputNameContains?: string; // AI : optional filename substring — only matching docs can fill this input slot
  inputDescription?: string; // AI : optional expected input — LLM guard rejects mismatches before the step runs
  checkInputDescription?: boolean; // AI : when false, skip the LLM guard even if inputDescription is set
  // AI : TODO (spec) — outputDescription?: string + checkOutputDescription?: boolean (post-step LLM output guard).
  // AI : TODO (spec) — dynamicOutputSchema?: boolean on llm steps for variable homework-style marking schemas.
  inputMinCount?: number; // AI : minimum documents for this input slot (default 1); pair with list outType for N submissions
  // AI : after both slots have docs, compare extracted keys against an upstream input — distinct from assert / per-doc validity.
  inputCompatWith?: InputCompatWith;
  prompt?: string;
  code?: string; // AI : transform steps with custom code only
  fallbackList?: CustomCodeEntry[]; // AI : custom-code — ordered attempts, first is primary
  maxRunMs?: number; // AI : custom-code / assert / transform-code — wall clock; default 60s, profile on overrun
  model?: ModelId; // per-step model override
  costLimitCents?: number; // AI : per-llm-step spend cap — defaults to $1 when unset
  chunkSize?: number; // chunk step — max characters per chunk
  chunkOverlap?: number; // chunk step — overlap between consecutive chunks
  chunkTextField?: string; // chunk step — field on input object to split (default content)
  mergePolicy?: MergePolicy; // merge step — recursive structural policy
  mergeCustom?: string; // merge step — optional custom TS (input) => … overrides policy
  mergeStateLabel?: string; // merge step — prior step label whose output is merged with spine input
  mergeWrapListField?: string; // merge step — when spine is list[T], wrap as { field: T[] } before merge
  // AI : assemble — field name → spine | state["Label"] | path; auto out model id sm_assemble_<moduleId>
  assembleBindings?: Record<string, AssembleSource>;
  // AI : parallel — fixed LLM branches sharing spine input; joined into auto product
  parallelBranches?: ParallelBranch[];
  // AI : example-select — cached-prefix relevance filter (see lib/example-select.ts defaults)
  exampleContextLabel?: string; // prior step label supplying {description} text
  exampleContextField?: string; // optional dot path within that step output
  exampleReasonField?: string; // field on each output item for chain_of_thought (default selection_reason)
  examplePreFilterMax?: number; // optional cap on candidates before per-item LLM calls
  useOcr?: boolean; // input only — vision OCR when PDF/image is accepted (built-in parser when off)
  cached: boolean;
  // AI : webhook — server-side HTTP integration (URL may be literal or env:VAR / ${VAR})
  webhookUrl?: string;
  webhookMethod?: WebhookMethod;
  webhookAuthEnv?: string; // env var name — value sent as Authorization (Bearer added when missing)
  webhookTimeoutMs?: number;
  webhookIncludeState?: boolean; // default true — POST { input, state }
  webhookResponsePath?: string; // dot path into JSON response body
  // AI : TODO (n8n-stage-A) — n8nNodeType / n8nNodeVersion / n8nParameters / n8nCredentialEnv /
  // AI :   n8nBaseUrlEnv / n8nApiKeyEnv / n8nTimeoutMs / n8nResponseMode / n8nResponsePath
  // AI :   (1:1 n8n node; catalog from OSS nodes-base — see lib/server/n8n-roadmap.ts).
  // AI : pipeline-managed step — auto-inserted Link Quotes; locked in the builder UI.
  auto?: boolean;
  // metrics (real ones are recomputed from run history, see billing.ts)
  avgMs: number;
  avgCostCents: number;
}

type step_label_string = string;
type doc_name_string = string;

export enum InputCompatNormalize {
  LowerTrim = "lower-trim",
  QuestionId = "question-id",
  QuestionIdSet = "question-id-set",
}

export enum InputCompatExtractorKind {
  JsonPath = "json-path",
  TextRegex = "text-regex",
  QuestionIdsText = "question-ids-text",
}

export interface JsonPathExtractor {
  kind: InputCompatExtractorKind.JsonPath;
  path: string;
  normalize?: InputCompatNormalize;
}

export interface TextRegexExtractor {
  kind: InputCompatExtractorKind.TextRegex;
  pattern: string;
  group?: number;
  flags?: string;
  normalize?: InputCompatNormalize;
}

export interface QuestionIdsTextExtractor {
  kind: InputCompatExtractorKind.QuestionIdsText;
}

export type InputCompatExtractor = JsonPathExtractor | TextRegexExtractor | QuestionIdsTextExtractor;

export enum InputCompatCompare {
  Equal = "equal",
  SetEqual = "set-equal",
}

export interface InputCompatKey {
  label: string;
  upstream: InputCompatExtractor;
  local: InputCompatExtractor;
  compare?: InputCompatCompare;
}

export interface InputCompatWith {
  moduleId: ModuleId;
  keys: InputCompatKey[];
}

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
  llmProviders?: import("@/lib/custom-llm-providers").CustomLlmProviderDef[]; // AI : user-authored browser LLM providers
  createdAt?: number; // AI : ms since epoch — set when blank/cloned; templates from seeds/*.json omit this
  lastOpenedAt?: number; // AI : ms since epoch — updated when user opens/switches to this project
  documentation?: string; // AI : freeform markdown — prepended to every agent/assistant prompt call to prevent regressions
  langfuseExport?: boolean; // AI : when true + LANGFUSE_* env set, pipeline runs mirror to Langfuse as secondary telemetry
  teamId?: import("@/lib/team-types").team_id_string; // AI : shared pointer — team members view/run this owner row; bills team owner
  teamReadOnly?: boolean; // AI : runtime — true when loaded via another member's ownership (pointer)
  teamProjectOwnerId?: import("./require_auth").user_id_string; // AI : runtime — owner's user_id for shared-pointer projects
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
  exampleSelectVerdicts?: ExampleSelectVerdict[];
  failures?: RunFailureRecord[];
  serverLogs?: import("@/lib/run-types").JobLogEntry[]; // AI : mirrored ServerLogger lines for this step
  codeProfile?: import("@/lib/code-exec-ui").StepCodeProfile; // AI : browser custom-code line timings + source snapshot
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
  // AI : negative test — verdict uses testOutcomePassed instead of raw step pass/fail.
  expectFailure?: import("@/lib/test-expect-failure").TestExpectFailure;
  inputCompatBlocked?: boolean;
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
  langfuseTraceId?: string; // AI : Langfuse trace id when langfuseExport was enabled for this run
  langfuseTraceUrl?: string; // AI : deep link into Langfuse UI (server-built from LANGFUSE_BASE_URL)

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

// AI : default to DeepSeek V4 — cheap Chinese model, maps to deepseek/deepseek-chat, fast + reliable
// AI : for large structured outputs (qwen-2.5-72b on OpenRouter is markedly slower here).
export const DEFAULT_MODEL: ModelId = "openrouter:deepseek-v4";

// AI : default vision model for input OCR — Gemini reads images/PDFs/handwriting well.
export const DEFAULT_VISION_DOC_PARSE_MODEL: ModelId = "gemini-3-flash";

// AI : input-description guard — DeepSeek V4 is reliable on OpenRouter (gemini-2-flash-lite slug 404s).
export const DEFAULT_INPUT_CHECK_MODEL: ModelId = "deepseek-v4";

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
  if (
    m.kind === ModuleKind.Llm ||
    m.kind === ModuleKind.LlmBatch ||
    m.kind === ModuleKind.ExampleSelect
  ) {
    return m.model ?? globalModel;
  }
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
  [ModuleKind.ExampleSelect]: {
    label: "Example Select",
    description:
      "Filter a list of examples with a cheap LLM per item — {description} from a prior step, structured is_relevant + chain_of_thought (not embedding RAG)",
  },
  [ModuleKind.Quote]: {
    label: "Link Quotes",
    description: "Match verbatim LLM quote strings against the source document and attach byte offsets (zero LLM cost)",
  },
  [ModuleKind.Transform]: {
    label: "Transform",
    description: "Deterministic reshape — list→object wrap needs a list field on the output structure, or custom TS code",
  },
  [ModuleKind.Assemble]: {
    label: "Assemble",
    description: "Zip spine + prior step labels into one flat structure (no LLM; not Combine Inputs)",
  },
  [ModuleKind.Parallel]: {
    label: "Parallel LLM",
    description: "Run fixed LLM branches on the same spine input concurrently, then join into one structure",
  },
  [ModuleKind.Combine]: { label: "Combine Inputs", description: "Merge a new input with the pipeline state" },
  [ModuleKind.Chunk]: {
    label: "Chunk",
    description: "Split document text into a list of chunks — size, overlap, and source field are configurable",
  },
  [ModuleKind.Merge]: {
    label: "Merge",
    description: "Fold values with recursive structural merge — deep dicts, list concat/union/dedupe, per-path rules",
  },
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
  [ModuleKind.Webhook]: {
    label: "Webhook",
    description: "POST spine input to an external URL (search APIs, Zapier, custom HTTP) — server-side, secrets via env vars",
  },
  // AI : TODO (n8n-stage-A) — MODULE_META[ModuleKind.N8n] = { label: "n8n", description: "Run one n8n node (Slack, Gmail, …) via self-hosted n8n" }
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

// Generated pipeline export — equivalent TypeScript representation
// Project: Example Select Demo 2 1
// 14 steps · 18 structures · 553 lines
// Setup: export also includes .env.example and README.md — copy .env.example → .env

// === structures ===
export type QuoteSpan = { doc_id: string; start: number; end: number };
export type Quote = QuoteSpan;
export type TextQuote = { text: string; quote: QuoteSpan };
export type Document = { content: string; filename: string };
export type FileInput = Document;
export type quote_string_t = string;
export type quote_span_t = QuoteSpan;
export type text_quote_t = { text: string; quote: string };
export type WorkDescription = {
  description: string;
};

export type BilledLineRef = {
  work_item_id: string;
  quantity: number;
  unit_note: string | undefined;
};

export type JobExample = {
  id: string;
  title: string;
  work_description: string;
  billed_items: BilledLineRef[];
};

export type SelectedJobExample = {
  id: string;
  title: string;
  work_description: string;
  billed_items: BilledLineRef[];
  selection_reason: string;
};

export type JobExampleLibraryFile = {
  examples: JobExample[];
};

export type JobSelectBundle = {
  case: WorkDescription;
  library: JobExampleLibraryFile;
};

export type ItemFilterContext = {
  description: string;
  selected_examples: SelectedJobExample[];
};

export type WorkItem = {
  id: string;
  code: string;
  trade: string;
  unit: string;
  description: string;
};

export type WorkItemCatalogFile = {
  items: WorkItem[];
};

export type CatalogSelectBundle = {
  draft_context: ItemFilterContext;
  catalog: WorkItemCatalogFile;
};

export type SelectedWorkItem = {
  id: string;
  code: string;
  trade: string;
  unit: string;
  description: string;
  selection_reason: string;
};

export type BilledWorkDraftRequest = {
  description: string;
  selected_examples: SelectedJobExample[];
  selected_work_items: SelectedWorkItem[];
};

export type DraftLineItem = {
  work_item_id: string;
  quantity: number;
  rationale: string;
};

export type BilledWorkDraft = {
  title: string;
  line_items: DraftLineItem[];
};

export type Wrap_selected_examples = {
  selected_examples: SelectedJobExample[];
};

export type Wrap_selected_work_items = {
  selected_work_items: SelectedWorkItem[];
};


// === pipeline state ===
export type PipelineState = {
  "Work Description": Document;
  "Normalize Case": WorkDescription;
  "Job Example Library": JobExampleLibraryFile;
  "Combine Job Inputs": JobSelectBundle;
  "Parse Job Examples": JobExample[];
  "Select Relevant Jobs": SelectedJobExample[];
  "Merge for Item Filter": ItemFilterContext;
  "Work Item Catalog": WorkItemCatalogFile;
  "Combine Catalog": CatalogSelectBundle;
  "Parse Work Items": WorkItem[];
  "Select Relevant Work Items": SelectedWorkItem[];
  "Merge for Draft": BilledWorkDraftRequest;
  "Draft Billed Work": BilledWorkDraft;
  "Billed Work Output": BilledWorkDraft;
};

// === runtime config (load .env in your runner — pass values here, not in this file) ===
export type PipelineRuntime = {
  /** Infrastructure — e.g. openrouter or your enterprise provider id */
  llmProviderId?: string;
  /** Provider-specific model id (OpenRouter slug when using openrouter) */
  llmProviderModel?: string;
  /** OpenRouter (default provider) — kept for backward compatibility */
  openRouterApiKey?: string;
  openRouterModel?: string;
  openRouterSiteUrl?: string;
  openRouterAppTitle?: string;
  /** Vision OCR model slug (OpenRouter) — default Gemini Flash; override for DeepSeek-OCR hosts */
  visionOcrModel?: string;
  // AI : TODO export — Supabase persistence (supabaseUrl, supabaseServiceKey).
  // AI : TODO export — step cache (enableCache, cacheUrl / PIPELINE_CACHE_URL).
};

let runtime: PipelineRuntime = {};

export function configurePipelineRuntime(config: PipelineRuntime): void {
  runtime = { ...runtime, ...config };
}

// --- runtime stubs (replace bodies or inject via configurePipelineRuntime) ---

// === LLM providers — OpenRouter is default; registerCustomLlmProvider for enterprise APIs ===

export type LlmProviderId = string;
export type ProviderModelId = string;

export type LlmProviderCapabilities = { batch: boolean; streaming: boolean; vision: boolean };

export type LlmProvider = {
  readonly id: LlmProviderId;
  readonly capabilities: LlmProviderCapabilities;
  chat(prompt: string, providerModel: ProviderModelId, jsonMode: boolean): Promise<string>;
  chatBatch?(prompts: string[], providerModel: ProviderModelId, jsonMode: boolean): Promise<string[]>;
};

export type ModelCatalogRow = {
  id: string;
  label: string;
  providerId: LlmProviderId;
  providerModel: ProviderModelId;
};

export const MODEL_CATALOG: ModelCatalogRow[] = [
  { id: "qwen-2.5-72b", label: "Qwen 2.5 72B", providerId: "openrouter", providerModel: "qwen/qwen-2.5-72b-instruct" },
  { id: "deepseek-v4", label: "DeepSeek V4", providerId: "openrouter", providerModel: "deepseek/deepseek-chat" },
  { id: "glm-5.2", label: "GLM 5.2", providerId: "openrouter", providerModel: "z-ai/glm-5.2" },
  { id: "gpt-5-mini", label: "GPT-5 mini", providerId: "openrouter", providerModel: "openai/gpt-4o-mini" },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6", providerId: "openrouter", providerModel: "anthropic/claude-opus-4.1" },
  { id: "sonnet-4.7", label: "Claude Sonnet 4.7", providerId: "openrouter", providerModel: "anthropic/claude-sonnet-4.5" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", providerId: "openrouter", providerModel: "google/gemini-3-flash-preview" },
];

export const DEFAULT_LLM_PROVIDER_ID: LlmProviderId = "openrouter";
export const DEFAULT_PROVIDER_MODEL: ProviderModelId = "deepseek/deepseek-chat";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

function extractJsonReply(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

function resolveActiveProviderId(): LlmProviderId {
  return runtime.llmProviderId ?? DEFAULT_LLM_PROVIDER_ID;
}

function resolveProviderModel(): ProviderModelId {
  if (runtime.llmProviderModel) return runtime.llmProviderModel;
  if (runtime.openRouterModel) return runtime.openRouterModel;
  return DEFAULT_PROVIDER_MODEL;
}

async function openRouterChat(prompt: string, providerModel: ProviderModelId, jsonMode: boolean): Promise<string> {
  if (!runtime.openRouterApiKey) throw new Error("configurePipelineRuntime({ openRouterApiKey }) or set llmProviderId to a registered custom provider");
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": runtime.openRouterSiteUrl ?? "http://localhost:3000",
      "X-Title": runtime.openRouterAppTitle ?? "forge-pipeline-export",
    },
    body: JSON.stringify({
      model: providerModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 8192,
      provider: { allow_fallbacks: false },
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no message content");
  return content;
}

const openRouterProvider: LlmProvider = {
  id: "openrouter",
  capabilities: { batch: true, streaming: true, vision: true },
  chat: openRouterChat,
  async chatBatch(prompts, providerModel, jsonMode) {
    return Promise.all(prompts.map((p) => openRouterChat(p, providerModel, jsonMode)));
  },
};

const customProviders = new Map<LlmProviderId, LlmProvider>();

/** Register an enterprise / internal LLM provider (persisted for the process lifetime). */
export function registerCustomLlmProvider(provider: LlmProvider): void {
  customProviders.set(provider.id, provider);
}

export function getLlmProvider(id?: LlmProviderId): LlmProvider {
  const resolved = id ?? resolveActiveProviderId();
  if (resolved === "openrouter") return openRouterProvider;
  const custom = customProviders.get(resolved);
  if (custom) return custom;
  throw new Error(`Unknown LLM provider: ${resolved} — call registerCustomLlmProvider() or set llmProviderId to openrouter`);
}

async function llmChat(prompt: string, jsonMode: boolean): Promise<string> {
  const provider = getLlmProvider();
  return provider.chat(prompt, resolveProviderModel(), jsonMode);
}

async function llmStructured<T>(prompt: string, schema: unknown): Promise<T> {
  const schemaJson = JSON.stringify(schema ?? {}, null, 2);
  const base = `${prompt}\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n${schemaJson}`;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const ask =
      attempt === 0
        ? base
        : `${base}\n\nYour previous reply failed validation:\n${lastError}\nReturn corrected JSON only.`;
    const raw = await llmChat(ask, true);
    const json = extractJsonReply(raw);
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      lastError = (e as Error).message;
      if (attempt === 1) throw new Error(`structured response parse failed after retry: ${lastError}`);
    }
  }
  throw new Error("structured response failed");
}

async function llmBatchStructured<T>(
  items: unknown[],
  promptFor: (item: unknown) => string,
  schema: unknown,
): Promise<T[]> {
  const provider = getLlmProvider();
  const providerModel = resolveProviderModel();
  const schemaJson = JSON.stringify(schema ?? {}, null, 2);
  const suffix = `\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n${schemaJson}`;
  const prompts = items.map((item) => `${promptFor(item)}${suffix}`);
  const raws = provider.capabilities.batch && provider.chatBatch
    ? await provider.chatBatch(prompts, providerModel, true)
    : await Promise.all(prompts.map((p) => provider.chat(p, providerModel, true)));
  return raws.map((raw) => JSON.parse(extractJsonReply(raw)) as T);
}

// === steps ===
/**
 * Work Description
 * @kind Input
 * New claim narrative — feeds {description} via Normalize Case
 * @cached true
 */
async function step_Work_Description(input: Document, _state: PipelineState): Promise<Document> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "Plain-text description of the new repair claim"
  // Filename must contain: "work_description"
  const doc = input as Document & { base64?: string; mime?: string };
  const content = doc.content;
  return { content, filename: doc.filename };
}

/**
 * Normalize Case
 * @kind Custom Code
 * Document → WorkDescription — deterministic wrapper for example-select context.
 * @cached true
 */
async function step_Normalize_Case(input: Document, state: PipelineState): Promise<WorkDescription> {
  const __compiled = new Function("return " + "((doc) => ({ description: String(doc?.content ?? \"\").trim() }))")() as (input: Document, state?: PipelineState) => WorkDescription;
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as WorkDescription;
}

/**
 * Job Example Library
 * @kind Input
 * Past jobs with billed_items references — side input before combine
 * @cached true
 */
async function step_Job_Example_Library(input: Document, _state: PipelineState): Promise<JobExampleLibraryFile> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "JSON file with examples array of structured past jobs"
  // Filename must contain: "job_example_library"
  const doc = input as Document & { base64?: string; mime?: string };
  const content = doc.content;
  return JSON.parse(content) as JobExampleLibraryFile;
}

/**
 * Combine Job Inputs
 * @kind Combine Inputs
 * Merges WorkDescription with Job Example Library side input.
 * @cached true
 */
async function step_Combine_Job_Inputs(input: JobExampleLibraryFile, state: PipelineState): Promise<JobSelectBundle> {
  // Merge uploaded document with upstream WorkDescription from pipeline state
  const newDoc = Array.isArray(input) ? input[0] : input;
  const merged = { case: state["Normalize Case"], library: newDoc as JobExampleLibraryFile };
  return merged as JobSelectBundle;
}

/**
 * Parse Job Examples
 * @kind Custom Code
 * JobSelectBundle → list[JobExample].
 * @cached true
 */
async function step_Parse_Job_Examples(input: JobSelectBundle, state: PipelineState): Promise<JobExample[]> {
  const __compiled = new Function("return " + "((bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error(\"expected examples array\"); return rows; })")() as (input: JobSelectBundle, state?: PipelineState) => JobExample[];
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as JobExample[];
}

/**
 * Select Relevant Jobs
 * @kind Example Select
 * Pass 1 — filter past jobs by similarity to the claim description.
 * @model openrouter:deepseek-v4
 * @cached true
 */
async function step_Select_Relevant_Jobs(input: JobExample[], state: PipelineState): Promise<SelectedJobExample[]> {
  // Per-item relevance filter — SelectedJobExample with selection_reason
  const description = JSON.stringify(state["Normalize Case"], null, 2);
  const items = Array.isArray(input) ? input : [input];
  const template = "Find past repair jobs that are useful references for scoping this new insurance claim.\n\nWORK DESCRIPTION:\n\n{description}\n\nCANDIDATE PAST JOB:\n\n{example}";
  const relevanceSchema = { chain_of_thought: "string", is_relevant: "boolean" };
  type RelevanceVerdict = { chain_of_thought?: string; is_relevant?: boolean };
  const verdicts = await llmBatchStructured<RelevanceVerdict>(items, (item: unknown) => template.replace("{description}", description).replace("{example}", JSON.stringify(item)), relevanceSchema);
  return items.filter((_, i) => verdicts[i]?.is_relevant).map((item, i) => ({ ...item, selection_reason: verdicts[i]?.chain_of_thought ?? "" })) as SelectedJobExample[];
}

/**
 * Merge for Item Filter
 * @kind Merge
 * Deep-merge Normalize Case with selected_examples → ItemFilterContext (cached prefix for pass 2).
 * @cached true
 */
async function step_Merge_for_Item_Filter(input: SelectedJobExample[], state: PipelineState): Promise<ItemFilterContext> {
  const __compiled = new Function("return " + "(input, state) => { function __itemKeyFn(keyPath) {\n  const parts = String(keyPath).split(\".\").filter(Boolean);\n  return (item) => {\n    let cur = item;\n    for (const part of parts) {\n      if (!cur || typeof cur !== \"object\" || !(part in cur)) throw new TypeError(\"itemKey \\\"\" + keyPath + \"\\\" missing\");\n      cur = cur[part];\n    }\n    if (cur == null) throw new TypeError(\"itemKey \\\"\" + keyPath + \"\\\" missing\");\n    return cur;\n  };\n}\nfunction __cmpKey(item, keyFn) {\n  if (keyFn) return keyFn(item);\n  if (item == null || typeof item === \"string\" || typeof item === \"number\" || typeof item === \"boolean\") return item;\n  return JSON.stringify(item);\n}\nfunction __pathForItem(path, ck, index) {\n  if (typeof ck === \"string\" || typeof ck === \"number\") return [...path, ck];\n  return [...path, index];\n}\nfunction __zipMerge(left, right, resolver, path) {\n  const n = Math.max(left.length, right.length), out = [];\n  for (let i = 0; i < n; i++) {\n    const child = [...path, i];\n    if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));\n    else out.push(i < left.length ? left[i] : right[i]);\n  }\n  return out;\n}\nfunction __dedupeMerge(items, keyFn, resolver, path) {\n  const seen = new Map(), out = [];\n  for (const item of items) {\n    const k = __cmpKey(item, keyFn);\n    if (seen.has(k)) {\n      const idx = seen.get(k);\n      out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));\n      continue;\n    }\n    seen.set(k, out.length);\n    out.push(item);\n  }\n  return out;\n}\nfunction __assertNoDupes(items, keyFn, path) {\n  const seen = new Set(), out = [];\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  for (const item of items) {\n    const k = __cmpKey(item, keyFn);\n    if (seen.has(k)) throw new TypeError(\"duplicate list item at path \" + label + \" (key=\" + String(k) + \")\");\n    seen.add(k);\n    out.push(item);\n  }\n  return out;\n}\nfunction __setOp(left, right, keyFn, resolver, path, op) {\n  const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));\n  const ls = new Set(lk), rs = new Set(rk);\n  const wanted = op === \"union\" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));\n  const order = [];\n  const seen = new Set();\n  for (const k of [...lk, ...rk]) {\n    if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }\n  }\n  const map = new Map(), idx = new Map();\n  left.forEach((item, i) => {\n    const k = lk[i];\n    if (!map.has(k)) { map.set(k, item); idx.set(k, i); }\n    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));\n  });\n  right.forEach((item, i) => {\n    const k = rk[i];\n    if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }\n    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));\n  });\n  return order.map((k) => map.get(k));\n}\nfunction __assertUnionNoOverlap(left, right, keyFn, path) {\n  const lk = left.map((i) => __cmpKey(i, keyFn));\n  const ls = new Set(lk);\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  for (const item of right) {\n    const k = __cmpKey(item, keyFn);\n    if (ls.has(k)) throw new TypeError(\"union key overlap at path \" + label + \" (key=\" + String(k) + \")\");\n  }\n  return [...left, ...right];\n}\nfunction __assertIntersectSubset(left, right, keyFn, path) {\n  const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  for (const item of left) {\n    const k = __cmpKey(item, keyFn);\n    if (!rs.has(k)) throw new TypeError(\"intersect: left item not in right at path \" + label + \" (key=\" + String(k) + \")\");\n  }\n  return left;\n}\nfunction __assertReplaceEmptyLeft(left, right, path) {\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  if (left.length) throw new TypeError(\"replace assert: left list must be empty at path \" + label + \" (got \" + left.length + \" items)\");\n  return [...right];\n}\nfunction __assertPrependEmptyRight(left, right, path) {\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  if (right.length) throw new TypeError(\"prepend assert: right list must be empty at path \" + label + \" (got \" + right.length + \" items)\");\n  return [...left];\n}\nfunction __suffixMatch(pattern, path) {\n  if (pattern.length !== path.length) return false;\n  for (let i = 0; i < pattern.length; i++) {\n    if (pattern[i] !== \"*\" && String(pattern[i]) !== String(path[i])) return false;\n  }\n  return true;\n}\nfunction __globstarFrom(pattern, path, pi, si) {\n  if (pi === pattern.length) return si === path.length ? path.length : null;\n  if (pattern[pi] === \"**\") {\n    let best = null;\n    for (let span = si; span <= path.length; span++) {\n      const d = __globstarFrom(pattern, path, pi + 1, span);\n      if (d != null && (best == null || d > best)) best = d;\n    }\n    return best;\n  }\n  if (si >= path.length) return null;\n  if (pattern[pi] !== \"*\" && String(pattern[pi]) !== String(path[si])) return null;\n  return __globstarFrom(pattern, path, pi + 1, si + 1);\n}\nfunction __patternDepth(pattern, path) {\n  const parts = pattern.split(\".\").filter(Boolean);\n  if (!parts.length) return path.length ? null : 0;\n  if (parts.includes(\"**\")) return __globstarFrom(parts, path, 0, 0);\n  if (parts.length > path.length) return null;\n  const offset = path.length - parts.length;\n  return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;\n}\nconst __mergePair = function(left, right, resolver, path) {\n  if (left == null) return right;\n  if (right == null) return left;\n  const layer = resolver.resolve(path);\n  const isObj = (v) => v && typeof v === \"object\" && !Array.isArray(v);\n  const isScalar = (v) => v == null || typeof v === \"string\" || typeof v === \"number\" || typeof v === \"boolean\";\n  if (isObj(left) && isObj(right)) {\n    if (layer.dict === \"replace\") return { ...right };\n    if (layer.dict === \"shallow\") return { ...left, ...right };\n    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);\n    const out = {};\n    for (const key of keys) {\n      const child = [...path, key];\n      if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);\n      else out[key] = key in left ? left[key] : right[key];\n    }\n    return out;\n  }\n  if (Array.isArray(left) && Array.isArray(right)) {\n    const s = layer.list;\n    if (s === \"replace\") return [...right];\n    if (s === \"prepend\") return [...right, ...left];\n    if (s === \"concat\") return [...left, ...right];\n    if (s === \"zip\") return __zipMerge(left, right, resolver, path);\n    if (s === \"concat_dedupe\") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);\n    if (s === \"concat_assert_no_duplicates\") return __assertNoDupes([...left, ...right], layer.keyFn, path);\n    if (s === \"union\") return __setOp(left, right, layer.keyFn, resolver, path, \"union\");\n    if (s === \"union_assert\") return __assertUnionNoOverlap(left, right, layer.keyFn, path);\n    if (s === \"intersect\") return __setOp(left, right, layer.keyFn, resolver, path, \"intersect\");\n    if (s === \"intersect_assert\") return __assertIntersectSubset(left, right, layer.keyFn, path);\n    if (s === \"replace_assert\") return __assertReplaceEmptyLeft(left, right, path);\n    if (s === \"prepend_assert\") return __assertPrependEmptyRight(left, right, path);\n    throw new Error(\"unknown list strategy: \" + s);\n  }\n  if (isScalar(left) && isScalar(right)) {\n    if (layer.scalar === \"first\") return left;\n    if (layer.scalar === \"last\") return right;\n    throw new TypeError(\"scalar conflict\");\n  }\n  if (typeof left === typeof right) return layer.scalar === \"first\" ? left : right;\n  throw new TypeError(\"cannot merge \" + typeof left + \" with \" + typeof right);\n};\nconst __resolve = class {\n  constructor(policy) {\n    const def = policy?.default ?? {};\n    this.default = {\n      list: def.list ?? \"concat\",\n      dict: def.dict ?? \"deep\",\n      scalar: def.scalar ?? \"last\",\n      keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,\n    };\n    this.rules = (policy?.rules ?? []).map((r) => ({\n      pattern: r.path,\n      policy: {\n        list: r.policy?.list ?? this.default.list,\n        dict: r.policy?.dict ?? this.default.dict,\n        scalar: r.policy?.scalar ?? this.default.scalar,\n        keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,\n      },\n    }));\n  }\n  resolve(path) {\n    let matched, depth = -1;\n    for (const { pattern, policy } of this.rules) {\n      const d = __patternDepth(pattern, path);\n      if (d != null && d > depth) { matched = policy; depth = d; }\n    }\n    return matched ?? this.default;\n  }\n}; return ((input, state) => {\n  let spine = input;\n  if (\"selected_examples\" && Array.isArray(spine)) spine = { [\"selected_examples\"]: spine };\n  const values = [];\n  if (\"Normalize Case\") {\n    const fromState = (state ?? {})[\"Normalize Case\"];\n    if (fromState != null) values.push(fromState);\n  }\n  if (spine != null) values.push(spine);\n  const resolver = new __resolve({\"default\":{\"list\":\"concat\",\"dict\":\"deep\",\"scalar\":\"last\"}});\n  if (!values.length) return null;\n  if (values.length === 1) return values[0];\n  let result = values[0];\n  for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);\n  return result;\n})(input, state); }")() as (input: SelectedJobExample[], state?: PipelineState) => ItemFilterContext;
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as ItemFilterContext;
}

/**
 * Work Item Catalog
 * @kind Input
 * 100-item catalog for pass 2 — too large for one prompt; filtered per row with cached prefix
 * @cached true
 */
async function step_Work_Item_Catalog(input: Document, _state: PipelineState): Promise<WorkItemCatalogFile> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "JSON file with items array — master catalog of billable work items"
  // Filename must contain: "work_item_catalog"
  const doc = input as Document & { base64?: string; mime?: string };
  const content = doc.content;
  return JSON.parse(content) as WorkItemCatalogFile;
}

/**
 * Combine Catalog
 * @kind Combine Inputs
 * Merges ItemFilterContext with Work Item Catalog side input.
 * @cached true
 */
async function step_Combine_Catalog(input: WorkItemCatalogFile, state: PipelineState): Promise<CatalogSelectBundle> {
  // Merge uploaded document with upstream ItemFilterContext from pipeline state
  const newDoc = Array.isArray(input) ? input[0] : input;
  const merged = { draft_context: state["Merge for Item Filter"], catalog: newDoc as WorkItemCatalogFile };
  return merged as CatalogSelectBundle;
}

/**
 * Parse Work Items
 * @kind Custom Code
 * CatalogSelectBundle → list[WorkItem].
 * @cached true
 */
async function step_Parse_Work_Items(input: CatalogSelectBundle, state: PipelineState): Promise<WorkItem[]> {
  const __compiled = new Function("return " + "((bundle) => { const rows = bundle?.catalog?.items; if (!Array.isArray(rows)) throw new Error(\"expected items array\"); return rows; })")() as (input: CatalogSelectBundle, state?: PipelineState) => WorkItem[];
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as WorkItem[];
}

/**
 * Select Relevant Work Items
 * @kind Example Select
 * Pass 2 — filter catalog rows; context is full ItemFilterContext JSON (description + selected jobs).
 * @model openrouter:deepseek-v4
 * @cached true
 */
async function step_Select_Relevant_Work_Items(input: WorkItem[], state: PipelineState): Promise<SelectedWorkItem[]> {
  // Per-item relevance filter — SelectedWorkItem with selection_reason
  const description = JSON.stringify(state["Merge for Item Filter"], null, 2);
  const items = Array.isArray(input) ? input : [input];
  const template = "You are filtering a master construction work-item catalog for an insurance repair claim.\n\nThe CASE and RELEVANT PAST JOBS (with billed_items) are below. Decide whether the CANDIDATE WORK ITEM could be required for this claim.\n\nCASE AND PAST JOBS:\n\n{description}\n\nCANDIDATE WORK ITEM:\n\n{example}";
  const relevanceSchema = { chain_of_thought: "string", is_relevant: "boolean" };
  type RelevanceVerdict = { chain_of_thought?: string; is_relevant?: boolean };
  const verdicts = await llmBatchStructured<RelevanceVerdict>(items, (item: unknown) => template.replace("{description}", description).replace("{example}", JSON.stringify(item)), relevanceSchema);
  return items.filter((_, i) => verdicts[i]?.is_relevant).map((item, i) => ({ ...item, selection_reason: verdicts[i]?.chain_of_thought ?? "" })) as SelectedWorkItem[];
}

/**
 * Merge for Draft
 * @kind Merge
 * Deep-merge ItemFilterContext with selected_work_items → BilledWorkDraftRequest.
 * @cached true
 */
async function step_Merge_for_Draft(input: SelectedWorkItem[], state: PipelineState): Promise<BilledWorkDraftRequest> {
  const __compiled = new Function("return " + "(input, state) => { function __itemKeyFn(keyPath) {\n  const parts = String(keyPath).split(\".\").filter(Boolean);\n  return (item) => {\n    let cur = item;\n    for (const part of parts) {\n      if (!cur || typeof cur !== \"object\" || !(part in cur)) throw new TypeError(\"itemKey \\\"\" + keyPath + \"\\\" missing\");\n      cur = cur[part];\n    }\n    if (cur == null) throw new TypeError(\"itemKey \\\"\" + keyPath + \"\\\" missing\");\n    return cur;\n  };\n}\nfunction __cmpKey(item, keyFn) {\n  if (keyFn) return keyFn(item);\n  if (item == null || typeof item === \"string\" || typeof item === \"number\" || typeof item === \"boolean\") return item;\n  return JSON.stringify(item);\n}\nfunction __pathForItem(path, ck, index) {\n  if (typeof ck === \"string\" || typeof ck === \"number\") return [...path, ck];\n  return [...path, index];\n}\nfunction __zipMerge(left, right, resolver, path) {\n  const n = Math.max(left.length, right.length), out = [];\n  for (let i = 0; i < n; i++) {\n    const child = [...path, i];\n    if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));\n    else out.push(i < left.length ? left[i] : right[i]);\n  }\n  return out;\n}\nfunction __dedupeMerge(items, keyFn, resolver, path) {\n  const seen = new Map(), out = [];\n  for (const item of items) {\n    const k = __cmpKey(item, keyFn);\n    if (seen.has(k)) {\n      const idx = seen.get(k);\n      out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));\n      continue;\n    }\n    seen.set(k, out.length);\n    out.push(item);\n  }\n  return out;\n}\nfunction __assertNoDupes(items, keyFn, path) {\n  const seen = new Set(), out = [];\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  for (const item of items) {\n    const k = __cmpKey(item, keyFn);\n    if (seen.has(k)) throw new TypeError(\"duplicate list item at path \" + label + \" (key=\" + String(k) + \")\");\n    seen.add(k);\n    out.push(item);\n  }\n  return out;\n}\nfunction __setOp(left, right, keyFn, resolver, path, op) {\n  const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));\n  const ls = new Set(lk), rs = new Set(rk);\n  const wanted = op === \"union\" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));\n  const order = [];\n  const seen = new Set();\n  for (const k of [...lk, ...rk]) {\n    if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }\n  }\n  const map = new Map(), idx = new Map();\n  left.forEach((item, i) => {\n    const k = lk[i];\n    if (!map.has(k)) { map.set(k, item); idx.set(k, i); }\n    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));\n  });\n  right.forEach((item, i) => {\n    const k = rk[i];\n    if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }\n    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));\n  });\n  return order.map((k) => map.get(k));\n}\nfunction __assertUnionNoOverlap(left, right, keyFn, path) {\n  const lk = left.map((i) => __cmpKey(i, keyFn));\n  const ls = new Set(lk);\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  for (const item of right) {\n    const k = __cmpKey(item, keyFn);\n    if (ls.has(k)) throw new TypeError(\"union key overlap at path \" + label + \" (key=\" + String(k) + \")\");\n  }\n  return [...left, ...right];\n}\nfunction __assertIntersectSubset(left, right, keyFn, path) {\n  const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  for (const item of left) {\n    const k = __cmpKey(item, keyFn);\n    if (!rs.has(k)) throw new TypeError(\"intersect: left item not in right at path \" + label + \" (key=\" + String(k) + \")\");\n  }\n  return left;\n}\nfunction __assertReplaceEmptyLeft(left, right, path) {\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  if (left.length) throw new TypeError(\"replace assert: left list must be empty at path \" + label + \" (got \" + left.length + \" items)\");\n  return [...right];\n}\nfunction __assertPrependEmptyRight(left, right, path) {\n  const label = path.length ? path.join(\".\") : \"<root>\";\n  if (right.length) throw new TypeError(\"prepend assert: right list must be empty at path \" + label + \" (got \" + right.length + \" items)\");\n  return [...left];\n}\nfunction __suffixMatch(pattern, path) {\n  if (pattern.length !== path.length) return false;\n  for (let i = 0; i < pattern.length; i++) {\n    if (pattern[i] !== \"*\" && String(pattern[i]) !== String(path[i])) return false;\n  }\n  return true;\n}\nfunction __globstarFrom(pattern, path, pi, si) {\n  if (pi === pattern.length) return si === path.length ? path.length : null;\n  if (pattern[pi] === \"**\") {\n    let best = null;\n    for (let span = si; span <= path.length; span++) {\n      const d = __globstarFrom(pattern, path, pi + 1, span);\n      if (d != null && (best == null || d > best)) best = d;\n    }\n    return best;\n  }\n  if (si >= path.length) return null;\n  if (pattern[pi] !== \"*\" && String(pattern[pi]) !== String(path[si])) return null;\n  return __globstarFrom(pattern, path, pi + 1, si + 1);\n}\nfunction __patternDepth(pattern, path) {\n  const parts = pattern.split(\".\").filter(Boolean);\n  if (!parts.length) return path.length ? null : 0;\n  if (parts.includes(\"**\")) return __globstarFrom(parts, path, 0, 0);\n  if (parts.length > path.length) return null;\n  const offset = path.length - parts.length;\n  return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;\n}\nconst __mergePair = function(left, right, resolver, path) {\n  if (left == null) return right;\n  if (right == null) return left;\n  const layer = resolver.resolve(path);\n  const isObj = (v) => v && typeof v === \"object\" && !Array.isArray(v);\n  const isScalar = (v) => v == null || typeof v === \"string\" || typeof v === \"number\" || typeof v === \"boolean\";\n  if (isObj(left) && isObj(right)) {\n    if (layer.dict === \"replace\") return { ...right };\n    if (layer.dict === \"shallow\") return { ...left, ...right };\n    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);\n    const out = {};\n    for (const key of keys) {\n      const child = [...path, key];\n      if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);\n      else out[key] = key in left ? left[key] : right[key];\n    }\n    return out;\n  }\n  if (Array.isArray(left) && Array.isArray(right)) {\n    const s = layer.list;\n    if (s === \"replace\") return [...right];\n    if (s === \"prepend\") return [...right, ...left];\n    if (s === \"concat\") return [...left, ...right];\n    if (s === \"zip\") return __zipMerge(left, right, resolver, path);\n    if (s === \"concat_dedupe\") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);\n    if (s === \"concat_assert_no_duplicates\") return __assertNoDupes([...left, ...right], layer.keyFn, path);\n    if (s === \"union\") return __setOp(left, right, layer.keyFn, resolver, path, \"union\");\n    if (s === \"union_assert\") return __assertUnionNoOverlap(left, right, layer.keyFn, path);\n    if (s === \"intersect\") return __setOp(left, right, layer.keyFn, resolver, path, \"intersect\");\n    if (s === \"intersect_assert\") return __assertIntersectSubset(left, right, layer.keyFn, path);\n    if (s === \"replace_assert\") return __assertReplaceEmptyLeft(left, right, path);\n    if (s === \"prepend_assert\") return __assertPrependEmptyRight(left, right, path);\n    throw new Error(\"unknown list strategy: \" + s);\n  }\n  if (isScalar(left) && isScalar(right)) {\n    if (layer.scalar === \"first\") return left;\n    if (layer.scalar === \"last\") return right;\n    throw new TypeError(\"scalar conflict\");\n  }\n  if (typeof left === typeof right) return layer.scalar === \"first\" ? left : right;\n  throw new TypeError(\"cannot merge \" + typeof left + \" with \" + typeof right);\n};\nconst __resolve = class {\n  constructor(policy) {\n    const def = policy?.default ?? {};\n    this.default = {\n      list: def.list ?? \"concat\",\n      dict: def.dict ?? \"deep\",\n      scalar: def.scalar ?? \"last\",\n      keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,\n    };\n    this.rules = (policy?.rules ?? []).map((r) => ({\n      pattern: r.path,\n      policy: {\n        list: r.policy?.list ?? this.default.list,\n        dict: r.policy?.dict ?? this.default.dict,\n        scalar: r.policy?.scalar ?? this.default.scalar,\n        keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,\n      },\n    }));\n  }\n  resolve(path) {\n    let matched, depth = -1;\n    for (const { pattern, policy } of this.rules) {\n      const d = __patternDepth(pattern, path);\n      if (d != null && d > depth) { matched = policy; depth = d; }\n    }\n    return matched ?? this.default;\n  }\n}; return ((input, state) => {\n  let spine = input;\n  if (\"selected_work_items\" && Array.isArray(spine)) spine = { [\"selected_work_items\"]: spine };\n  const values = [];\n  if (\"Merge for Item Filter\") {\n    const fromState = (state ?? {})[\"Merge for Item Filter\"];\n    if (fromState != null) values.push(fromState);\n  }\n  if (spine != null) values.push(spine);\n  const resolver = new __resolve({\"default\":{\"list\":\"concat\",\"dict\":\"deep\",\"scalar\":\"last\"}});\n  if (!values.length) return null;\n  if (values.length === 1) return values[0];\n  let result = values[0];\n  for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);\n  return result;\n})(input, state); }")() as (input: SelectedWorkItem[], state?: PipelineState) => BilledWorkDraftRequest;
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as BilledWorkDraftRequest;
}

/**
 * Draft Billed Work
 * @kind LLM Call
 * Final structured scope using selected jobs, catalog items, and selection_reason fields.
 * @model openrouter:deepseek-v4
 * @cached true
 */
async function step_Draft_Billed_Work(input: BilledWorkDraftRequest, _state: PipelineState): Promise<BilledWorkDraft> {
  // Structured LLM call → BilledWorkDraft
  const _model = "openrouter:deepseek-v4";
  void _model;
  const userPrompt = "Draft structured billed work for the claim. Use selected_examples for coverage patterns and selected_work_items as the allowed catalog pool — each row includes selection_reason. Pick quantities from past jobs where sensible. Output title and line_items with work_item_id, quantity, and rationale." + "\n\nINPUT DATA:\n" + JSON.stringify(input, null, 2);
  const schema = /* JSON schema for BilledWorkDraft */ {};
  return await llmStructured<BilledWorkDraft>(userPrompt, schema);
}

/**
 * Billed Work Output
 * @kind Output
 * @cached true
 */
async function step_Billed_Work_Output(input: BilledWorkDraft, _state: PipelineState): Promise<BilledWorkDraft> {
  // Snapshot BilledWorkDraft
  return input as unknown as BilledWorkDraft;
}

// === orchestrator ===
export type PipelineRunInputs = {
  "Work Description": Document;
  "Job Example Library": Document;
  "Work Item Catalog": Document;
};

export async function runPipeline(inputs: PipelineRunInputs): Promise<unknown> {
  const state = {} as PipelineState;
  let spine: unknown;

  // 1. Work Description
  spine = await step_Work_Description(inputs["Work Description"], state);
  state["Work Description"] = spine as Document;

  // 2. Normalize Case
  spine = await step_Normalize_Case(spine as Document, state);
  state["Normalize Case"] = spine as WorkDescription;

  // 3. Job Example Library
  spine = await step_Job_Example_Library(inputs["Job Example Library"], state);
  state["Job Example Library"] = spine as JobExampleLibraryFile;

  // 4. Combine Job Inputs
  spine = await step_Combine_Job_Inputs(spine as JobExampleLibraryFile, state);
  state["Combine Job Inputs"] = spine as JobSelectBundle;

  // 5. Parse Job Examples
  spine = await step_Parse_Job_Examples(spine as JobSelectBundle, state);
  state["Parse Job Examples"] = spine as JobExample[];

  // 6. Select Relevant Jobs
  spine = await step_Select_Relevant_Jobs(spine as JobExample[], state);
  state["Select Relevant Jobs"] = spine as SelectedJobExample[];

  // 7. Merge for Item Filter
  spine = await step_Merge_for_Item_Filter(spine as SelectedJobExample[], state);
  state["Merge for Item Filter"] = spine as ItemFilterContext;

  // 8. Work Item Catalog
  spine = await step_Work_Item_Catalog(inputs["Work Item Catalog"], state);
  state["Work Item Catalog"] = spine as WorkItemCatalogFile;

  // 9. Combine Catalog
  spine = await step_Combine_Catalog(spine as WorkItemCatalogFile, state);
  state["Combine Catalog"] = spine as CatalogSelectBundle;

  // 10. Parse Work Items
  spine = await step_Parse_Work_Items(spine as CatalogSelectBundle, state);
  state["Parse Work Items"] = spine as WorkItem[];

  // 11. Select Relevant Work Items
  spine = await step_Select_Relevant_Work_Items(spine as WorkItem[], state);
  state["Select Relevant Work Items"] = spine as SelectedWorkItem[];

  // 12. Merge for Draft
  spine = await step_Merge_for_Draft(spine as SelectedWorkItem[], state);
  state["Merge for Draft"] = spine as BilledWorkDraftRequest;

  // 13. Draft Billed Work
  spine = await step_Draft_Billed_Work(spine as BilledWorkDraftRequest, state);
  state["Draft Billed Work"] = spine as BilledWorkDraft;

  // 14. Billed Work Output
  spine = await step_Billed_Work_Output(spine as BilledWorkDraft, state);
  state["Billed Work Output"] = spine as BilledWorkDraft;

  return spine;
}

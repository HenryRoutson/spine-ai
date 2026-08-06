// Generated pipeline export — equivalent TypeScript representation
// Project: Example Select Demo
// 13 steps · 9 structures · 601 lines
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
export type ScopeDescription = {
  description: string;
};

export type ScopeExample = {
  id: string;
  title: string;
  scope_text: string;
};

export type SelectedExample = {
  id: string;
  title: string;
  scope_text: string;
  selection_reason: string;
};

export type ScopeDraftRequest = {
  description: string;
  selected_examples: SelectedExample[];
};

export type ExampleLibraryFile = {
  examples: ScopeExample[];
};

export type ScopeSelectBundle = {
  case: ScopeDescription;
  library: ExampleLibraryFile;
};

export type ScopeDraft = {
  title: string;
  scope_of_works: string;
};


// === pipeline state ===
export type PipelineState = {
  "Damage Case": Document;
  "Normalize Case": ScopeDescription;
  "Example Library": ExampleLibraryFile;
  "Combine Inputs": ScopeSelectBundle;
  "Parse Examples": ScopeExample[];
  "Select Relevant Examples": SelectedExample[];
  "Merge for Draft": ScopeDraftRequest;
  "Draft Scope": ScopeDraft;
  "✓ Combine Inputs": ScopeDraft;
  "✓ Normalize Case": ScopeSelectBundle;
  "✓ Parse Examples": ScopeDescription;
  "✓ Select Relevant Examples": ScopeExample[];
  "Scope Output": SelectedExample[];
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
 * Damage Case
 * @kind Input
 * New leak description — feeds {description} via Normalize Case
 * @cached true
 */
async function step_Damage_Case(input: Document, _state: PipelineState): Promise<Document> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "Plain-text description of the new damage case"
  // Filename must contain: "damage_case"
  const doc = input as Document & { base64?: string; mime?: string };
  const content = doc.content;
  return { content, filename: doc.filename };
}

/**
 * Normalize Case
 * @kind Custom Code
 * Document → ScopeDescription — deterministic wrapper for the example-select context label.
 * @cached true
 */
async function step_Normalize_Case(input: Document, state: PipelineState): Promise<ScopeDescription> {
  const __compiled = new Function("return " + "((doc) => ({ description: String(doc?.content ?? \"\").trim() }))")() as (input: Document, state?: PipelineState) => ScopeDescription;
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as ScopeDescription;
}

/**
 * Example Library
 * @kind Input
 * Reference example library — side input for combine (must follow Normalize Case on spine)
 * @cached true
 */
async function step_Example_Library(input: Document, _state: PipelineState): Promise<ExampleLibraryFile> {
  // Parse uploaded file — built-in parser or vision OCR when enabled
  // Input guard: "JSON file with examples array of past scope-of-works rows"
  // Filename must contain: "example_library"
  const doc = input as Document & { base64?: string; mime?: string };
  const content = doc.content;
  return JSON.parse(content) as ExampleLibraryFile;
}

/**
 * Combine Inputs
 * @kind Combine Inputs
 * Merges ScopeDescription (pipeline state) with Example Library side input — required after input → code → input.
 * @cached true
 */
async function step_Combine_Inputs(input: ExampleLibraryFile, state: PipelineState): Promise<ScopeSelectBundle> {
  // Merge uploaded document with upstream ScopeDescription from pipeline state
  const newDoc = Array.isArray(input) ? input[0] : input;
  const merged = { case: state["Normalize Case"], library: newDoc as ExampleLibraryFile };
  return merged as ScopeSelectBundle;
}

/**
 * Parse Examples
 * @kind Custom Code
 * ScopeSelectBundle → list[ScopeExample] — examples from the merged library field.
 * @cached true
 */
async function step_Parse_Examples(input: ScopeSelectBundle, state: PipelineState): Promise<ScopeExample[]> {
  const __compiled = new Function("return " + "((bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error(\"expected examples array\"); return rows; })")() as (input: ScopeSelectBundle, state?: PipelineState) => ScopeExample[];
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as ScopeExample[];
}

/**
 * Select Relevant Examples
 * @kind Example Select
 * LLM relevance filter — cached prefix + per-item is_relevant; not embedding RAG.
 * @model deepseek-v4
 * @cached true
 */
async function step_Select_Relevant_Examples(input: ScopeExample[], state: PipelineState): Promise<SelectedExample[]> {
  // Per-item relevance filter — SelectedExample with selection_reason
  const description = JSON.stringify(state["Normalize Case"], null, 2);
  const items = Array.isArray(input) ? input : [input];
  const template = "Find useful examples to help create a scope of works for this description of the works.\n\nDESCRIPTION:\n\n{description}\n\nPOSSIBLE USEFUL EXAMPLE:\n\n{example}";
  const relevanceSchema = { chain_of_thought: "string", is_relevant: "boolean" };
  type RelevanceVerdict = { chain_of_thought?: string; is_relevant?: boolean };
  const verdicts = await llmBatchStructured<RelevanceVerdict>(items, (item: unknown) => template.replace("{description}", description).replace("{example}", JSON.stringify(item)), relevanceSchema);
  return items.filter((_, i) => verdicts[i]?.is_relevant).map((item, i) => ({ ...item, selection_reason: verdicts[i]?.chain_of_thought ?? "" })) as SelectedExample[];
}

/**
 * Merge for Draft
 * @kind Custom Code
 * list[SelectedExample] + description from Normalize Case on pipeline state → ScopeDraftRequest for the final LLM.
 * @cached true
 */
async function step_Merge_for_Draft(input: SelectedExample, state: PipelineState): Promise<ScopeDraftRequest> {
  const __compiled = new Function("return " + "((selected, state) => { const norm = (state ?? {})[\"Normalize Case\"]; const description = norm && typeof norm === \"object\" && norm !== null && typeof norm.description === \"string\" ? norm.description : \"\"; return { description, selected_examples: Array.isArray(selected) ? selected : [] }; })")() as (input: SelectedExample, state?: PipelineState) => ScopeDraftRequest;
  return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as ScopeDraftRequest;
}

/**
 * Draft Scope
 * @kind LLM Call
 * Final scope using selected examples and their selection_reason fields.
 * @model deepseek-v4
 * @cached true
 */
async function step_Draft_Scope(input: ScopeDraftRequest, _state: PipelineState): Promise<ScopeDraft> {
  // Structured LLM call → ScopeDraft
  const _model = "deepseek-v4";
  void _model;
  const userPrompt = "Write a numbered scope of works for the damage description. Use selected_examples only as style and coverage guidance — each row includes selection_reason explaining why it was chosen. Do not copy irrelevant work from distractor examples. Output a concise title and scope_of_works." + "\n\nINPUT DATA:\n" + JSON.stringify(input, null, 2);
  const schema = /* JSON schema for ScopeDraft */ {};
  return await llmStructured<ScopeDraft>(userPrompt, schema);
}

/**
 * ✓ Combine Inputs
 * @kind Assert
 * Structural check — combine retained case description and library examples
 * @cached true
 */
async function step__Combine_Inputs(input: ScopeDraft, state: PipelineState): Promise<ScopeDraft> {
  // Validate pipeline state — passthrough on success
  const __assert = (_input: unknown, state: PipelineState) => {
  const step = (label: string): any => {
    if (!(label in state)) throw new Error(`assert: unknown step label "${label}"`);
    return (state as Record<string, unknown>)[label];
  };

  const b = step("Combine Inputs");
  if (!b?.case?.description || typeof b.case.description !== "string" || !b.case.description.trim()) throw new Error("combine missing case.description");
  if (!Array.isArray(b?.library?.examples) || b.library.examples.length < 1) throw new Error("combine missing library.examples");
    return true;
  };
  __assert(input, state);
  return input as unknown as ScopeDraft;
}

/**
 * ✓ Normalize Case
 * @kind Assert
 * Golden fixture — damage text wrapped as ScopeDescription
 * @cached true
 */
async function step__Normalize_Case(input: ScopeSelectBundle, state: PipelineState): Promise<ScopeSelectBundle> {
  // Validate pipeline state — passthrough on success
  const __assert = (_input: unknown, state: PipelineState) => {
  function __deepEqual(a: unknown, b: unknown): boolean {
    const sortKeys = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(sortKeys);
      if (v !== null && typeof v === "object") {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
        return out;
      }
      return v;
    };
    return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  }

  const expectations = {"Normalize Case":{"description":"Water leaked from the upstairs bathroom. The kitchen ceiling below collapsed and the timber floor is cupping."},"Parse Examples":[{"id":"ex-bathroom-leak","title":"Upstairs bathroom leak — ceiling collapse below","scope_text":"1. Isolate water supply to upstairs bathroom.\n2. Remove collapsed plasterboard ceiling in kitchen (approx. 4m²).\n3. Dry structural timber with dehumidifiers for 5–7 days; monitor moisture readings.\n4. Replace damaged ceiling joists where deflection exceeds 5mm.\n5. Re-sheet ceiling, stop, and paint to match adjacent areas."},{"id":"ex-roof-storm","title":"Roof storm damage — tile replacement","scope_text":"1. Erect edge protection to roof perimeter.\n2. Replace broken roof tiles (approx. 12 nr).\n3. Reseal ridge capping and valley flashings.\n4. Internal: patch ceiling stains only where roof leak was active."},{"id":"ex-kitchen-reno","title":"Kitchen renovation — cabinetry only","scope_text":"1. Remove existing kitchen cabinetry and benchtops.\n2. Supply and install new flat-pack cabinetry per plan.\n3. Connect plumbing and electrical by licensed trades.\n4. No structural or ceiling works included."},{"id":"ex-cupping-floor","title":"Timber floor cupping after slow leak","scope_text":"1. Confirm subfloor moisture below 12% before floor works.\n2. Sand and recoat cupped timber boards in affected zone (approx. 12m²).\n3. Replace boards that remain crowned after drying period.\n4. Coordinate with ceiling repairs above if leak source not yet rectified."}]};
  const step = (label: string): any => {
    if (!(label in state)) throw new Error(`assert: unknown step label "${label}"`);
    return (state as Record<string, unknown>)[label];
  };
  const expected = (label: string): any => {
    if (!(label in expectations)) throw new Error(`assert: no expected output for step "${label}"`);
    return (expectations as Record<string, unknown>)[label];
  };
  const stripKeys = (v: unknown, keys: string | string[]): unknown => {
    const ignore = new Set(Array.isArray(keys) ? keys : [keys]);
    if (Array.isArray(v)) return v.map((x) => stripKeys(x, [...ignore]));
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (ignore.has(k)) continue;
        out[k] = stripKeys(val, [...ignore]);
      }
      return out;
    }
    return v;
  };
  const assertEqual = (actual: unknown, expOrLabel: unknown, ignoreKeys?: string[]): void => {
    const exp = typeof expOrLabel === "string" ? expected(expOrLabel) : expOrLabel;
    const left = ignoreKeys?.length ? stripKeys(actual, ignoreKeys) : actual;
    const right = ignoreKeys?.length ? stripKeys(exp, ignoreKeys) : exp;
    if (!__deepEqual(left, right)) {
      throw new Error(`assertEqual failed${typeof expOrLabel === "string" ? ` for "${expOrLabel}"` : ""}`);
    }
  };

  assertEqual(step("Normalize Case"), "Normalize Case");
    return true;
  };
  __assert(input, state);
  return input as unknown as ScopeSelectBundle;
}

/**
 * ✓ Parse Examples
 * @kind Assert
 * Golden fixture — four library rows parsed
 * @cached true
 */
async function step__Parse_Examples(input: ScopeDescription, state: PipelineState): Promise<ScopeDescription> {
  // Validate pipeline state — passthrough on success
  const __assert = (_input: unknown, state: PipelineState) => {
  function __deepEqual(a: unknown, b: unknown): boolean {
    const sortKeys = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(sortKeys);
      if (v !== null && typeof v === "object") {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
        return out;
      }
      return v;
    };
    return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  }

  const expectations = {"Normalize Case":{"description":"Water leaked from the upstairs bathroom. The kitchen ceiling below collapsed and the timber floor is cupping."},"Parse Examples":[{"id":"ex-bathroom-leak","title":"Upstairs bathroom leak — ceiling collapse below","scope_text":"1. Isolate water supply to upstairs bathroom.\n2. Remove collapsed plasterboard ceiling in kitchen (approx. 4m²).\n3. Dry structural timber with dehumidifiers for 5–7 days; monitor moisture readings.\n4. Replace damaged ceiling joists where deflection exceeds 5mm.\n5. Re-sheet ceiling, stop, and paint to match adjacent areas."},{"id":"ex-roof-storm","title":"Roof storm damage — tile replacement","scope_text":"1. Erect edge protection to roof perimeter.\n2. Replace broken roof tiles (approx. 12 nr).\n3. Reseal ridge capping and valley flashings.\n4. Internal: patch ceiling stains only where roof leak was active."},{"id":"ex-kitchen-reno","title":"Kitchen renovation — cabinetry only","scope_text":"1. Remove existing kitchen cabinetry and benchtops.\n2. Supply and install new flat-pack cabinetry per plan.\n3. Connect plumbing and electrical by licensed trades.\n4. No structural or ceiling works included."},{"id":"ex-cupping-floor","title":"Timber floor cupping after slow leak","scope_text":"1. Confirm subfloor moisture below 12% before floor works.\n2. Sand and recoat cupped timber boards in affected zone (approx. 12m²).\n3. Replace boards that remain crowned after drying period.\n4. Coordinate with ceiling repairs above if leak source not yet rectified."}]};
  const step = (label: string): any => {
    if (!(label in state)) throw new Error(`assert: unknown step label "${label}"`);
    return (state as Record<string, unknown>)[label];
  };
  const expected = (label: string): any => {
    if (!(label in expectations)) throw new Error(`assert: no expected output for step "${label}"`);
    return (expectations as Record<string, unknown>)[label];
  };
  const stripKeys = (v: unknown, keys: string | string[]): unknown => {
    const ignore = new Set(Array.isArray(keys) ? keys : [keys]);
    if (Array.isArray(v)) return v.map((x) => stripKeys(x, [...ignore]));
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (ignore.has(k)) continue;
        out[k] = stripKeys(val, [...ignore]);
      }
      return out;
    }
    return v;
  };
  const assertEqual = (actual: unknown, expOrLabel: unknown, ignoreKeys?: string[]): void => {
    const exp = typeof expOrLabel === "string" ? expected(expOrLabel) : expOrLabel;
    const left = ignoreKeys?.length ? stripKeys(actual, ignoreKeys) : actual;
    const right = ignoreKeys?.length ? stripKeys(exp, ignoreKeys) : exp;
    if (!__deepEqual(left, right)) {
      throw new Error(`assertEqual failed${typeof expOrLabel === "string" ? ` for "${expOrLabel}"` : ""}`);
    }
  };

  assertEqual(step("Parse Examples"), "Parse Examples");
    return true;
  };
  __assert(input, state);
  return input as unknown as ScopeDescription;
}

/**
 * ✓ Select Relevant Examples
 * @kind Assert
 * Structural check — selected ids must exist in Example Library / Combine Inputs / Parse Examples
 * @cached true
 */
async function step__Select_Relevant_Examples(input: ScopeExample[], state: PipelineState): Promise<ScopeExample[]> {
  // Validate pipeline state — passthrough on success
  const __assert = (input: unknown, state: PipelineState) => {
  const step = (label: string): any => {
    if (!(label in state)) throw new Error(`assert: unknown step label "${label}"`);
    return (state as Record<string, unknown>)[label];
  };

  const selected = Array.isArray(input) ? input : step("Select Relevant Examples");
  if (!Array.isArray(selected) || selected.length < 1) throw new Error("expected at least one selected example");
  const rows = [
    step("Example Library")?.examples,
    step("Combine Inputs")?.library?.examples,
    step("Parse Examples"),
  ].flatMap((v) => (Array.isArray(v) ? v : []));
  if (!rows.length) throw new Error("expected library examples from Example Library, Combine Inputs, or Parse Examples");
  const ids = new Set(rows.map((e) => e?.id).filter(Boolean));
  for (const row of selected) {
    if (typeof row?.selection_reason !== "string" || !row.selection_reason.trim()) throw new Error("missing selection_reason");
    if (!ids.has(row?.id)) throw new Error(`unknown example id ${row?.id} (library has: ${[...ids].sort().join(", ")})`);
  }
    return true;
  };
  __assert(input, state);
  return input as unknown as ScopeExample[];
}

/**
 * Scope Output
 * @kind Output
 * @cached true
 */
async function step_Scope_Output(input: SelectedExample[], _state: PipelineState): Promise<SelectedExample[]> {
  // Snapshot ScopeDraft
  return input as unknown as SelectedExample[];
}

// === orchestrator ===
export type PipelineRunInputs = {
  "Damage Case": Document;
  "Example Library": Document;
};

export async function runPipeline(inputs: PipelineRunInputs): Promise<unknown> {
  const state = {} as PipelineState;
  let spine: unknown;

  // 1. Damage Case
  spine = await step_Damage_Case(inputs["Damage Case"], state);
  state["Damage Case"] = spine as Document;

  // 2. Normalize Case
  spine = await step_Normalize_Case(spine as Document, state);
  state["Normalize Case"] = spine as ScopeDescription;

  // 3. Example Library
  spine = await step_Example_Library(inputs["Example Library"], state);
  state["Example Library"] = spine as ExampleLibraryFile;

  // 4. Combine Inputs
  spine = await step_Combine_Inputs(spine as ExampleLibraryFile, state);
  state["Combine Inputs"] = spine as ScopeSelectBundle;

  // 5. Parse Examples
  spine = await step_Parse_Examples(spine as ScopeSelectBundle, state);
  state["Parse Examples"] = spine as ScopeExample[];

  // 6. Select Relevant Examples
  spine = await step_Select_Relevant_Examples(spine as ScopeExample[], state);
  state["Select Relevant Examples"] = spine as SelectedExample[];

  // 7. Merge for Draft
  spine = await step_Merge_for_Draft(spine as SelectedExample, state);
  state["Merge for Draft"] = spine as ScopeDraftRequest;

  // 8. Draft Scope
  spine = await step_Draft_Scope(spine as ScopeDraftRequest, state);
  state["Draft Scope"] = spine as ScopeDraft;

  // 9. ✓ Combine Inputs
  spine = await step__Combine_Inputs(spine as ScopeDraft, state);
  state["✓ Combine Inputs"] = spine as ScopeDraft;

  // 10. ✓ Normalize Case
  spine = await step__Normalize_Case(spine as ScopeSelectBundle, state);
  state["✓ Normalize Case"] = spine as ScopeSelectBundle;

  // 11. ✓ Parse Examples
  spine = await step__Parse_Examples(spine as ScopeDescription, state);
  state["✓ Parse Examples"] = spine as ScopeDescription;

  // 12. ✓ Select Relevant Examples
  spine = await step__Select_Relevant_Examples(spine as ScopeExample[], state);
  state["✓ Select Relevant Examples"] = spine as ScopeExample[];

  // 13. Scope Output
  spine = await step_Scope_Output(spine as SelectedExample[], state);
  state["Scope Output"] = spine as SelectedExample[];

  return spine;
}

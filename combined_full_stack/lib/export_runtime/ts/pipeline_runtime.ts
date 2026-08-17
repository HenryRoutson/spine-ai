// AI : export runtime library — copied into pipeline zips as pipeline_runtime.ts (not generated).
// AI : generated *_pipeline.ts imports this file.
// @ts-nocheck

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
  /** Override chat completions URL (seed LLM mock / proxies) */
  openRouterBaseUrl?: string;
  /** OpenRouter seed for deterministic sampling (temperature 0 + seed) */
  openRouterSeed?: number;
  /** Directory of input files — convert-to-text reads by filename (do not put base64 on Document) */
  docsDir?: string;
  /** DeepSeek-OCR vLLM OpenAI-compatible base URL, e.g. http://127.0.0.1:8000/v1 */
  deepseekOcrBaseUrl?: string;
  /** HuggingFace / vLLM model id — default deepseek-ai/DeepSeek-OCR-2 */
  deepseekOcrModel?: string;
  /** Fallback OpenRouter vision slug when DeepSeek endpoint is unset */
  visionOcrModel?: string;
  sourceText?: string;
  sourceDocId?: string;
  onHumanReview?: <T>(input: T) => Promise<void>;
  onChatbot?: (input: ChatbotPrompt) => Promise<ChatbotResult>;
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
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", providerId: "openrouter", providerModel: "deepseek/deepseek-v4-flash-0731" },
  { id: "glm-5.2", label: "GLM 5.2", providerId: "openrouter", providerModel: "z-ai/glm-5.2" },
  { id: "gpt-5-mini", label: "GPT-5 mini", providerId: "openrouter", providerModel: "openai/gpt-4o-mini" },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6", providerId: "openrouter", providerModel: "anthropic/claude-opus-4.1" },
  { id: "sonnet-4.7", label: "Claude Sonnet 4.7", providerId: "openrouter", providerModel: "anthropic/claude-sonnet-4.5" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", providerId: "openrouter", providerModel: "google/gemini-3-flash-preview" },
];

export const DEFAULT_LLM_PROVIDER_ID: LlmProviderId = "openrouter";
export const DEFAULT_PROVIDER_MODEL: ProviderModelId = "deepseek/deepseek-chat";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

function resolveOpenRouterChatUrl(): string {
  const base = runtime.openRouterBaseUrl?.trim();
  if (!base) return OPENROUTER_CHAT_URL;
  if (base.includes("/chat/completions")) return base;
  return `${base.replace(/\/$/, "")}/chat/completions`;
}

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
  const res = await fetch(resolveOpenRouterChatUrl(), {
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
      provider: { allow_fallbacks: runtime.openRouterSeed != null },
      ...(runtime.openRouterSeed != null ? { seed: runtime.openRouterSeed } : {}),
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

export async function llmStructured<T>(prompt: string, schema: unknown): Promise<T> {
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

export async function llmBatchStructured<T>(
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

// AI : shared example-select verdict — reused by every example-select step
export const relevanceSchema = {"chain_of_thought":"string","is_relevant":"boolean"};
type RelevanceVerdict = { chain_of_thought?: string; is_relevant?: boolean };

export function exampleSelectItems(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    const arrays = Object.values(input as Record<string, unknown>).filter(Array.isArray);
    if (arrays.length === 1) return arrays[0] as unknown[];
  }
  return input == null ? [] : [input];
}

export async function selectRelevant(
  items: unknown[],
  description: string,
  template: string,
  reasonField = "selection_reason",
  promptColumns?: string[],
): Promise<unknown[]> {
  // AI : export zip copies this file standalone — do not import lib/sql-schema.
  function projectExampleForPrompt(item: unknown, columns?: string[]): unknown {
    if (!columns?.length) return item;
    if (item == null || typeof item !== "object" || Array.isArray(item)) return item;
    const rec = item as Record<string, unknown>;
    return Object.fromEntries(columns.filter((c) => c in rec).map((c) => [c, rec[c]]));
  }
  const verdicts = await llmBatchStructured<RelevanceVerdict>(
    items,
    // AI : TODO (example-select-view) — stringify the prompt view, not the full item; kept rows below stay passthrough.
    (item: unknown) => {
      const exampleText = JSON.stringify(projectExampleForPrompt(item, promptColumns));
      return template
        .replace("{description}", description)
        .replace("{example}", exampleText)
        .replace("{input_to_prompt}", exampleText);
    },
    relevanceSchema,
  );
  const kept: unknown[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!verdicts[i]?.is_relevant) continue;
    const item = items[i];
    const reason = verdicts[i]?.chain_of_thought ?? "";
    // AI : primitives/arrays must wrap — spreading a string becomes {0:'a',1:'b'} (host buildExampleSelectVerdicts).
    if (item != null && typeof item === "object" && !Array.isArray(item)) {
      kept.push({ ...(item as Record<string, unknown>), [reasonField]: reason });
    } else {
      kept.push({ value: item, [reasonField]: reason });
    }
  }
  return kept;
}

// AI : merge runtime — written once in this library, not generated per pipeline.
function __itemKeyFn(keyPath) {
  const parts = String(keyPath).split(".").filter(Boolean);
  return (item) => {
    let cur = item;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || !(part in cur)) throw new TypeError("itemKey \"" + keyPath + "\" missing");
      cur = cur[part];
    }
    if (cur == null) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    return cur;
  };
}
function __cmpKey(item, keyFn) {
  if (keyFn) return keyFn(item);
  if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
  return JSON.stringify(item);
}
function __pathForItem(path, ck, index) {
  if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
  return [...path, index];
}
function __zipMerge(left, right, resolver, path) {
  const n = Math.max(left.length, right.length), out = [];
  for (let i = 0; i < n; i++) {
    const child = [...path, i];
    if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));
    else out.push(i < left.length ? left[i] : right[i]);
  }
  return out;
}
function __dedupeMerge(items, keyFn, resolver, path) {
  const seen = new Map(), out = [];
  for (const item of items) {
    const k = __cmpKey(item, keyFn);
    if (seen.has(k)) {
      const idx = seen.get(k);
      out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));
      continue;
    }
    seen.set(k, out.length);
    out.push(item);
  }
  return out;
}
function __assertNoDupes(items, keyFn, path) {
  const seen = new Set(), out = [];
  const label = path.length ? path.join(".") : "<root>";
  for (const item of items) {
    const k = __cmpKey(item, keyFn);
    if (seen.has(k)) throw new TypeError("duplicate list item at path " + label + " (key=" + String(k) + ")");
    seen.add(k);
    out.push(item);
  }
  return out;
}
function __setOp(left, right, keyFn, resolver, path, op) {
  const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
  const ls = new Set(lk), rs = new Set(rk);
  const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
  const order = [];
  const seen = new Set();
  for (const k of [...lk, ...rk]) {
    if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
  }
  const map = new Map(), idx = new Map();
  left.forEach((item, i) => {
    const k = lk[i];
    if (!map.has(k)) { map.set(k, item); idx.set(k, i); }
    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
  });
  right.forEach((item, i) => {
    const k = rk[i];
    if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }
    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
  });
  return order.map((k) => map.get(k));
}
function __assertUnionNoOverlap(left, right, keyFn, path) {
  const lk = left.map((i) => __cmpKey(i, keyFn));
  const ls = new Set(lk);
  const label = path.length ? path.join(".") : "<root>";
  for (const item of right) {
    const k = __cmpKey(item, keyFn);
    if (ls.has(k)) throw new TypeError("union key overlap at path " + label + " (key=" + String(k) + ")");
  }
  return [...left, ...right];
}
function __assertIntersectSubset(left, right, keyFn, path) {
  const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));
  const label = path.length ? path.join(".") : "<root>";
  for (const item of left) {
    const k = __cmpKey(item, keyFn);
    if (!rs.has(k)) throw new TypeError("intersect: left item not in right at path " + label + " (key=" + String(k) + ")");
  }
  return left;
}
function __assertReplaceEmptyLeft(left, right, path) {
  const label = path.length ? path.join(".") : "<root>";
  if (left.length) throw new TypeError("replace assert: left list must be empty at path " + label + " (got " + left.length + " items)");
  return [...right];
}
function __assertPrependEmptyRight(left, right, path) {
  const label = path.length ? path.join(".") : "<root>";
  if (right.length) throw new TypeError("prepend assert: right list must be empty at path " + label + " (got " + right.length + " items)");
  return [...left];
}
function __suffixMatch(pattern, path) {
  if (pattern.length !== path.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
  }
  return true;
}
function __globstarFrom(pattern, path, pi, si) {
  if (pi === pattern.length) return si === path.length ? path.length : null;
  if (pattern[pi] === "**") {
    let best = null;
    for (let span = si; span <= path.length; span++) {
      const d = __globstarFrom(pattern, path, pi + 1, span);
      if (d != null && (best == null || d > best)) best = d;
    }
    return best;
  }
  if (si >= path.length) return null;
  if (pattern[pi] !== "*" && String(pattern[pi]) !== String(path[si])) return null;
  return __globstarFrom(pattern, path, pi + 1, si + 1);
}
function __patternDepth(pattern, path) {
  const parts = pattern.split(".").filter(Boolean);
  if (!parts.length) return path.length ? null : 0;
  if (parts.includes("**")) return __globstarFrom(parts, path, 0, 0);
  if (parts.length > path.length) return null;
  const offset = path.length - parts.length;
  return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
}
const __mergePair = function(left, right, resolver, path) {
  if (left == null) return right;
  if (right == null) return left;
  const layer = resolver.resolve(path);
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const isScalar = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  if (isObj(left) && isObj(right)) {
    if (layer.dict === "replace") return { ...right };
    if (layer.dict === "shallow") return { ...left, ...right };
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const out = {};
    for (const key of keys) {
      const child = [...path, key];
      if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);
      else out[key] = key in left ? left[key] : right[key];
    }
    return out;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const s = layer.list;
    if (s === "replace") return [...right];
    if (s === "prepend") return [...right, ...left];
    if (s === "concat") return [...left, ...right];
    if (s === "zip") return __zipMerge(left, right, resolver, path);
    if (s === "concat_dedupe") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);
    if (s === "concat_assert_no_duplicates") return __assertNoDupes([...left, ...right], layer.keyFn, path);
    if (s === "union") return __setOp(left, right, layer.keyFn, resolver, path, "union");
    if (s === "union_assert") return __assertUnionNoOverlap(left, right, layer.keyFn, path);
    if (s === "intersect") return __setOp(left, right, layer.keyFn, resolver, path, "intersect");
    if (s === "intersect_assert") return __assertIntersectSubset(left, right, layer.keyFn, path);
    if (s === "replace_assert") return __assertReplaceEmptyLeft(left, right, path);
    if (s === "prepend_assert") return __assertPrependEmptyRight(left, right, path);
    throw new Error("unknown list strategy: " + s);
  }
  if (isScalar(left) && isScalar(right)) {
    if (layer.scalar === "first") return left;
    if (layer.scalar === "last") return right;
    throw new TypeError("scalar conflict");
  }
  if (typeof left === typeof right) return layer.scalar === "first" ? left : right;
  throw new TypeError("cannot merge " + typeof left + " with " + typeof right);
};
const __resolve = class {
  constructor(policy) {
    const def = policy?.default ?? {};
    this.default = {
      list: def.list ?? "concat",
      dict: def.dict ?? "deep",
      scalar: def.scalar ?? "last",
      keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,
    };
    this.rules = (policy?.rules ?? []).map((r) => ({
      pattern: r.path,
      policy: {
        list: r.policy?.list ?? this.default.list,
        dict: r.policy?.dict ?? this.default.dict,
        scalar: r.policy?.scalar ?? this.default.scalar,
        keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,
      },
    }));
  }
  resolve(path) {
    let matched, depth = -1;
    for (const { pattern, policy } of this.rules) {
      const d = __patternDepth(pattern, path);
      if (d != null && d > depth) { matched = policy; depth = d; }
    }
    return matched ?? this.default;
  }
};
export function mergeFold(values: unknown[], policy: unknown): unknown {
  const resolver = new __resolve(policy);
  if (!values.length) return null;
  if (values.length === 1) return values[0];
  let result = values[0];
  for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);
  return result;
};

const DEFAULT_VISION_OCR_MODEL: ProviderModelId = "google/gemini-3-flash-preview";
const DEFAULT_DEEPSEEK_OCR_MODEL = "deepseek-ai/DeepSeek-OCR-2";
const OCR_SYSTEM = "You are an OCR engine. Transcribe documents faithfully. Preserve structure with markdown headings and lists where helpful. Output only the transcribed text — no commentary.";
const DEFAULT_OCR_PROMPT = "Transcribe every visible word, number, and label from this document into plain text. Preserve section headings and question numbering.";
const DEEPSEEK_OCR_PROMPT = "<image>\n<|grounding|>Convert the document to markdown.";

export type VisionOcrBytes = { mime: string; base64: string };

const _ocrTextCache = new Map<string, string>();

function hashBytes(bytes: Uint8Array): string {
  let h = 0;
  for (let i = 0; i < bytes.length; i++) h = (Math.imul(31, h) + bytes[i]!) | 0;
  return (h >>> 0).toString(16);
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

function resolveVisionOcrModel(): ProviderModelId {
  return runtime.visionOcrModel ?? runtime.llmProviderModel ?? runtime.openRouterModel ?? DEFAULT_VISION_OCR_MODEL;
}

async function openRouterVisionChat(prompt: string, attachments: VisionOcrBytes[], providerModel: ProviderModelId): Promise<string> {
  if (!runtime.openRouterApiKey) throw new Error("configurePipelineRuntime({ openRouterApiKey }) for vision OCR fallback");
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [{ type: "text", text: prompt }];
  for (const a of attachments) {
    content.push({ type: "image_url", image_url: { url: `data:${a.mime};base64,${a.base64}` } });
  }
  const res = await fetch(resolveOpenRouterChatUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": runtime.openRouterSiteUrl ?? "http://localhost:3000",
      "X-Title": runtime.openRouterAppTitle ?? "forge-pipeline-export",
    },
    body: JSON.stringify({
      model: providerModel,
      messages: [{ role: "system", content: OCR_SYSTEM }, { role: "user", content }],
      temperature: 0,
      max_tokens: 16384,
      provider: { allow_fallbacks: false },
      ...(runtime.openRouterSeed != null ? { seed: runtime.openRouterSeed } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter vision ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("vision OCR returned empty text");
  return text;
}

/** DeepSeek-OCR-2 via vLLM OpenAI-compatible /chat/completions. Request body is ephemeral — not stored on Document. */
export async function deepseekOcr(bytes: Uint8Array, mime: string): Promise<string> {
  const base = (runtime.deepseekOcrBaseUrl ?? "").replace(/\/$/, "");
  if (!base) throw new Error("configurePipelineRuntime({ deepseekOcrBaseUrl }) for DeepSeek OCR");
  const model = runtime.deepseekOcrModel ?? DEFAULT_DEEPSEEK_OCR_MODEL;
  const b64 = Buffer.from(bytes).toString("base64");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          { type: "text", text: DEEPSEEK_OCR_PROMPT },
        ],
      }],
      max_tokens: 8192,
      temperature: 0,
      extra_body: {
        skip_special_tokens: false,
        vllm_xargs: { ngram_size: 30, window_size: 90, whitelist_token_ids: [128821, 128822] },
      },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek OCR ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("DeepSeek OCR returned empty text");
  return text;
}

async function ocrBytes(bytes: Uint8Array, mime: string, purpose: string): Promise<string> {
  const key = `${runtime.deepseekOcrBaseUrl ?? "or"}:${runtime.deepseekOcrModel ?? runtime.visionOcrModel ?? ""}:${hashBytes(bytes)}`;
  const hit = _ocrTextCache.get(key);
  if (hit) return hit;
  let text: string;
  if (runtime.deepseekOcrBaseUrl) {
    text = await deepseekOcr(bytes, mime);
  } else {
    const prompt = `${DEFAULT_OCR_PROMPT}\n\nDocument purpose: ${purpose || "general transcription"}`;
    text = await openRouterVisionChat(prompt, [{ mime, base64: Buffer.from(bytes).toString("base64") }], resolveVisionOcrModel());
  }
  _ocrTextCache.set(key, text);
  return text;
}

type ExportDocument = { content?: string | null; filename: string };

function readDocsFile(filename: string): { bytes: Uint8Array; mime: string } {
  const dir = runtime.docsDir ?? "docs";
  const { readFileSync } = require("node:fs") as { readFileSync: (p: string) => Buffer };
  const { join } = require("node:path") as { join: (...p: string[]) => string };
  const bytes = new Uint8Array(readFileSync(join(dir, filename)));
  return { bytes, mime: mimeFromFilename(filename) };
}

/** Convert-to-text — instantiates Document.content from docsDir. Never stores encoded copies on Document. */
export async function convertDocToText(
  doc: ExportDocument,
  opts: { ocr?: boolean; purpose?: string } = {},
): Promise<{ content: string; filename: string }> {
  const filename = doc.filename;
  if (typeof doc.content === "string" && doc.content.trim()) {
    return { content: doc.content, filename };
  }
  const { bytes, mime } = readDocsFile(filename);
  if (opts.ocr) {
    return { content: await ocrBytes(bytes, mime, opts.purpose ?? "general transcription"), filename };
  }
  const text = new TextDecoder().decode(bytes).trim();
  if (!text) throw new Error(`convert to text: no parser text for ${filename} — set ocr:true for scans`);
  return { content: text, filename };
}

/** @deprecated use convertDocToText — kept so older generated steps compile */
export async function visionOcr(bytes: VisionOcrBytes, purpose = "general transcription"): Promise<string> {
  const raw = Buffer.from(bytes.base64, "base64");
  return ocrBytes(new Uint8Array(raw), bytes.mime, purpose);
}

export function resolveQuotes<T>(_data: unknown, _sourceText: string, _docId: string): T {
  const text = runtime.sourceText ?? _sourceText;
  const docId = runtime.sourceDocId ?? _docId;
  if (!text || !docId) throw new Error("configurePipelineRuntime({ sourceText, sourceDocId }) for quote steps");
  throw new Error("wire resolveQuotes to your quote linker");
}

export async function waitForHumanReview<T>(input: T): Promise<void> {
  if (runtime.onHumanReview) {
    await runtime.onHumanReview(input);
    return;
  }
  throw new Error("wire waitForHumanReview or configurePipelineRuntime({ onHumanReview })");
}

export type ChatbotPrompt = { prompt: string };
export type ChatbotTurn = { role: string; content: string };
export type ChatbotResult = { prompt: string; transcript: ChatbotTurn[]; exit_reason: string };

export async function waitForChatbotSession(
  input: ChatbotPrompt,
  _opts?: { mode?: string },
): Promise<ChatbotResult> {
  if (runtime.onChatbot) {
    return runtime.onChatbot(input);
  }
  throw new Error("wire waitForChatbotSession or configurePipelineRuntime({ onChatbot })");
}

export type WebhookCallOpts = {
  urlEnv: string;
  method?: string;
  authEnv?: string;
  includeState?: boolean;
  responsePath?: string;
  timeoutMs?: number;
};

export async function callWebhook(
  input: unknown,
  state: unknown,
  opts: WebhookCallOpts,
): Promise<unknown> {
  const url = process.env[opts.urlEnv]?.trim();
  if (!url) throw new Error(`set ${opts.urlEnv} in .env`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.authEnv) {
    const auth = process.env[opts.authEnv]?.trim();
    if (auth) headers.Authorization = auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
  }
  const body = opts.includeState === false ? { input } : { input, state };
  const res = await fetch(url, {
    method: opts.method ?? "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`webhook ${res.status}: ${text.slice(0, 240)}`);
  }
  const raw = await res.json();
  if (!opts.responsePath?.trim()) return raw;
  return opts.responsePath.split(".").reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== "object") throw new Error(`webhook response path failed at ${key}`);
    return (cur as Record<string, unknown>)[key];
  }, raw);
}
// AI : export runtime library — copied into pipeline zips as pipeline_runtime.ts (not generated).
// AI : generated *_pipeline.ts imports this file.
// AI : standalone zip — no @/ imports; Node bits are declared so tsc can lint without @types/node.

type buffer_bytes = Uint8Array & { toString(enc: string): string };
declare const Buffer: {
  from(data: Uint8Array | string, enc?: string): buffer_bytes;
};
declare const process: { env: Record<string, string | undefined> };
declare function require(mod: string): unknown;

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
function __itemKeyFn(keyPath: string) {
  const parts = String(keyPath).split(".").filter(Boolean);
  return (item: unknown) => {
    let cur: unknown = item;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || !(part in (cur as object))) throw new TypeError("itemKey \"" + keyPath + "\" missing");
      cur = (cur as Record<string, unknown>)[part];
    }
    if (cur == null) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    return cur;
  };
}
function __cmpKey(item: unknown, keyFn?: (item: unknown) => unknown) {
  if (keyFn) return keyFn(item);
  if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
  return JSON.stringify(item);
}
function __pathForItem(path: unknown[], ck: unknown, index: number) {
  if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
  return [...path, index];
}
function __zipMerge(left: unknown[], right: unknown[], resolver: { resolve: (path: unknown[]) => any }, path: unknown[]) {
  const n = Math.max(left.length, right.length), out: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const child = [...path, i];
    if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));
    else out.push(i < left.length ? left[i] : right[i]);
  }
  return out;
}
function __dedupeMerge(items: unknown[], keyFn: ((item: unknown) => unknown) | undefined, resolver: { resolve: (path: unknown[]) => any }, path: unknown[]) {
  const seen = new Map<unknown, number>(), out: unknown[] = [];
  for (const item of items) {
    const k = __cmpKey(item, keyFn);
    if (seen.has(k)) {
      const idx = seen.get(k) ?? 0;
      out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));
      continue;
    }
    seen.set(k, out.length);
    out.push(item);
  }
  return out;
}
function __assertNoDupes(items: unknown[], keyFn: ((item: unknown) => unknown) | undefined, path: unknown[]) {
  const seen = new Set<unknown>(), out: unknown[] = [];
  const label = path.length ? path.join(".") : "<root>";
  for (const item of items) {
    const k = __cmpKey(item, keyFn);
    if (seen.has(k)) throw new TypeError("duplicate list item at path " + label + " (key=" + String(k) + ")");
    seen.add(k);
    out.push(item);
  }
  return out;
}
function __setOp(left: unknown[], right: unknown[], keyFn: ((item: unknown) => unknown) | undefined, resolver: { resolve: (path: unknown[]) => any }, path: unknown[], op: string) {
  const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
  const ls = new Set(lk), rs = new Set(rk);
  const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
  const order: unknown[] = [];
  const seen = new Set<unknown>();
  for (const k of [...lk, ...rk]) {
    if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
  }
  const map = new Map<unknown, unknown>(), idx = new Map<unknown, number>();
  left.forEach((item, i) => {
    const k = lk[i];
    if (!map.has(k)) { map.set(k, item); idx.set(k, i); }
    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k) ?? i)));
  });
  right.forEach((item, i) => {
    const k = rk[i];
    if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }
    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k) ?? left.length + i)));
  });
  return order.map((k) => map.get(k));
}
function __assertUnionNoOverlap(left: unknown[], right: unknown[], keyFn: ((item: unknown) => unknown) | undefined, path: unknown[]) {
  const lk = left.map((i) => __cmpKey(i, keyFn));
  const ls = new Set(lk);
  const label = path.length ? path.join(".") : "<root>";
  for (const item of right) {
    const k = __cmpKey(item, keyFn);
    if (ls.has(k)) throw new TypeError("union key overlap at path " + label + " (key=" + String(k) + ")");
  }
  return [...left, ...right];
}
function __assertIntersectSubset(left: unknown[], right: unknown[], keyFn: ((item: unknown) => unknown) | undefined, path: unknown[]) {
  const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));
  const label = path.length ? path.join(".") : "<root>";
  for (const item of left) {
    const k = __cmpKey(item, keyFn);
    if (!rs.has(k)) throw new TypeError("intersect: left item not in right at path " + label + " (key=" + String(k) + ")");
  }
  return left;
}
function __assertReplaceEmptyLeft(left: unknown[], right: unknown[], path: unknown[]) {
  const label = path.length ? path.join(".") : "<root>";
  if (left.length) throw new TypeError("replace assert: left list must be empty at path " + label + " (got " + left.length + " items)");
  return [...right];
}
function __assertPrependEmptyRight(left: unknown[], right: unknown[], path: unknown[]) {
  const label = path.length ? path.join(".") : "<root>";
  if (right.length) throw new TypeError("prepend assert: right list must be empty at path " + label + " (got " + right.length + " items)");
  return [...left];
}
function __suffixMatch(pattern: string[], path: unknown[]) {
  if (pattern.length !== path.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
  }
  return true;
}
function __globstarFrom(pattern: string[], path: unknown[], pi: number, si: number): number | null {
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
function __patternDepth(pattern: string, path: unknown[]) {
  const parts = pattern.split(".").filter(Boolean);
  if (!parts.length) return path.length ? null : 0;
  if (parts.includes("**")) return __globstarFrom(parts, path, 0, 0);
  if (parts.length > path.length) return null;
  const offset = path.length - parts.length;
  return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
}
const __mergePair = function(left: unknown, right: unknown, resolver: { resolve: (path: unknown[]) => any }, path: unknown[]): unknown {
  if (left == null) return right;
  if (right == null) return left;
  const layer = resolver.resolve(path);
  const isObj = (v: unknown): v is Record<string, unknown> => !!(v && typeof v === "object" && !Array.isArray(v));
  const isScalar = (v: unknown) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  if (isObj(left) && isObj(right)) {
    if (layer.dict === "replace") return { ...right };
    if (layer.dict === "shallow") return { ...left, ...right };
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const out: Record<string, unknown> = {};
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
  default: { list: string; dict: string; scalar: string; keyFn?: (item: unknown) => unknown };
  rules: { pattern: string; policy: { list: string; dict: string; scalar: string; keyFn?: (item: unknown) => unknown } }[];
  constructor(policy: any) {
    const def = policy?.default ?? {};
    this.default = {
      list: def.list ?? "concat",
      dict: def.dict ?? "deep",
      scalar: def.scalar ?? "last",
      keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,
    };
    this.rules = (policy?.rules ?? []).map((r: any) => ({
      pattern: r.path,
      policy: {
        list: r.policy?.list ?? this.default.list,
        dict: r.policy?.dict ?? this.default.dict,
        scalar: r.policy?.scalar ?? this.default.scalar,
        keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,
      },
    }));
  }
  resolve(path: unknown[]) {
    let matched: { list: string; dict: string; scalar: string; keyFn?: (item: unknown) => unknown } | undefined;
    let depth = -1;
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
  const { readFileSync } = require("node:fs") as { readFileSync: (p: string) => Uint8Array };
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
  return ocrBytes(raw, bytes.mime, purpose);
}

export function resolveQuotes<T>(
  data: unknown,
  _sourceText: string,
  _docId: string,
  quotePaths: string[] = [],
  isList = false,
): T {
  const text = runtime.sourceText ?? _sourceText;
  const docId = runtime.sourceDocId ?? _docId;
  if (!text || !docId) throw new Error("configurePipelineRuntime({ sourceText, sourceDocId }) for quote steps");
  const apply = (row: unknown) => linkQuoteTree(row, text, docId, quotePaths);
  if (isList && Array.isArray(data)) return data.map(apply) as T;
  return apply(data) as T;
}

// AI : same algorithm as lib/server/quotation.ts findQuote — keep in this file so the zip stays standalone.
export function findQuote(
  quote: string,
  source: string,
  docId: string,
): { text: string; docId: string; start: number; end: number; exact: boolean; score: number } {
  const nQuote = quote.replace(/\s+/g, " ").trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
  const nSource = source.replace(/\s+/g, " ").trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
  const denormOffset = (normIndex: number): number => {
    let seen = 0;
    let i = 0;
    let prevSpace = false;
    for (; i < source.length; i++) {
      const isSpace = /\s/.test(source[i]!);
      if (isSpace) {
        if (prevSpace) continue;
        prevSpace = true;
      } else {
        prevSpace = false;
      }
      if (seen === normIndex && !(isSpace && seen === 0)) return i;
      if (!(isSpace && seen === 0)) seen++;
      if (seen > normIndex) return i;
    }
    return i;
  };
  const exactIdx = nSource.indexOf(nQuote);
  if (exactIdx !== -1) {
    const start = denormOffset(exactIdx);
    const end = denormOffset(exactIdx + nQuote.length);
    return { text: source.slice(start, end), docId, start, end, exact: true, score: 1 };
  }
  const tokens = (s: string) => s.split(" ").map((t) => t.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  const tokenOverlap = (q: string, window: string) => {
    const qt = tokens(q);
    const wt = new Set(tokens(window));
    if (qt.length === 0) return 0;
    return qt.filter((t) => wt.has(t)).length / qt.length;
  };
  const words = nSource.split(" ");
  const span = Math.max(1, nQuote.split(" ").length);
  let best = { score: -1, normStart: 0, normLen: nQuote.length };
  let cursor = 0;
  for (let i = 0; i < words.length; i++) {
    const window = words.slice(i, i + span).join(" ");
    const score = tokenOverlap(nQuote, window);
    if (score > best.score) best = { score, normStart: cursor, normLen: window.length };
    cursor += words[i]!.length + 1;
  }
  const start = denormOffset(best.normStart);
  const end = denormOffset(best.normStart + best.normLen);
  return { text: source.slice(start, end), docId, start, end, exact: false, score: Math.max(0, best.score) };
}

type linked_quote = { text: string; quote: { doc_id: string; start: number; end: number } };

function isLinkedQuote(v: unknown): v is linked_quote {
  if (!v || typeof v !== "object") return false;
  const o = v as linked_quote;
  return (
    typeof o.text === "string" &&
    typeof o.quote?.doc_id === "string" &&
    typeof o.quote.start === "number" &&
    typeof o.quote.end === "number"
  );
}

function linkQuoteValue(raw: unknown, source: string, docId: string): unknown {
  if (typeof raw === "string") {
    const m = findQuote(raw, source, docId);
    return { text: m.text, quote: { doc_id: m.docId, start: m.start, end: m.end } };
  }
  if (isLinkedQuote(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as { text?: unknown; quote?: unknown };
    if (typeof o.quote === "string") {
      const m = findQuote(o.quote, source, docId);
      return {
        text: typeof o.text === "string" ? o.text : m.text,
        quote: { doc_id: m.docId, start: m.start, end: m.end },
      };
    }
  }
  if (Array.isArray(raw)) return raw.map((item) => linkQuoteValue(item, source, docId));
  return raw;
}

function setAtPath(root: unknown, segments: string[], source: string, docId: string): unknown {
  if (!segments.length) return linkQuoteValue(root, source, docId);
  const [head, ...rest] = segments;
  const list = head!.endsWith("[]");
  const key = list ? head!.slice(0, -2) : head!;
  if (root == null || typeof root !== "object") return root;
  if (Array.isArray(root)) {
    return root.map((item) => setAtPath(item, segments, source, docId));
  }
  const obj = root as Record<string, unknown>;
  if (!(key in obj)) return root;
  const next = obj[key];
  if (list && Array.isArray(next)) {
    return { ...obj, [key]: next.map((item) => setAtPath(item, rest, source, docId)) };
  }
  return { ...obj, [key]: setAtPath(next, rest, source, docId) };
}

function linkQuoteTree(data: unknown, source: string, docId: string, quotePaths: string[]): unknown {
  if (!quotePaths.length) return linkQuoteShapes(data, source, docId);
  let out = data;
  for (const path of quotePaths) {
    const segments = path.split(".").filter(Boolean);
    out = setAtPath(out, segments, source, docId);
  }
  return out;
}

function linkQuoteShapes(data: unknown, source: string, docId: string): unknown {
  if (Array.isArray(data)) return data.map((item) => linkQuoteShapes(item, source, docId));
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.quote === "string" || isLinkedQuote(data)) return linkQuoteValue(data, source, docId);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = linkQuoteShapes(v, source, docId);
    return out;
  }
  return data;
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
  urlEnv?: string;
  url?: string;
  urlDefault?: string;
  method?: string;
  authEnv?: string;
  includeState?: boolean;
  responsePath?: string;
  timeoutMs?: number;
  bodyMode?: "wrap" | "raw";
  pollStatusUrlPath?: string;
  pollStatusPath?: string;
  pollDoneWhen?: string[];
  pollFailWhen?: string[];
  ingestUrlPath?: string;
  ingestInputType?: string;
};

function envVal(key: string | undefined): string {
  return (key ? process.env[key] : undefined)?.trim() ?? "";
}

function webhookAuthHeader(auth: string): string {
  if (/^(Bearer|Key|Basic|Digest)\s+/i.test(auth)) return auth;
  if (/^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/.test(auth)) return `Key ${auth}`;
  return `Bearer ${auth}`;
}

function webhookGetAtPath(root: unknown, path: string | undefined): unknown {
  if (!path?.trim()) return root;
  let cur: unknown = root;
  for (const segment of path.split(".").map((s) => s.trim()).filter(Boolean)) {
    if (cur == null || typeof cur !== "object") throw new Error(`webhook path "${path}" failed at "${segment}"`);
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

async function pollWebhookJob(
  submitted: unknown,
  opts: WebhookCallOpts,
  authHeader: string | undefined,
  deadlineMs: number,
): Promise<unknown> {
  const statusUrlPath = opts.pollStatusUrlPath?.trim();
  if (!statusUrlPath) return submitted;
  const doneWhen = (opts.pollDoneWhen ?? ["completed"]).map((s) => s.toLowerCase());
  const failWhen = (opts.pollFailWhen ?? ["failed", "nsfw", "canceled", "cancelled"]).map((s) => s.toLowerCase());
  const statusPath = opts.pollStatusPath?.trim() || "status";
  let current = submitted;
  let delayMs = 2_000;
  while (true) {
    const statusRaw = webhookGetAtPath(current, statusPath);
    const status = (typeof statusRaw === "string" ? statusRaw : String(statusRaw ?? "")).toLowerCase();
    if (doneWhen.includes(status)) return current;
    if (failWhen.includes(status)) {
      const err = webhookGetAtPath(current, "error");
      throw new Error(`webhook job ${status}${err ? `: ${String(err).slice(0, 240)}` : ""}`);
    }
    const remain = deadlineMs - Date.now();
    if (remain <= 0) throw new Error(`webhook poll timed out after ${opts.timeoutMs ?? 30_000}ms (last status ${status || "unknown"})`);
    const statusUrl = webhookGetAtPath(current, statusUrlPath);
    if (typeof statusUrl !== "string" || !statusUrl.trim()) {
      throw new Error(`webhook poll: no URL at path "${statusUrlPath}"`);
    }
    await new Promise((r) => setTimeout(r, Math.min(delayMs, remain)));
    const pollHeaders: Record<string, string> = { Accept: "application/json" };
    if (authHeader) pollHeaders.Authorization = authHeader;
    const res = await fetch(statusUrl.trim(), {
      method: "GET",
      headers: pollHeaders,
      signal: AbortSignal.timeout(Math.min(30_000, Math.max(1_000, deadlineMs - Date.now()))),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`webhook poll ${res.status}${text ? `: ${text.slice(0, 240)}` : ""}`);
    }
    current = await res.json();
    delayMs = Math.min(Math.round(delayMs * 1.5), 10_000);
  }
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop();
    if (base && /\.[a-z0-9]+$/i.test(base)) return base;
  } catch {
    /* ignore */
  }
  return fallback;
}

async function ingestWebhookMedia(mediaUrl: string, inputType: string | undefined): Promise<unknown> {
  const url = mediaUrl.trim();
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ingest ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 16) throw new Error("ingest: empty media body");
  const filename = filenameFromUrl(
    url,
    inputType === "audio" ? "clip.mp3" : inputType === "image" ? "still.png" : "clip.mp4",
  );
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() ||
    mimeFromFilename(filename);
  return { doc_id: hashBytes(bytes), url, filename, mime };
}

// AI : n8n Code-node — same semantics as lib/n8n-run.ts; catalog code is baked into the generated step.
type N8nItem = { json: Record<string, unknown> };

function spineToN8nItems(input: unknown): N8nItem[] {
  if (input == null) return [{ json: {} }];
  if (Array.isArray(input)) {
    return input.map((row) => ({
      json: row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : { value: row },
    }));
  }
  if (typeof input === "object") return [{ json: input as Record<string, unknown> }];
  return [{ json: { value: input } }];
}

function n8nItemsToSpine(items: N8nItem[], inputWasList: boolean): unknown {
  const jsons = items.map((i) => i.json ?? {});
  if (inputWasList) return jsons;
  return jsons[0] ?? {};
}

function asN8nItems(raw: unknown, fallback: N8nItem[]): N8nItem[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.map((row) => {
    if (row && typeof row === "object" && "json" in row && row.json && typeof row.json === "object") {
      return { json: row.json as Record<string, unknown> };
    }
    if (row && typeof row === "object" && !Array.isArray(row)) return { json: row as Record<string, unknown> };
    return { json: { value: row } };
  });
}

function evalN8nCode(code: string, items: N8nItem[], params: Record<string, unknown>): N8nItem[] {
  const src = code.trim();
  if (!src) return items;
  const $input = {
    all: () => items,
    first: () => items[0],
    item: items[0],
  };
  const $json = items[0]?.json ?? {};
  const fn = new Function("items", "$input", "$json", "$parameter", "params", `"use strict";\n${src}`);
  const result = fn(items, $input, $json, params, params);
  return asN8nItems(result, items);
}

/** Run baked n8n Code-node JS against spine input (UI uses the same eval shape). */
export async function runN8nCode(
  code: string,
  params: Record<string, unknown>,
  input: unknown,
  timeoutMs = 60_000,
): Promise<unknown> {
  const items = spineToN8nItems(input);
  const ran = await Promise.race([
    Promise.resolve().then(() => evalN8nCode(code, items, params)),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`n8n piece timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
  return n8nItemsToSpine(ran, Array.isArray(input));
}

export async function callWebhook(
  input: unknown,
  state: unknown,
  opts: WebhookCallOpts,
): Promise<unknown> {
  const url = (opts.url?.trim() || envVal(opts.urlEnv) || opts.urlDefault?.trim() || "");
  if (!url) throw new Error(`set ${opts.urlEnv ?? "webhook URL"} in .env`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let authHeader: string | undefined;
  if (opts.authEnv) {
    const auth = envVal(opts.authEnv);
    if (auth) {
      authHeader = webhookAuthHeader(auth);
      headers.Authorization = authHeader;
    }
  }
  const body = opts.bodyMode === "raw" ? input : opts.includeState === false ? { input } : { input, state };
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const res = await fetch(url, {
    method: opts.method ?? "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.min(timeoutMs, 30_000)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`webhook ${res.status}: ${text.slice(0, 240)}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  const submitted = contentType.includes("application/json") ? await res.json() : await res.text();
  const terminal = await pollWebhookJob(submitted, opts, authHeader, Date.now() + timeoutMs);
  if (opts.ingestUrlPath?.trim()) {
    const mediaUrl = webhookGetAtPath(terminal, opts.ingestUrlPath);
    if (typeof mediaUrl !== "string" || !mediaUrl.trim()) {
      throw new Error(`webhook ingest: no URL at path "${opts.ingestUrlPath}"`);
    }
    return ingestWebhookMedia(mediaUrl, opts.ingestInputType);
  }
  return webhookGetAtPath(terminal, opts.responsePath);
}
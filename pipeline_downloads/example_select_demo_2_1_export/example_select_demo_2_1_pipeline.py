"""Generated pipeline export — equivalent Python representation"""
# Project: Example Select Demo 2 1
# 14 steps · 18 structures · 975 lines
# Setup: export also includes .env.example and README.md — copy .env.example → .env

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, TypedDict, cast

from pydantic import BaseModel, Field

# === structures ===
# `text` is an alias for str — kept readable for non-technical reviewers.
# Quote links extracted text back to its source span (see langextract).
# quote_string_t → str at LLM time; quote_span_t / QuoteSpan after Link Quotes.
class QuoteSpan(BaseModel):
    doc_id: str = Field(description="Source document hash")
    start: int = Field(description="Start offset in the source")
    end: int = Field(description="End offset in the source")

Quote = QuoteSpan

class TextQuote(BaseModel):
    text: str
    quote: QuoteSpan

class Document(BaseModel):
    content: str = Field(description="Full extracted text of the file")
    filename: str = Field(description="Original upload filename")

class FileInput(BaseModel):
    content: str
    filename: str

type quote_string_t = str
type quote_span_t = QuoteSpan
type text_quote_t = dict[str, str]

class WorkDescription(BaseModel):
    """New claim work description — fills {description} in the first example-select pass."""
    description: str = Field(description="Plain-language damage description")


class BilledLineRef(BaseModel):
    """Reference to a catalog work item on a past job."""
    work_item_id: str = Field(description="Catalog work item id")
    quantity: float = Field(description="Billed quantity")
    unit_note: str | None = Field(default=None, description="Optional unit clarification")


class JobExample(BaseModel):
    """One past repair job from the example library."""
    id: str = Field(description="Stable job example id")
    title: str = Field(description="Short label")
    work_description: str = Field(description="Past claim narrative")
    billed_items: list[BilledLineRef] = Field(description="Structured billed work references")


class SelectedJobExample(BaseModel):
    """Relevant past job after example-select — includes selection_reason."""
    id: str = Field(description="Matches library id")
    title: str = Field(description="Short label")
    work_description: str = Field(description="Past claim narrative")
    billed_items: list[BilledLineRef] = Field(description="Structured billed work references")
    selection_reason: str = Field(description="Why this job is useful for the current claim")


class JobExampleLibraryFile(BaseModel):
    """Parsed JSON upload — examples array for job library input."""
    examples: list[JobExample] = Field(description="Past job rows")


class JobSelectBundle(BaseModel):
    """Work description + job example library merged by combine."""
    case: WorkDescription = Field(description="WorkDescription from Normalize Case")
    library: JobExampleLibraryFile = Field(description="Job example library side input")


class ItemFilterContext(BaseModel):
    """Claim description + selected past jobs — cached context for catalog filtering."""
    description: str = Field(description="Current claim work description")
    selected_examples: list[SelectedJobExample] = Field(description="Filtered past jobs")


class WorkItem(BaseModel):
    """One row from the master work-item catalog."""
    id: str = Field(description="Catalog id")
    code: str = Field(description="Trade code")
    trade: str = Field(description="Trade category")
    unit: str = Field(description="Billing unit")
    description: str = Field(description="Line item description")


class WorkItemCatalogFile(BaseModel):
    """Parsed JSON upload — items array for catalog input."""
    items: list[WorkItem] = Field(description="Master catalog rows")


class CatalogSelectBundle(BaseModel):
    """Item filter context + work item catalog merged by combine."""
    draft_context: ItemFilterContext = Field(description="Description + selected jobs from Merge for Item Filter")
    catalog: WorkItemCatalogFile = Field(description="Work item catalog side input")


class SelectedWorkItem(BaseModel):
    """Relevant catalog row after example-select — includes selection_reason."""
    id: str = Field(description="Catalog id")
    code: str = Field(description="Trade code")
    trade: str = Field(description="Trade category")
    unit: str = Field(description="Billing unit")
    description: str = Field(description="Line item description")
    selection_reason: str = Field(description="Why this catalog item applies to the claim")


class BilledWorkDraftRequest(BaseModel):
    """Merged description, jobs, and filtered catalog items for final LLM."""
    description: str = Field(description="Current claim")
    selected_examples: list[SelectedJobExample] = Field(description="Filtered past jobs")
    selected_work_items: list[SelectedWorkItem] = Field(description="Filtered catalog rows")


class DraftLineItem(BaseModel):
    """One billed line on the draft scope."""
    work_item_id: str = Field(description="Catalog id")
    quantity: float = Field(description="Proposed quantity")
    rationale: str = Field(description="Why this line is on the scope")


class BilledWorkDraft(BaseModel):
    """Draft structured billed work for the new claim."""
    title: str = Field(description="Short job title")
    line_items: list[DraftLineItem] = Field(description="Proposed billed lines")


class Wrap_selected_examples(BaseModel):
    """Auto-derived merge spine operand."""
    selected_examples: list[SelectedJobExample] = Field(description="Filtered past jobs")


class Wrap_selected_work_items(BaseModel):
    """Auto-derived merge spine operand."""
    selected_work_items: list[SelectedWorkItem] = Field(description="Filtered catalog rows")


# === pipeline state ===
PipelineState = TypedDict(
    "PipelineState",
    {
    "Work Description": Document,
    "Normalize Case": WorkDescription,
    "Job Example Library": JobExampleLibraryFile,
    "Combine Job Inputs": JobSelectBundle,
    "Parse Job Examples": list[JobExample],
    "Select Relevant Jobs": list[SelectedJobExample],
    "Merge for Item Filter": ItemFilterContext,
    "Work Item Catalog": WorkItemCatalogFile,
    "Combine Catalog": CatalogSelectBundle,
    "Parse Work Items": list[WorkItem],
    "Select Relevant Work Items": list[SelectedWorkItem],
    "Merge for Draft": BilledWorkDraftRequest,
    "Draft Billed Work": BilledWorkDraft,
    "Billed Work Output": BilledWorkDraft,
    },
)


# === runtime config (load .env in your runner — pass values here, not in this file) ===
@dataclass
class PipelineRuntime:
    llm_provider_id: str | None = None
    llm_provider_model: str | None = None
    open_router_api_key: str | None = None
    open_router_model: str | None = None
    open_router_site_url: str | None = None
    open_router_app_title: str | None = None
    vision_ocr_model: str | None = None
    # AI : TODO export — Supabase persistence (supabase_url, supabase_service_key).
    # AI : TODO export — step cache (enable_cache, cache_url / PIPELINE_CACHE_URL).

runtime = PipelineRuntime()

def configure_pipeline_runtime(**kwargs: Any) -> None:
    global runtime
    for k, v in kwargs.items():
        if hasattr(runtime, k):
            setattr(runtime, k, v)

# --- runtime stubs (replace bodies or inject via configure_pipeline_runtime) ---

# === LLM providers — OpenRouter default; register_custom_llm_provider for enterprise ===

from dataclasses import dataclass
from typing import Any, Callable, Protocol

LlmProviderId = str
ProviderModelId = str

@dataclass(frozen=True)
class LlmProviderCapabilities:
    batch: bool = True
    streaming: bool = True
    vision: bool = True

class LlmProvider(Protocol):
    id: LlmProviderId
    capabilities: LlmProviderCapabilities
    async def chat(self, prompt: str, provider_model: ProviderModelId, json_mode: bool) -> str: ...
    async def chat_batch(self, prompts: list[str], provider_model: ProviderModelId, json_mode: bool) -> list[str]: ...

MODEL_CATALOG: list[dict[str, str]] = [
    {"id": "qwen-2.5-72b", "label": "Qwen 2.5 72B", "provider_id": "openrouter", "provider_model": "qwen/qwen-2.5-72b-instruct"},
    {"id": "deepseek-v4", "label": "DeepSeek V4", "provider_id": "openrouter", "provider_model": "deepseek/deepseek-chat"},
    {"id": "glm-5.2", "label": "GLM 5.2", "provider_id": "openrouter", "provider_model": "z-ai/glm-5.2"},
    {"id": "gpt-5-mini", "label": "GPT-5 mini", "provider_id": "openrouter", "provider_model": "openai/gpt-4o-mini"},
    {"id": "claude-opus-4.6", "label": "Claude Opus 4.6", "provider_id": "openrouter", "provider_model": "anthropic/claude-opus-4.1"},
    {"id": "sonnet-4.7", "label": "Claude Sonnet 4.7", "provider_id": "openrouter", "provider_model": "anthropic/claude-sonnet-4.5"},
    {"id": "gemini-3-flash", "label": "Gemini 3 Flash", "provider_id": "openrouter", "provider_model": "google/gemini-3-flash-preview"},
]

DEFAULT_LLM_PROVIDER_ID: LlmProviderId = "openrouter"
DEFAULT_PROVIDER_MODEL: ProviderModelId = "deepseek/deepseek-chat"

_custom_providers: dict[LlmProviderId, LlmProvider] = {}

def register_custom_llm_provider(provider: LlmProvider) -> None:
    _custom_providers[provider.id] = provider

def _resolve_active_provider_id() -> LlmProviderId:
    return runtime.llm_provider_id or DEFAULT_LLM_PROVIDER_ID

def _resolve_provider_model() -> ProviderModelId:
    return runtime.llm_provider_model or runtime.open_router_model or DEFAULT_PROVIDER_MODEL

import re
import httpx

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

def _extract_json_reply(raw: str) -> str:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.I)
    body = (m.group(1) if m else raw).strip()
    starts = [body.find("{"), body.find("[")]
    start = min(x for x in starts if x >= 0) if any(x >= 0 for x in starts) else -1
    end = max(body.rfind("}"), body.rfind("]"))
    return body[start : end + 1] if start != -1 and end > start else body

async def _open_router_chat(prompt: str, provider_model: ProviderModelId, json_mode: bool) -> str:
    if not runtime.open_router_api_key:
        raise RuntimeError("configure_pipeline_runtime(open_router_api_key=...) or register a custom provider")
    headers = {
        "Authorization": f"Bearer {runtime.open_router_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": runtime.open_router_site_url or "http://localhost:3000",
        "X-Title": runtime.open_router_app_title or "forge-pipeline-export",
    }
    payload: dict[str, object] = {
        "model": provider_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 8192,
        "provider": {"allow_fallbacks": False},
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(OPENROUTER_CHAT_URL, headers=headers, json=payload)
    if res.status_code != 200:
        raise RuntimeError(f"OpenRouter {res.status_code}: {res.text}")
    data: Any = res.json()
    choices: Any = data.get("choices") if isinstance(data, dict) else None
    first: Any = choices[0] if isinstance(choices, list) and choices else {}
    message: Any = first.get("message", {}) if isinstance(first, dict) else {}
    content: Any = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content:
        raise RuntimeError("OpenRouter returned no message content")
    return content

@dataclass
class _OpenRouterProvider:
    id: LlmProviderId = "openrouter"
    capabilities: LlmProviderCapabilities = LlmProviderCapabilities()

    async def chat(self, prompt: str, provider_model: ProviderModelId, json_mode: bool) -> str:
        return await _open_router_chat(prompt, provider_model, json_mode)

    async def chat_batch(self, prompts: list[str], provider_model: ProviderModelId, json_mode: bool) -> list[str]:
        return [await self.chat(p, provider_model, json_mode) for p in prompts]

_open_router_provider = _OpenRouterProvider()

def get_llm_provider(provider_id: LlmProviderId | None = None) -> LlmProvider:
    resolved = provider_id or _resolve_active_provider_id()
    if resolved == "openrouter":
        return _open_router_provider
    custom = _custom_providers.get(resolved)
    if custom:
        return custom
    raise RuntimeError(f"Unknown LLM provider: {resolved}")

async def _llm_chat(prompt: str, json_mode: bool) -> str:
    provider = get_llm_provider()
    return await provider.chat(prompt, _resolve_provider_model(), json_mode)

async def llm_structured(prompt: str, schema: Any) -> Any:
    schema_json = json.dumps(schema or {}, indent=2)
    base = f"{prompt}\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n{schema_json}"
    last_error = ""
    for attempt in range(2):
        ask = base if attempt == 0 else f"{base}\n\nYour previous reply failed validation:\n{last_error}\nReturn corrected JSON only."
        raw = await _llm_chat(ask, True)
        json_text = _extract_json_reply(raw)
        try:
            return json.loads(json_text)
        except json.JSONDecodeError as e:
            last_error = str(e)
            if attempt == 1:
                raise RuntimeError(f"structured response parse failed after retry: {last_error}") from e
    raise RuntimeError("structured response failed")

async def llm_batch_structured(
    items: list[Any],
    prompt_for: Callable[[Any], str],
    schema: Any,
) -> list[Any]:
    provider = get_llm_provider()
    provider_model = _resolve_provider_model()
    schema_json = json.dumps(schema or {}, indent=2)
    suffix = f"\n\nRespond with ONLY a JSON value that validates against this JSON Schema:\n{schema_json}"
    prompts = [f"{prompt_for(item)}{suffix}" for item in items]
    if provider.capabilities.batch:
        raws = await provider.chat_batch(prompts, provider_model, True)
    else:
        raws = [await provider.chat(p, provider_model, True) for p in prompts]
    return [json.loads(_extract_json_reply(raw)) for raw in raws]

# === steps ===
async def step_Work_Description(input: Document, _state: PipelineState) -> Document:
    """Work Description · Kind: Input · New claim narrative — feeds {description} via Normalize Case · Cached: true"""
    # Parse uploaded file — built-in parser or vision OCR when enabled
    # Input guard: "Plain-text description of the new repair claim"
    # Filename must contain: "work_description"
    doc = input
    content = doc.content
    return Document(content=content, filename=doc.filename)


async def step_Normalize_Case(input: Document, _state: PipelineState) -> WorkDescription:
    """Normalize Case · Kind: Custom Code · Document → WorkDescription — deterministic wrapper for example-select context. · Cached: true"""
    # TypeScript custom code (1 attempt)
    # (doc) => ({ description: String(doc?.content ?? "").trim() })
    return cast(WorkDescription, cast(object, input))


async def step_Job_Example_Library(input: Document, _state: PipelineState) -> JobExampleLibraryFile:
    """Job Example Library · Kind: Input · Past jobs with billed_items references — side input before combine · Cached: true"""
    # Parse uploaded file — built-in parser or vision OCR when enabled
    # Input guard: "JSON file with examples array of structured past jobs"
    # Filename must contain: "job_example_library"
    doc = input
    content = doc.content
    return cast(JobExampleLibraryFile, cast(object, json.loads(content)))


async def step_Combine_Job_Inputs(input: JobExampleLibraryFile, state: PipelineState) -> JobSelectBundle:
    """Combine Job Inputs · Kind: Combine Inputs · Merges WorkDescription with Job Example Library side input. · Cached: true"""
    # Merge uploaded document with upstream WorkDescription from pipeline state
    new_doc = input
    return cast(JobSelectBundle, cast(object, {"case": state["Normalize Case"], "library": new_doc}))


async def step_Parse_Job_Examples(input: JobSelectBundle, _state: PipelineState) -> list[JobExample]:
    """Parse Job Examples · Kind: Custom Code · JobSelectBundle → list[JobExample]. · Cached: true"""
    # TypeScript custom code (1 attempt)
    # (bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error("expected examples array"); return rows; }
    return cast(list[JobExample], cast(object, input))


async def step_Select_Relevant_Jobs(input: list[JobExample], state: PipelineState) -> list[SelectedJobExample]:
    """Select Relevant Jobs · Kind: Example Select · Pass 1 — filter past jobs by similarity to the claim description. · Model: openrouter:deepseek-v4 · Cached: true"""
    # Per-item relevance filter — SelectedJobExample with selection_reason
    description = json.dumps(state["Normalize Case"], indent=2, default=str)
    items = input
    template = "Find past repair jobs that are useful references for scoping this new insurance claim.\n\nWORK DESCRIPTION:\n\n{description}\n\nCANDIDATE PAST JOB:\n\n{example}"
    def prompt_for(item: Any) -> str:
        return template.replace("{description}", description).replace("{example}", json.dumps(item, default=str))
    relevance_schema = {"chain_of_thought": "string", "is_relevant": "boolean"}
    verdicts = await llm_batch_structured(items, prompt_for, relevance_schema)
    selected = []
    for i, item in enumerate(items):
        verdict = verdicts[i] if i < len(verdicts) else {}
        if isinstance(verdict, dict) and verdict.get("is_relevant"):
            row = dict(item) if isinstance(item, dict) else (item.model_dump() if hasattr(item, "model_dump") else {"value": item})
            row["selection_reason"] = verdict.get("chain_of_thought") or ""
            selected.append(row)
    return cast(list[SelectedJobExample], cast(object, selected))


async def step_Merge_for_Item_Filter(input: list[SelectedJobExample], _state: PipelineState) -> ItemFilterContext:
    """Merge for Item Filter · Kind: Merge · Deep-merge Normalize Case with selected_examples → ItemFilterContext (cached prefix for pass 2). · Cached: true"""
    # TypeScript custom code (1 attempt)
    # function __itemKeyFn(keyPath) {
    #   const parts = String(keyPath).split(".").filter(Boolean);
    #   return (item) => {
    #     let cur = item;
    #     for (const part of parts) {
    #       if (!cur || typeof cur !== "object" || !(part in cur)) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    #       cur = cur[part];
    #     }
    #     if (cur == null) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    #     return cur;
    #   };
    # }
    # function __cmpKey(item, keyFn) {
    #   if (keyFn) return keyFn(item);
    #   if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
    #   return JSON.stringify(item);
    # }
    # function __pathForItem(path, ck, index) {
    #   if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
    #   return [...path, index];
    # }
    # function __zipMerge(left, right, resolver, path) {
    #   const n = Math.max(left.length, right.length), out = [];
    #   for (let i = 0; i < n; i++) {
    #     const child = [...path, i];
    #     if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));
    #     else out.push(i < left.length ? left[i] : right[i]);
    #   }
    #   return out;
    # }
    # function __dedupeMerge(items, keyFn, resolver, path) {
    #   const seen = new Map(), out = [];
    #   for (const item of items) {
    #     const k = __cmpKey(item, keyFn);
    #     if (seen.has(k)) {
    #       const idx = seen.get(k);
    #       out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));
    #       continue;
    #     }
    #     seen.set(k, out.length);
    #     out.push(item);
    #   }
    #   return out;
    # }
    # function __assertNoDupes(items, keyFn, path) {
    #   const seen = new Set(), out = [];
    #   const label = path.length ? path.join(".") : "<root>";
    #   for (const item of items) {
    #     const k = __cmpKey(item, keyFn);
    #     if (seen.has(k)) throw new TypeError("duplicate list item at path " + label + " (key=" + String(k) + ")");
    #     seen.add(k);
    #     out.push(item);
    #   }
    #   return out;
    # }
    # function __setOp(left, right, keyFn, resolver, path, op) {
    #   const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
    #   const ls = new Set(lk), rs = new Set(rk);
    #   const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
    #   const order = [];
    #   const seen = new Set();
    #   for (const k of [...lk, ...rk]) {
    #     if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
    #   }
    #   const map = new Map(), idx = new Map();
    #   left.forEach((item, i) => {
    #     const k = lk[i];
    #     if (!map.has(k)) { map.set(k, item); idx.set(k, i); }
    #     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    #   });
    #   right.forEach((item, i) => {
    #     const k = rk[i];
    #     if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }
    #     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    #   });
    #   return order.map((k) => map.get(k));
    # }
    # function __assertUnionNoOverlap(left, right, keyFn, path) {
    #   const lk = left.map((i) => __cmpKey(i, keyFn));
    #   const ls = new Set(lk);
    #   const label = path.length ? path.join(".") : "<root>";
    #   for (const item of right) {
    #     const k = __cmpKey(item, keyFn);
    #     if (ls.has(k)) throw new TypeError("union key overlap at path " + label + " (key=" + String(k) + ")");
    #   }
    #   return [...left, ...right];
    # }
    # function __assertIntersectSubset(left, right, keyFn, path) {
    #   const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));
    #   const label = path.length ? path.join(".") : "<root>";
    #   for (const item of left) {
    #     const k = __cmpKey(item, keyFn);
    #     if (!rs.has(k)) throw new TypeError("intersect: left item not in right at path " + label + " (key=" + String(k) + ")");
    #   }
    #   return left;
    # }
    # function __assertReplaceEmptyLeft(left, right, path) {
    #   const label = path.length ? path.join(".") : "<root>";
    #   if (left.length) throw new TypeError("replace assert: left list must be empty at path " + label + " (got " + left.length + " items)");
    #   return [...right];
    # }
    # function __assertPrependEmptyRight(left, right, path) {
    #   const label = path.length ? path.join(".") : "<root>";
    #   if (right.length) throw new TypeError("prepend assert: right list must be empty at path " + label + " (got " + right.length + " items)");
    #   return [...left];
    # }
    # function __suffixMatch(pattern, path) {
    #   if (pattern.length !== path.length) return false;
    #   for (let i = 0; i < pattern.length; i++) {
    #     if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
    #   }
    #   return true;
    # }
    # function __globstarFrom(pattern, path, pi, si) {
    #   if (pi === pattern.length) return si === path.length ? path.length : null;
    #   if (pattern[pi] === "**") {
    #     let best = null;
    #     for (let span = si; span <= path.length; span++) {
    #       const d = __globstarFrom(pattern, path, pi + 1, span);
    #       if (d != null && (best == null || d > best)) best = d;
    #     }
    #     return best;
    #   }
    #   if (si >= path.length) return null;
    #   if (pattern[pi] !== "*" && String(pattern[pi]) !== String(path[si])) return null;
    #   return __globstarFrom(pattern, path, pi + 1, si + 1);
    # }
    # function __patternDepth(pattern, path) {
    #   const parts = pattern.split(".").filter(Boolean);
    #   if (!parts.length) return path.length ? null : 0;
    #   if (parts.includes("**")) return __globstarFrom(parts, path, 0, 0);
    #   if (parts.length > path.length) return null;
    #   const offset = path.length - parts.length;
    #   return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
    # }
    # const __mergePair = function(left, right, resolver, path) {
    #   if (left == null) return right;
    #   if (right == null) return left;
    #   const layer = resolver.resolve(path);
    #   const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    #   const isScalar = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    #   if (isObj(left) && isObj(right)) {
    #     if (layer.dict === "replace") return { ...right };
    #     if (layer.dict === "shallow") return { ...left, ...right };
    #     const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    #     const out = {};
    #     for (const key of keys) {
    #       const child = [...path, key];
    #       if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);
    #       else out[key] = key in left ? left[key] : right[key];
    #     }
    #     return out;
    #   }
    #   if (Array.isArray(left) && Array.isArray(right)) {
    #     const s = layer.list;
    #     if (s === "replace") return [...right];
    #     if (s === "prepend") return [...right, ...left];
    #     if (s === "concat") return [...left, ...right];
    #     if (s === "zip") return __zipMerge(left, right, resolver, path);
    #     if (s === "concat_dedupe") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);
    #     if (s === "concat_assert_no_duplicates") return __assertNoDupes([...left, ...right], layer.keyFn, path);
    #     if (s === "union") return __setOp(left, right, layer.keyFn, resolver, path, "union");
    #     if (s === "union_assert") return __assertUnionNoOverlap(left, right, layer.keyFn, path);
    #     if (s === "intersect") return __setOp(left, right, layer.keyFn, resolver, path, "intersect");
    #     if (s === "intersect_assert") return __assertIntersectSubset(left, right, layer.keyFn, path);
    #     if (s === "replace_assert") return __assertReplaceEmptyLeft(left, right, path);
    #     if (s === "prepend_assert") return __assertPrependEmptyRight(left, right, path);
    #     throw new Error("unknown list strategy: " + s);
    #   }
    #   if (isScalar(left) && isScalar(right)) {
    #     if (layer.scalar === "first") return left;
    #     if (layer.scalar === "last") return right;
    #     throw new TypeError("scalar conflict");
    #   }
    #   if (typeof left === typeof right) return layer.scalar === "first" ? left : right;
    #   throw new TypeError("cannot merge " + typeof left + " with " + typeof right);
    # };
    # const __resolve = class {
    #   constructor(policy) {
    #     const def = policy?.default ?? {};
    #     this.default = {
    #       list: def.list ?? "concat",
    #       dict: def.dict ?? "deep",
    #       scalar: def.scalar ?? "last",
    #       keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,
    #     };
    #     this.rules = (policy?.rules ?? []).map((r) => ({
    #       pattern: r.path,
    #       policy: {
    #         list: r.policy?.list ?? this.default.list,
    #         dict: r.policy?.dict ?? this.default.dict,
    #         scalar: r.policy?.scalar ?? this.default.scalar,
    #         keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,
    #       },
    #     }));
    #   }
    #   resolve(path) {
    #     let matched, depth = -1;
    #     for (const { pattern, policy } of this.rules) {
    #       const d = __patternDepth(pattern, path);
    #       if (d != null && d > depth) { matched = policy; depth = d; }
    #     }
    #     return matched ?? this.default;
    #   }
    # };
    # (input, state) => {
    #   let spine = input;
    #   if ("selected_examples" && Array.isArray(spine)) spine = { ["selected_examples"]: spine };
    #   const values = [];
    #   if ("Normalize Case") {
    #     const fromState = (state ?? {})["Normalize Case"];
    #     if (fromState != null) values.push(fromState);
    #   }
    #   if (spine != null) values.push(spine);
    #   const resolver = new __resolve({"default":{"list":"concat","dict":"deep","scalar":"last"}});
    #   if (!values.length) return null;
    #   if (values.length === 1) return values[0];
    #   let result = values[0];
    #   for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);
    #   return result;
    # }
    return cast(ItemFilterContext, cast(object, input))


async def step_Work_Item_Catalog(input: Document, _state: PipelineState) -> WorkItemCatalogFile:
    """Work Item Catalog · Kind: Input · 100-item catalog for pass 2 — too large for one prompt; filtered per row with cached prefix · Cached: true"""
    # Parse uploaded file — built-in parser or vision OCR when enabled
    # Input guard: "JSON file with items array — master catalog of billable work items"
    # Filename must contain: "work_item_catalog"
    doc = input
    content = doc.content
    return cast(WorkItemCatalogFile, cast(object, json.loads(content)))


async def step_Combine_Catalog(input: WorkItemCatalogFile, state: PipelineState) -> CatalogSelectBundle:
    """Combine Catalog · Kind: Combine Inputs · Merges ItemFilterContext with Work Item Catalog side input. · Cached: true"""
    # Merge uploaded document with upstream ItemFilterContext from pipeline state
    new_doc = input
    return cast(CatalogSelectBundle, cast(object, {"draft_context": state["Merge for Item Filter"], "catalog": new_doc}))


async def step_Parse_Work_Items(input: CatalogSelectBundle, _state: PipelineState) -> list[WorkItem]:
    """Parse Work Items · Kind: Custom Code · CatalogSelectBundle → list[WorkItem]. · Cached: true"""
    # TypeScript custom code (1 attempt)
    # (bundle) => { const rows = bundle?.catalog?.items; if (!Array.isArray(rows)) throw new Error("expected items array"); return rows; }
    return cast(list[WorkItem], cast(object, input))


async def step_Select_Relevant_Work_Items(input: list[WorkItem], state: PipelineState) -> list[SelectedWorkItem]:
    """Select Relevant Work Items · Kind: Example Select · Pass 2 — filter catalog rows; context is full ItemFilterContext JSON (description + selected jobs). · Model: openrouter:deepseek-v4 · Cached: true"""
    # Per-item relevance filter — SelectedWorkItem with selection_reason
    description = json.dumps(state["Merge for Item Filter"], indent=2, default=str)
    items = input
    template = "You are filtering a master construction work-item catalog for an insurance repair claim.\n\nThe CASE and RELEVANT PAST JOBS (with billed_items) are below. Decide whether the CANDIDATE WORK ITEM could be required for this claim.\n\nCASE AND PAST JOBS:\n\n{description}\n\nCANDIDATE WORK ITEM:\n\n{example}"
    def prompt_for(item: Any) -> str:
        return template.replace("{description}", description).replace("{example}", json.dumps(item, default=str))
    relevance_schema = {"chain_of_thought": "string", "is_relevant": "boolean"}
    verdicts = await llm_batch_structured(items, prompt_for, relevance_schema)
    selected = []
    for i, item in enumerate(items):
        verdict = verdicts[i] if i < len(verdicts) else {}
        if isinstance(verdict, dict) and verdict.get("is_relevant"):
            row = dict(item) if isinstance(item, dict) else (item.model_dump() if hasattr(item, "model_dump") else {"value": item})
            row["selection_reason"] = verdict.get("chain_of_thought") or ""
            selected.append(row)
    return cast(list[SelectedWorkItem], cast(object, selected))


async def step_Merge_for_Draft(input: list[SelectedWorkItem], _state: PipelineState) -> BilledWorkDraftRequest:
    """Merge for Draft · Kind: Merge · Deep-merge ItemFilterContext with selected_work_items → BilledWorkDraftRequest. · Cached: true"""
    # TypeScript custom code (1 attempt)
    # function __itemKeyFn(keyPath) {
    #   const parts = String(keyPath).split(".").filter(Boolean);
    #   return (item) => {
    #     let cur = item;
    #     for (const part of parts) {
    #       if (!cur || typeof cur !== "object" || !(part in cur)) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    #       cur = cur[part];
    #     }
    #     if (cur == null) throw new TypeError("itemKey \"" + keyPath + "\" missing");
    #     return cur;
    #   };
    # }
    # function __cmpKey(item, keyFn) {
    #   if (keyFn) return keyFn(item);
    #   if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
    #   return JSON.stringify(item);
    # }
    # function __pathForItem(path, ck, index) {
    #   if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
    #   return [...path, index];
    # }
    # function __zipMerge(left, right, resolver, path) {
    #   const n = Math.max(left.length, right.length), out = [];
    #   for (let i = 0; i < n; i++) {
    #     const child = [...path, i];
    #     if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));
    #     else out.push(i < left.length ? left[i] : right[i]);
    #   }
    #   return out;
    # }
    # function __dedupeMerge(items, keyFn, resolver, path) {
    #   const seen = new Map(), out = [];
    #   for (const item of items) {
    #     const k = __cmpKey(item, keyFn);
    #     if (seen.has(k)) {
    #       const idx = seen.get(k);
    #       out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));
    #       continue;
    #     }
    #     seen.set(k, out.length);
    #     out.push(item);
    #   }
    #   return out;
    # }
    # function __assertNoDupes(items, keyFn, path) {
    #   const seen = new Set(), out = [];
    #   const label = path.length ? path.join(".") : "<root>";
    #   for (const item of items) {
    #     const k = __cmpKey(item, keyFn);
    #     if (seen.has(k)) throw new TypeError("duplicate list item at path " + label + " (key=" + String(k) + ")");
    #     seen.add(k);
    #     out.push(item);
    #   }
    #   return out;
    # }
    # function __setOp(left, right, keyFn, resolver, path, op) {
    #   const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
    #   const ls = new Set(lk), rs = new Set(rk);
    #   const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
    #   const order = [];
    #   const seen = new Set();
    #   for (const k of [...lk, ...rk]) {
    #     if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
    #   }
    #   const map = new Map(), idx = new Map();
    #   left.forEach((item, i) => {
    #     const k = lk[i];
    #     if (!map.has(k)) { map.set(k, item); idx.set(k, i); }
    #     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    #   });
    #   right.forEach((item, i) => {
    #     const k = rk[i];
    #     if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }
    #     else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
    #   });
    #   return order.map((k) => map.get(k));
    # }
    # function __assertUnionNoOverlap(left, right, keyFn, path) {
    #   const lk = left.map((i) => __cmpKey(i, keyFn));
    #   const ls = new Set(lk);
    #   const label = path.length ? path.join(".") : "<root>";
    #   for (const item of right) {
    #     const k = __cmpKey(item, keyFn);
    #     if (ls.has(k)) throw new TypeError("union key overlap at path " + label + " (key=" + String(k) + ")");
    #   }
    #   return [...left, ...right];
    # }
    # function __assertIntersectSubset(left, right, keyFn, path) {
    #   const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));
    #   const label = path.length ? path.join(".") : "<root>";
    #   for (const item of left) {
    #     const k = __cmpKey(item, keyFn);
    #     if (!rs.has(k)) throw new TypeError("intersect: left item not in right at path " + label + " (key=" + String(k) + ")");
    #   }
    #   return left;
    # }
    # function __assertReplaceEmptyLeft(left, right, path) {
    #   const label = path.length ? path.join(".") : "<root>";
    #   if (left.length) throw new TypeError("replace assert: left list must be empty at path " + label + " (got " + left.length + " items)");
    #   return [...right];
    # }
    # function __assertPrependEmptyRight(left, right, path) {
    #   const label = path.length ? path.join(".") : "<root>";
    #   if (right.length) throw new TypeError("prepend assert: right list must be empty at path " + label + " (got " + right.length + " items)");
    #   return [...left];
    # }
    # function __suffixMatch(pattern, path) {
    #   if (pattern.length !== path.length) return false;
    #   for (let i = 0; i < pattern.length; i++) {
    #     if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
    #   }
    #   return true;
    # }
    # function __globstarFrom(pattern, path, pi, si) {
    #   if (pi === pattern.length) return si === path.length ? path.length : null;
    #   if (pattern[pi] === "**") {
    #     let best = null;
    #     for (let span = si; span <= path.length; span++) {
    #       const d = __globstarFrom(pattern, path, pi + 1, span);
    #       if (d != null && (best == null || d > best)) best = d;
    #     }
    #     return best;
    #   }
    #   if (si >= path.length) return null;
    #   if (pattern[pi] !== "*" && String(pattern[pi]) !== String(path[si])) return null;
    #   return __globstarFrom(pattern, path, pi + 1, si + 1);
    # }
    # function __patternDepth(pattern, path) {
    #   const parts = pattern.split(".").filter(Boolean);
    #   if (!parts.length) return path.length ? null : 0;
    #   if (parts.includes("**")) return __globstarFrom(parts, path, 0, 0);
    #   if (parts.length > path.length) return null;
    #   const offset = path.length - parts.length;
    #   return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
    # }
    # const __mergePair = function(left, right, resolver, path) {
    #   if (left == null) return right;
    #   if (right == null) return left;
    #   const layer = resolver.resolve(path);
    #   const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    #   const isScalar = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    #   if (isObj(left) && isObj(right)) {
    #     if (layer.dict === "replace") return { ...right };
    #     if (layer.dict === "shallow") return { ...left, ...right };
    #     const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    #     const out = {};
    #     for (const key of keys) {
    #       const child = [...path, key];
    #       if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);
    #       else out[key] = key in left ? left[key] : right[key];
    #     }
    #     return out;
    #   }
    #   if (Array.isArray(left) && Array.isArray(right)) {
    #     const s = layer.list;
    #     if (s === "replace") return [...right];
    #     if (s === "prepend") return [...right, ...left];
    #     if (s === "concat") return [...left, ...right];
    #     if (s === "zip") return __zipMerge(left, right, resolver, path);
    #     if (s === "concat_dedupe") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);
    #     if (s === "concat_assert_no_duplicates") return __assertNoDupes([...left, ...right], layer.keyFn, path);
    #     if (s === "union") return __setOp(left, right, layer.keyFn, resolver, path, "union");
    #     if (s === "union_assert") return __assertUnionNoOverlap(left, right, layer.keyFn, path);
    #     if (s === "intersect") return __setOp(left, right, layer.keyFn, resolver, path, "intersect");
    #     if (s === "intersect_assert") return __assertIntersectSubset(left, right, layer.keyFn, path);
    #     if (s === "replace_assert") return __assertReplaceEmptyLeft(left, right, path);
    #     if (s === "prepend_assert") return __assertPrependEmptyRight(left, right, path);
    #     throw new Error("unknown list strategy: " + s);
    #   }
    #   if (isScalar(left) && isScalar(right)) {
    #     if (layer.scalar === "first") return left;
    #     if (layer.scalar === "last") return right;
    #     throw new TypeError("scalar conflict");
    #   }
    #   if (typeof left === typeof right) return layer.scalar === "first" ? left : right;
    #   throw new TypeError("cannot merge " + typeof left + " with " + typeof right);
    # };
    # const __resolve = class {
    #   constructor(policy) {
    #     const def = policy?.default ?? {};
    #     this.default = {
    #       list: def.list ?? "concat",
    #       dict: def.dict ?? "deep",
    #       scalar: def.scalar ?? "last",
    #       keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,
    #     };
    #     this.rules = (policy?.rules ?? []).map((r) => ({
    #       pattern: r.path,
    #       policy: {
    #         list: r.policy?.list ?? this.default.list,
    #         dict: r.policy?.dict ?? this.default.dict,
    #         scalar: r.policy?.scalar ?? this.default.scalar,
    #         keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,
    #       },
    #     }));
    #   }
    #   resolve(path) {
    #     let matched, depth = -1;
    #     for (const { pattern, policy } of this.rules) {
    #       const d = __patternDepth(pattern, path);
    #       if (d != null && d > depth) { matched = policy; depth = d; }
    #     }
    #     return matched ?? this.default;
    #   }
    # };
    # (input, state) => {
    #   let spine = input;
    #   if ("selected_work_items" && Array.isArray(spine)) spine = { ["selected_work_items"]: spine };
    #   const values = [];
    #   if ("Merge for Item Filter") {
    #     const fromState = (state ?? {})["Merge for Item Filter"];
    #     if (fromState != null) values.push(fromState);
    #   }
    #   if (spine != null) values.push(spine);
    #   const resolver = new __resolve({"default":{"list":"concat","dict":"deep","scalar":"last"}});
    #   if (!values.length) return null;
    #   if (values.length === 1) return values[0];
    #   let result = values[0];
    #   for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);
    #   return result;
    # }
    return cast(BilledWorkDraftRequest, cast(object, input))


async def step_Draft_Billed_Work(input: BilledWorkDraftRequest, _state: PipelineState) -> BilledWorkDraft:
    """Draft Billed Work · Kind: LLM Call · Final structured scope using selected jobs, catalog items, and selection_reason fields. · Model: openrouter:deepseek-v4 · Cached: true"""
    # Structured LLM call → BilledWorkDraft
    _model = "openrouter:deepseek-v4"
    user_prompt = "Draft structured billed work for the claim. Use selected_examples for coverage patterns and selected_work_items as the allowed catalog pool — each row includes selection_reason. Pick quantities from past jobs where sensible. Output title and line_items with work_item_id, quantity, and rationale." + "\n\nINPUT DATA:\n" + json.dumps(input, indent=2, default=str)
    schema = None  # JSON schema for BilledWorkDraft
    return cast(BilledWorkDraft, cast(object, await llm_structured(user_prompt, schema)))


async def step_Billed_Work_Output(input: BilledWorkDraft, _state: PipelineState) -> BilledWorkDraft:
    """Billed Work Output · Kind: Output · Cached: true"""
    # Snapshot BilledWorkDraft
    return input


# === orchestrator ===
async def run_pipeline(inputs: dict[str, Document]) -> Any:
    state = cast(PipelineState, cast(object, {}))
    spine: Any = None

    # 1. Work Description
    spine = await step_Work_Description(inputs["Work Description"], state)
    state["Work Description"] = spine

    # 2. Normalize Case
    spine = await step_Normalize_Case(spine, state)
    state["Normalize Case"] = spine

    # 3. Job Example Library
    spine = await step_Job_Example_Library(inputs["Job Example Library"], state)
    state["Job Example Library"] = spine

    # 4. Combine Job Inputs
    spine = await step_Combine_Job_Inputs(spine, state)
    state["Combine Job Inputs"] = spine

    # 5. Parse Job Examples
    spine = await step_Parse_Job_Examples(spine, state)
    state["Parse Job Examples"] = spine

    # 6. Select Relevant Jobs
    spine = await step_Select_Relevant_Jobs(spine, state)
    state["Select Relevant Jobs"] = spine

    # 7. Merge for Item Filter
    spine = await step_Merge_for_Item_Filter(spine, state)
    state["Merge for Item Filter"] = spine

    # 8. Work Item Catalog
    spine = await step_Work_Item_Catalog(inputs["Work Item Catalog"], state)
    state["Work Item Catalog"] = spine

    # 9. Combine Catalog
    spine = await step_Combine_Catalog(spine, state)
    state["Combine Catalog"] = spine

    # 10. Parse Work Items
    spine = await step_Parse_Work_Items(spine, state)
    state["Parse Work Items"] = spine

    # 11. Select Relevant Work Items
    spine = await step_Select_Relevant_Work_Items(spine, state)
    state["Select Relevant Work Items"] = spine

    # 12. Merge for Draft
    spine = await step_Merge_for_Draft(spine, state)
    state["Merge for Draft"] = spine

    # 13. Draft Billed Work
    spine = await step_Draft_Billed_Work(spine, state)
    state["Draft Billed Work"] = spine

    # 14. Billed Work Output
    spine = await step_Billed_Work_Output(spine, state)
    state["Billed Work Output"] = spine

    return spine

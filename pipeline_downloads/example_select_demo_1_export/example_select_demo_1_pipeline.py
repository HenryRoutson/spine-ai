"""Generated pipeline export — equivalent Python representation"""
# Project: Example Select Demo
# 13 steps · 9 structures · 458 lines
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

class ScopeDescription(BaseModel):
    """New damage case text — fills {description} in the example-select prompt."""
    description: str = Field(description="Plain-language damage description")


class ScopeExample(BaseModel):
    """One reference scope-of-works row from the example library."""
    id: str = Field(description="Stable example id")
    title: str = Field(description="Short label")
    scope_text: str = Field(description="Past scope of works body")


class SelectedExample(BaseModel):
    """Relevant example after example-select — includes selection_reason chain-of-thought."""
    id: str = Field(description="Matches library id")
    title: str = Field(description="Short label")
    scope_text: str = Field(description="Past scope body")
    selection_reason: str = Field(description="Why this example is useful for the current case")


class ScopeDraftRequest(BaseModel):
    """Merged description + filtered examples for the final LLM."""
    description: str = Field(description="Current damage case")
    selected_examples: list[SelectedExample] = Field(description="LLM-filtered reference rows")


class ExampleLibraryFile(BaseModel):
    """Parsed JSON upload — examples array for the library input step."""
    examples: list[ScopeExample] = Field(description="Reference scope rows")


class ScopeSelectBundle(BaseModel):
    """Damage case + example library merged by combine."""
    case: ScopeDescription = Field(description="ScopeDescription from Normalize Case (pipeline state)")
    library: ExampleLibraryFile = Field(description="Example library from the side input")


class ScopeDraft(BaseModel):
    """Draft scope of works for the new case."""
    title: str = Field(description="Short job title")
    scope_of_works: str = Field(description="Numbered scope lines")


# === pipeline state ===
PipelineState = TypedDict(
    "PipelineState",
    {
    "Damage Case": Document,
    "Normalize Case": ScopeDescription,
    "Example Library": ExampleLibraryFile,
    "Combine Inputs": ScopeSelectBundle,
    "Parse Examples": list[ScopeExample],
    "Select Relevant Examples": list[SelectedExample],
    "Merge for Draft": ScopeDraftRequest,
    "Draft Scope": ScopeDraft,
    "✓ Combine Inputs": ScopeDraft,
    "✓ Normalize Case": ScopeSelectBundle,
    "✓ Parse Examples": ScopeDescription,
    "✓ Select Relevant Examples": list[ScopeExample],
    "Scope Output": list[SelectedExample],
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
async def step_Damage_Case(input: Document, _state: PipelineState) -> Document:
    """Damage Case · Kind: Input · New leak description — feeds {description} via Normalize Case · Cached: true"""
    # Parse uploaded file — built-in parser or vision OCR when enabled
    # Input guard: "Plain-text description of the new damage case"
    # Filename must contain: "damage_case"
    doc = input
    content = doc.content
    return Document(content=content, filename=doc.filename)


async def step_Normalize_Case(input: Document, _state: PipelineState) -> ScopeDescription:
    """Normalize Case · Kind: Custom Code · Document → ScopeDescription — deterministic wrapper for the example-select context label. · Cached: true"""
    # TypeScript custom code (1 attempt)
    # (doc) => ({ description: String(doc?.content ?? "").trim() })
    return cast(ScopeDescription, cast(object, input))


async def step_Example_Library(input: Document, _state: PipelineState) -> ExampleLibraryFile:
    """Example Library · Kind: Input · Reference example library — side input for combine (must follow Normalize Case on spine) · Cached: true"""
    # Parse uploaded file — built-in parser or vision OCR when enabled
    # Input guard: "JSON file with examples array of past scope-of-works rows"
    # Filename must contain: "example_library"
    doc = input
    content = doc.content
    return cast(ExampleLibraryFile, cast(object, json.loads(content)))


async def step_Combine_Inputs(input: ExampleLibraryFile, state: PipelineState) -> ScopeSelectBundle:
    """Combine Inputs · Kind: Combine Inputs · Merges ScopeDescription (pipeline state) with Example Library side input — required after input → code → input. · Cached: true"""
    # Merge uploaded document with upstream ScopeDescription from pipeline state
    new_doc = input
    return cast(ScopeSelectBundle, cast(object, {"case": state["Normalize Case"], "library": new_doc}))


async def step_Parse_Examples(input: ScopeSelectBundle, _state: PipelineState) -> list[ScopeExample]:
    """Parse Examples · Kind: Custom Code · ScopeSelectBundle → list[ScopeExample] — examples from the merged library field. · Cached: true"""
    # TypeScript custom code (1 attempt)
    # (bundle) => { const rows = bundle?.library?.examples; if (!Array.isArray(rows)) throw new Error("expected examples array"); return rows; }
    return cast(list[ScopeExample], cast(object, input))


async def step_Select_Relevant_Examples(input: list[ScopeExample], state: PipelineState) -> list[SelectedExample]:
    """Select Relevant Examples · Kind: Example Select · LLM relevance filter — cached prefix + per-item is_relevant; not embedding RAG. · Model: deepseek-v4 · Cached: true"""
    # Per-item relevance filter — SelectedExample with selection_reason
    description = json.dumps(state["Normalize Case"], indent=2, default=str)
    items = input
    template = "Find useful examples to help create a scope of works for this description of the works.\n\nDESCRIPTION:\n\n{description}\n\nPOSSIBLE USEFUL EXAMPLE:\n\n{example}"
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
    return cast(list[SelectedExample], cast(object, selected))


async def step_Merge_for_Draft(input: SelectedExample, _state: PipelineState) -> ScopeDraftRequest:
    """Merge for Draft · Kind: Custom Code · list[SelectedExample] + description from Normalize Case on pipeline state → ScopeDraftRequest for the final LLM. · Cached: true"""
    # TypeScript custom code (1 attempt)
    # (selected, state) => { const norm = (state ?? {})["Normalize Case"]; const description = norm && typeof norm === "object" && norm !== null && typeof norm.description === "string" ? norm.description : ""; return { description, selected_examples: Array.isArray(selected) ? selected : [] }; }
    return cast(ScopeDraftRequest, cast(object, input))


async def step_Draft_Scope(input: ScopeDraftRequest, _state: PipelineState) -> ScopeDraft:
    """Draft Scope · Kind: LLM Call · Final scope using selected examples and their selection_reason fields. · Model: deepseek-v4 · Cached: true"""
    # Structured LLM call → ScopeDraft
    _model = "deepseek-v4"
    user_prompt = "Write a numbered scope of works for the damage description. Use selected_examples only as style and coverage guidance — each row includes selection_reason explaining why it was chosen. Do not copy irrelevant work from distractor examples. Output a concise title and scope_of_works." + "\n\nINPUT DATA:\n" + json.dumps(input, indent=2, default=str)
    schema = None  # JSON schema for ScopeDraft
    return cast(ScopeDraft, cast(object, await llm_structured(user_prompt, schema)))


async def step__Combine_Inputs(input: ScopeDraft, _state: PipelineState) -> ScopeDraft:
    """✓ Combine Inputs · Kind: Assert · Structural check — combine retained case description and library examples · Cached: true"""
    # TypeScript assert (not inlined):
    # const b = step("Combine Inputs");
    # if (!b?.case?.description || typeof b.case.description !== "string" || !b.case.description.trim()) throw new Error("combine missing case.description");
    # if (!Array.isArray(b?.library?.examples) || b.library.examples.length < 1) throw new Error("combine missing library.examples");
    return input


async def step__Normalize_Case(input: ScopeSelectBundle, _state: PipelineState) -> ScopeSelectBundle:
    """✓ Normalize Case · Kind: Assert · Golden fixture — damage text wrapped as ScopeDescription · Cached: true"""
    # TypeScript assert (not inlined):
    # assertEqual(step("Normalize Case"), "Normalize Case");
    return input


async def step__Parse_Examples(input: ScopeDescription, _state: PipelineState) -> ScopeDescription:
    """✓ Parse Examples · Kind: Assert · Golden fixture — four library rows parsed · Cached: true"""
    # TypeScript assert (not inlined):
    # assertEqual(step("Parse Examples"), "Parse Examples");
    return input


async def step__Select_Relevant_Examples(input: list[ScopeExample], _state: PipelineState) -> list[ScopeExample]:
    """✓ Select Relevant Examples · Kind: Assert · Structural check — selected ids must exist in Example Library / Combine Inputs / Parse Examples · Cached: true"""
    # TypeScript assert (not inlined):
    # const selected = Array.isArray(input) ? input : step("Select Relevant Examples");
    # if (!Array.isArray(selected) || selected.length < 1) throw new Error("expected at least one selected example");
    # const rows = [
    #   step("Example Library")?.examples,
    #   step("Combine Inputs")?.library?.examples,
    #   step("Parse Examples"),
    # ].flatMap((v) => (Array.isArray(v) ? v : []));
    # if (!rows.length) throw new Error("expected library examples from Example Library, Combine Inputs, or Parse Examples");
    # const ids = new Set(rows.map((e) => e?.id).filter(Boolean));
    # for (const row of selected) {
    #   if (typeof row?.selection_reason !== "string" || !row.selection_reason.trim()) throw new Error("missing selection_reason");
    #   if (!ids.has(row?.id)) throw new Error(`unknown example id ${row?.id} (library has: ${[...ids].sort().join(", ")})`);
    # }
    return input


async def step_Scope_Output(input: list[SelectedExample], _state: PipelineState) -> list[SelectedExample]:
    """Scope Output · Kind: Output · Cached: true"""
    # Snapshot ScopeDraft
    return input


# === orchestrator ===
async def run_pipeline(inputs: dict[str, Document]) -> Any:
    state = cast(PipelineState, cast(object, {}))
    spine: Any = None

    # 1. Damage Case
    spine = await step_Damage_Case(inputs["Damage Case"], state)
    state["Damage Case"] = spine

    # 2. Normalize Case
    spine = await step_Normalize_Case(spine, state)
    state["Normalize Case"] = spine

    # 3. Example Library
    spine = await step_Example_Library(inputs["Example Library"], state)
    state["Example Library"] = spine

    # 4. Combine Inputs
    spine = await step_Combine_Inputs(spine, state)
    state["Combine Inputs"] = spine

    # 5. Parse Examples
    spine = await step_Parse_Examples(spine, state)
    state["Parse Examples"] = spine

    # 6. Select Relevant Examples
    spine = await step_Select_Relevant_Examples(spine, state)
    state["Select Relevant Examples"] = spine

    # 7. Merge for Draft
    spine = await step_Merge_for_Draft(spine, state)
    state["Merge for Draft"] = spine

    # 8. Draft Scope
    spine = await step_Draft_Scope(spine, state)
    state["Draft Scope"] = spine

    # 9. ✓ Combine Inputs
    spine = await step__Combine_Inputs(spine, state)
    state["✓ Combine Inputs"] = spine

    # 10. ✓ Normalize Case
    spine = await step__Normalize_Case(spine, state)
    state["✓ Normalize Case"] = spine

    # 11. ✓ Parse Examples
    spine = await step__Parse_Examples(spine, state)
    state["✓ Parse Examples"] = spine

    # 12. ✓ Select Relevant Examples
    spine = await step__Select_Relevant_Examples(spine, state)
    state["✓ Select Relevant Examples"] = spine

    # 13. Scope Output
    spine = await step_Scope_Output(spine, state)
    state["Scope Output"] = spine

    return spine

# AI : export runtime library — copied into pipeline zips as pipeline_runtime.py (not generated).
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Protocol
import json
import re
import httpx

# === runtime config (load .env in your runner — pass values here, not in this file) ===
@dataclass
class PipelineRuntime:
    llm_provider_id: str | None = None
    llm_provider_model: str | None = None
    open_router_api_key: str | None = None
    open_router_model: str | None = None
    open_router_site_url: str | None = None
    open_router_app_title: str | None = None
    open_router_base_url: str | None = None
    open_router_seed: int | None = None
    vision_ocr_model: str | None = None
    source_text: str | None = None
    source_doc_id: str | None = None
    on_human_review: Callable[[Any], Any] | None = None
    on_chatbot: Callable[..., Any] | None = None
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
    {"id": "deepseek-v4-flash", "label": "DeepSeek V4 Flash", "provider_id": "openrouter", "provider_model": "deepseek/deepseek-v4-flash-0731"},
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

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

def _resolve_open_router_chat_url() -> str:
    base = (runtime.open_router_base_url or "").strip()
    if not base:
        return OPENROUTER_CHAT_URL
    if "/chat/completions" in base:
        return base
    return base.rstrip("/") + "/chat/completions"

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
        "provider": {"allow_fallbacks": runtime.open_router_seed is not None},
    }
    if runtime.open_router_seed is not None:
        payload["seed"] = int(runtime.open_router_seed)
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(_resolve_open_router_chat_url(), headers=headers, json=payload)
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

# AI : shared example-select verdict — reused by every example-select step
relevance_schema = {"chain_of_thought":"string","is_relevant":"boolean"}

DEFAULT_VISION_OCR_MODEL: ProviderModelId = "google/gemini-3-flash-preview"
OCR_SYSTEM = "You are an OCR engine. Transcribe documents faithfully. Preserve structure with markdown headings and lists where helpful. Output only the transcribed text — no commentary."
DEFAULT_OCR_PROMPT = "Transcribe every visible word, number, and label from this document into plain text. Preserve section headings and question numbering."

def _resolve_vision_ocr_model() -> ProviderModelId:
    return runtime.vision_ocr_model or runtime.llm_provider_model or runtime.open_router_model or DEFAULT_VISION_OCR_MODEL

async def _open_router_vision_chat(prompt: str, attachments: list[dict[str, str]], provider_model: ProviderModelId) -> str:
    if not runtime.open_router_api_key:
        raise RuntimeError("configure_pipeline_runtime(open_router_api_key=...) for vision OCR")
    content: list[dict[str, object]] = [{"type": "text", "text": prompt}]
    for a in attachments:
        content.append({"type": "image_url", "image_url": {"url": f"data:{a['mime']};base64,{a['base64']}"}})
    headers = {
        "Authorization": f"Bearer {runtime.open_router_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": runtime.open_router_site_url or "http://localhost:3000",
        "X-Title": runtime.open_router_app_title or "forge-pipeline-export",
    }
    payload: dict[str, object] = {
        "model": provider_model,
        "messages": [{"role": "system", "content": OCR_SYSTEM}, {"role": "user", "content": content}],
        "temperature": 0,
        "max_tokens": 16384,
        "provider": {"allow_fallbacks": False},
    }
    if runtime.open_router_seed is not None:
        payload["seed"] = int(runtime.open_router_seed)
    async with httpx.AsyncClient(timeout=180) as client:
        res = await client.post(_resolve_open_router_chat_url(), headers=headers, json=payload)
    if res.status_code != 200:
        raise RuntimeError(f"OpenRouter vision {res.status_code}: {res.text}")
    data: Any = res.json()
    choices: Any = data.get("choices") if isinstance(data, dict) else None
    first: Any = choices[0] if isinstance(choices, list) and choices else {}
    message: Any = first.get("message", {}) if isinstance(first, dict) else {}
    text: Any = message.get("content") if isinstance(message, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("vision OCR returned empty text")
    return text.strip()

async def vision_ocr(mime: str, base64: str, purpose: str = "general transcription") -> str:
    """Vision OCR via OpenRouter multimodal. Override vision_ocr_model for DeepSeek-OCR hosts."""
    prompt = f"{DEFAULT_OCR_PROMPT}\n\nDocument purpose: {purpose or 'general transcription'}"
    return await _open_router_vision_chat(prompt, [{"mime": mime, "base64": base64}], _resolve_vision_ocr_model())

def resolve_quotes(data: Any, source_text: str, doc_id: str) -> Any:
    text = runtime.source_text or source_text
    did = runtime.source_doc_id or doc_id
    if not text or not did:
        raise RuntimeError("configure_pipeline_runtime(source_text=..., source_doc_id=...) for quote steps")
    raise NotImplementedError("wire resolve_quotes to your quote linker")

async def wait_for_human_review(input: Any) -> None:
    if runtime.on_human_review:
        await runtime.on_human_review(input)
        return
    raise NotImplementedError("wire wait_for_human_review or configure_pipeline_runtime(on_human_review=...)")

async def wait_for_chatbot_session(input: Any, mode: str = 'until-exit') -> Any:
    if runtime.on_chatbot:
        return await runtime.on_chatbot(input, mode=mode)
    raise NotImplementedError("wire wait_for_chatbot_session or configure_pipeline_runtime(on_chatbot=...)")

async def call_webhook(
    input: Any,
    state: PipelineState,
    *,
    url_env: str,
    method: str = "POST",
    auth_env: str | None = None,
    include_state: bool = True,
    response_path: str | None = None,
    timeout_ms: int = 30_000,
) -> Any:
    import json
    import os
    import urllib.request
    url = (os.environ.get(url_env) or '').strip()
    if not url:
        raise RuntimeError(f'set {url_env} in .env')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if auth_env:
        auth = (os.environ.get(auth_env) or '').strip()
        if auth:
            headers['Authorization'] = auth if auth.startswith('Bearer ') else f'Bearer {auth}'
    body = {'input': input} if not include_state else {'input': input, 'state': state}
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(req, timeout=timeout_ms / 1000) as res:
        raw = json.loads(res.read().decode())
    if not response_path:
        return raw
    cur: Any = raw
    for key in response_path.split('.'):
        if not isinstance(cur, dict):
            raise RuntimeError(f'webhook response path failed at {key}')
        cur = cur[key]
    return cur
def merge_fold(values: list[Any], policy: Any) -> Any:
    if not values:
        return None
    result = values[0]
    for nxt in values[1:]:
        result = _merge_pair(result, nxt, policy)
    return result

def _merge_pair(left: Any, right: Any, policy: Any) -> Any:
    if left is None:
        return right
    if right is None:
        return left
    layer = (policy or {}).get("default") or {}
    dict_s = layer.get("dict") or "deep"
    list_s = layer.get("list") or "concat"
    scalar_s = layer.get("scalar") or "last"
    if isinstance(left, dict) and isinstance(right, dict):
        if dict_s == "replace":
            return dict(right)
        if dict_s == "shallow":
            return {**left, **right}
        out = dict(left)
        for k, v in right.items():
            out[k] = _merge_pair(out[k], v, policy) if k in out else v
        return out
    if isinstance(left, list) and isinstance(right, list):
        if list_s == "replace":
            return list(right)
        if list_s == "prepend":
            return list(right) + list(left)
        return list(left) + list(right)
    return left if scalar_s == "first" else right

async def select_relevant(items: list[Any], description: str, template: str) -> list[Any]:
    def prompt_for(item: Any) -> str:
        return template.replace("{description}", description).replace("{example}", json.dumps(item, default=str))
    verdicts = await llm_batch_structured(items, prompt_for, relevance_schema)
    kept: list[Any] = []
    for i, item in enumerate(items):
        verdict = verdicts[i] if i < len(verdicts) else {}
        if isinstance(verdict, dict) and verdict.get("is_relevant"):
            row = dict(item) if isinstance(item, dict) else {"value": item}
            row["selection_reason"] = verdict.get("chain_of_thought") or ""
            kept.append(row)
    return kept

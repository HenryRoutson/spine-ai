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
    docs_dir: str | None = None
    deepseek_ocr_base_url: str | None = None
    deepseek_ocr_model: str | None = None
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
DEFAULT_DEEPSEEK_OCR_MODEL = "deepseek-ai/DeepSeek-OCR-2"
OCR_SYSTEM = "You are an OCR engine. Transcribe documents faithfully. Preserve structure with markdown headings and lists where helpful. Output only the transcribed text — no commentary."
DEFAULT_OCR_PROMPT = "Transcribe every visible word, number, and label from this document into plain text. Preserve section headings and question numbering."
DEEPSEEK_OCR_PROMPT = "<image>\n<|grounding|>Convert the document to markdown."

_ocr_text_cache: dict[str, str] = {}

def _mime_from_filename(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return "application/pdf"
    if ext == "png":
        return "image/png"
    if ext in ("jpg", "jpeg"):
        return "image/jpeg"
    if ext == "webp":
        return "image/webp"
    return "application/octet-stream"

def _resolve_vision_ocr_model() -> ProviderModelId:
    return runtime.vision_ocr_model or runtime.llm_provider_model or runtime.open_router_model or DEFAULT_VISION_OCR_MODEL

async def _open_router_vision_chat(prompt: str, attachments: list[dict[str, str]], provider_model: ProviderModelId) -> str:
    if not runtime.open_router_api_key:
        raise RuntimeError("configure_pipeline_runtime(open_router_api_key=...) for vision OCR fallback")
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

async def deepseek_ocr(data: bytes, mime: str) -> str:
    """DeepSeek-OCR-2 via vLLM OpenAI-compatible /chat/completions. Bytes are not stored on Document."""
    import base64
    base = (runtime.deepseek_ocr_base_url or "").rstrip("/")
    if not base:
        raise RuntimeError("configure_pipeline_runtime(deepseek_ocr_base_url=...) for DeepSeek OCR")
    model = runtime.deepseek_ocr_model or DEFAULT_DEEPSEEK_OCR_MODEL
    b64 = base64.b64encode(data).decode("ascii")
    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                {"type": "text", "text": DEEPSEEK_OCR_PROMPT},
            ],
        }],
        "max_tokens": 8192,
        "temperature": 0,
        "extra_body": {
            "skip_special_tokens": False,
            "vllm_xargs": {"ngram_size": 30, "window_size": 90, "whitelist_token_ids": [128821, 128822]},
        },
    }
    async with httpx.AsyncClient(timeout=180) as client:
        res = await client.post(f"{base}/chat/completions", json=payload)
    if res.status_code != 200:
        raise RuntimeError(f"DeepSeek OCR {res.status_code}: {res.text}")
    data_json: Any = res.json()
    choices: Any = data_json.get("choices") if isinstance(data_json, dict) else None
    first: Any = choices[0] if isinstance(choices, list) and choices else {}
    message: Any = first.get("message", {}) if isinstance(first, dict) else {}
    text: Any = message.get("content") if isinstance(message, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("DeepSeek OCR returned empty text")
    return text.strip()

async def _ocr_bytes(data: bytes, mime: str, purpose: str) -> str:
    key = f"{runtime.deepseek_ocr_base_url or 'or'}:{runtime.deepseek_ocr_model or runtime.vision_ocr_model or ''}:{hash(data)}"
    hit = _ocr_text_cache.get(key)
    if hit:
        return hit
    if runtime.deepseek_ocr_base_url:
        text = await deepseek_ocr(data, mime)
    else:
        import base64
        prompt = f"{DEFAULT_OCR_PROMPT}\n\nDocument purpose: {purpose or 'general transcription'}"
        text = await _open_router_vision_chat(prompt, [{"mime": mime, "base64": base64.b64encode(data).decode("ascii")}], _resolve_vision_ocr_model())
    _ocr_text_cache[key] = text
    return text

async def convert_doc_to_text(doc: Any, ocr: bool = False, purpose: str = "general transcription") -> Any:
    """Instantiate Document.content from docs_dir. Never stores encoded copies on Document."""
    from pathlib import Path
    filename = getattr(doc, "filename", None) or (doc.get("filename") if isinstance(doc, dict) else None)
    content = getattr(doc, "content", None) or (doc.get("content") if isinstance(doc, dict) else None)
    if isinstance(content, str) and content.strip():
        return type(doc)(content=content, filename=filename) if not isinstance(doc, dict) else {"content": content, "filename": filename}
    if not filename:
        raise RuntimeError("convert to text: Document.filename is required")
    path = Path(runtime.docs_dir or "docs") / str(filename)
    data = path.read_bytes()
    mime = _mime_from_filename(str(filename))
    if ocr:
        text = await _ocr_bytes(data, mime, purpose)
    else:
        text = data.decode("utf-8", errors="replace").strip()
        if not text:
            raise RuntimeError(f"convert to text: no parser text for {filename} — set ocr=True for scans")
    if isinstance(doc, dict):
        return {"content": text, "filename": filename}
    return type(doc)(content=text, filename=filename)

async def vision_ocr(mime: str, base64: str, purpose: str = "general transcription") -> str:
    """Deprecated — prefer convert_doc_to_text. Kept for older generated steps."""
    import base64 as b64mod
    return await _ocr_bytes(b64mod.b64decode(base64), mime, purpose)

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

def example_select_items(data: Any) -> list[Any]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        arrays = [v for v in data.values() if isinstance(v, list)]
        if len(arrays) == 1:
            return arrays[0]
    return [] if data is None else [data]


def _project_example_for_prompt(item: Any, columns: list[str] | None) -> Any:
    if not columns or not isinstance(item, dict):
        return item
    return {c: item[c] for c in columns if c in item}


async def select_relevant(
    items: list[Any],
    description: str,
    template: str,
    reason_field: str = "selection_reason",
    prompt_columns: list[str] | None = None,
) -> list[Any]:
    def prompt_for(item: Any) -> str:
        # AI : TODO (example-select-view) — dump the prompt view, not the full item; kept rows stay passthrough.
        example_text = json.dumps(_project_example_for_prompt(item, prompt_columns), default=str)
        return (
            template.replace("{description}", description)
            .replace("{example}", example_text)
            .replace("{input_to_prompt}", example_text)
        )
    verdicts = await llm_batch_structured(items, prompt_for, relevance_schema)
    kept: list[Any] = []
    for i, item in enumerate(items):
        verdict = verdicts[i] if i < len(verdicts) else {}
        if isinstance(verdict, dict) and verdict.get("is_relevant"):
            row = dict(item) if isinstance(item, dict) else {"value": item}
            row[reason_field] = verdict.get("chain_of_thought") or ""
            kept.append(row)
    return kept

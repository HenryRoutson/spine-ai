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

def resolve_quotes(data: Any, source_text: str, doc_id: str, quote_paths: list[str] | None = None, is_list: bool = False) -> Any:
    text = runtime.source_text or source_text
    did = runtime.source_doc_id or doc_id
    if not text or not did:
        raise RuntimeError("configure_pipeline_runtime(source_text=..., source_doc_id=...) for quote steps")
    paths = quote_paths or []
    rows = data if is_list and isinstance(data, list) else [data]
    linked = [_link_quote_tree(row, text, did, paths) for row in rows]
    return linked if is_list and isinstance(data, list) else linked[0]

def _norm_quote(s: str) -> str:
    return " ".join(s.split()).strip().lower()

def _denorm_offset(source: str, norm_index: int) -> int:
    seen = 0
    prev_space = False
    i = 0
    while i < len(source):
        is_space = source[i].isspace()
        if is_space:
            if prev_space:
                i += 1
                continue
            prev_space = True
        else:
            prev_space = False
        if seen == norm_index and not (is_space and seen == 0):
            return i
        if not (is_space and seen == 0):
            seen += 1
        if seen > norm_index:
            return i
        i += 1
    return i

def find_quote(quote: str, source: str, doc_id: str) -> dict[str, Any]:
    n_quote = _norm_quote(quote)
    n_source = _norm_quote(source)
    exact = n_source.find(n_quote)
    if exact != -1:
        start = _denorm_offset(source, exact)
        end = _denorm_offset(source, exact + len(n_quote))
        return {"text": source[start:end], "doc_id": doc_id, "start": start, "end": end, "exact": True, "score": 1.0}
    import re
    def tokens(s: str) -> list[str]:
        return [re.sub(r"[^\w]", "", t, flags=re.UNICODE) for t in s.split() if re.sub(r"[^\w]", "", t, flags=re.UNICODE)]
    qt = tokens(n_quote)
    words = n_source.split(" ")
    span = max(1, len(n_quote.split(" ")))
    best = {"score": -1.0, "norm_start": 0, "norm_len": len(n_quote)}
    cursor = 0
    for i, word in enumerate(words):
        window = " ".join(words[i : i + span])
        wt = set(tokens(window))
        score = (sum(1 for t in qt if t in wt) / len(qt)) if qt else 0.0
        if score > best["score"]:
            best = {"score": score, "norm_start": cursor, "norm_len": len(window)}
        cursor += len(word) + 1
    start = _denorm_offset(source, int(best["norm_start"]))
    end = _denorm_offset(source, int(best["norm_start"]) + int(best["norm_len"]))
    return {"text": source[start:end], "doc_id": doc_id, "start": start, "end": end, "exact": False, "score": max(0.0, float(best["score"]))}

def _is_linked_quote(v: Any) -> bool:
    return isinstance(v, dict) and isinstance(v.get("text"), str) and isinstance((v.get("quote") or {}).get("doc_id"), str)

def _link_quote_value(raw: Any, source: str, doc_id: str) -> Any:
    if isinstance(raw, str):
        m = find_quote(raw, source, doc_id)
        return {"text": m["text"], "quote": {"doc_id": m["doc_id"], "start": m["start"], "end": m["end"]}}
    if _is_linked_quote(raw):
        return raw
    if isinstance(raw, dict) and isinstance(raw.get("quote"), str):
        m = find_quote(raw["quote"], source, doc_id)
        return {"text": raw["text"] if isinstance(raw.get("text"), str) else m["text"], "quote": {"doc_id": m["doc_id"], "start": m["start"], "end": m["end"]}}
    if isinstance(raw, list):
        return [_link_quote_value(item, source, doc_id) for item in raw]
    return raw

def _set_at_path(root: Any, segments: list[str], source: str, doc_id: str) -> Any:
    if not segments:
        return _link_quote_value(root, source, doc_id)
    head, rest = segments[0], segments[1:]
    is_list = head.endswith("[]")
    key = head[:-2] if is_list else head
    if isinstance(root, list):
        return [_set_at_path(item, segments, source, doc_id) for item in root]
    if not isinstance(root, dict) or key not in root:
        return root
    nxt = root[key]
    if is_list and isinstance(nxt, list):
        return {**root, key: [_set_at_path(item, rest, source, doc_id) for item in nxt]}
    return {**root, key: _set_at_path(nxt, rest, source, doc_id)}

def _link_quote_shapes(data: Any, source: str, doc_id: str) -> Any:
    if isinstance(data, list):
        return [_link_quote_shapes(item, source, doc_id) for item in data]
    if isinstance(data, dict):
        if isinstance(data.get("quote"), str) or _is_linked_quote(data):
            return _link_quote_value(data, source, doc_id)
        return {k: _link_quote_shapes(v, source, doc_id) for k, v in data.items()}
    return data

def _link_quote_tree(data: Any, source: str, doc_id: str, quote_paths: list[str]) -> Any:
    if not quote_paths:
        return _link_quote_shapes(data, source, doc_id)
    out = data
    for path in quote_paths:
        segs = [s for s in path.split(".") if s]
        out = _set_at_path(out, segs, source, doc_id)
    return out

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
    state: Any,
    *,
    url_env: str | None = None,
    url: str | None = None,
    url_default: str | None = None,
    method: str = "POST",
    auth_env: str | None = None,
    include_state: bool = True,
    response_path: str | None = None,
    timeout_ms: int = 30_000,
    body_mode: str = "wrap",
    poll_status_url_path: str | None = None,
    poll_status_path: str = "status",
    poll_done_when: list[str] | None = None,
    poll_fail_when: list[str] | None = None,
    ingest_url_path: str | None = None,
    ingest_input_type: str | None = None,
) -> Any:
    import json
    import os
    import time
    import urllib.request
    resolved = (url or os.environ.get(url_env or "") or url_default or "").strip()
    if not resolved:
        raise RuntimeError(f'set {url_env or "webhook URL"} in .env')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if auth_env:
        auth = (os.environ.get(auth_env) or '').strip()
        if auth:
            if auth.lower().startswith(('bearer ', 'key ', 'basic ', 'digest ')):
                headers['Authorization'] = auth
            elif ":" in auth:
                headers['Authorization'] = f'Key {auth}'
            else:
                headers['Authorization'] = f'Bearer {auth}'
    payload: Any = input if body_mode == "raw" else ({"input": input} if not include_state else {"input": input, "state": state})
    req = urllib.request.Request(
        resolved,
        data=json.dumps(payload).encode(),
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(req, timeout=min(timeout_ms, 30_000) / 1000) as res:
        raw = json.loads(res.read().decode())
    def at_path(root: Any, path: str | None) -> Any:
        if not path:
            return root
        cur = root
        for key in path.split('.'):
            if isinstance(cur, list) and key.isdigit():
                cur = cur[int(key)]
            elif isinstance(cur, dict):
                cur = cur[key]
            else:
                raise RuntimeError(f'webhook path failed at {key}')
        return cur
    current = raw
    if poll_status_url_path:
        done = [s.lower() for s in (poll_done_when or ["completed"])]
        fail = [s.lower() for s in (poll_fail_when or ["failed", "nsfw", "canceled", "cancelled"])]
        delay = 2.0
        deadline = time.time() + timeout_ms / 1000
        while True:
            status = str(at_path(current, poll_status_path) or "").lower()
            if status in done:
                break
            if status in fail:
                raise RuntimeError(f"webhook job {status}")
            if time.time() >= deadline:
                raise RuntimeError(f"webhook poll timed out after {timeout_ms}ms")
            status_url = at_path(current, poll_status_url_path)
            if not isinstance(status_url, str) or not status_url.strip():
                raise RuntimeError(f'webhook poll: no URL at path "{poll_status_url_path}"')
            time.sleep(min(delay, max(0.1, deadline - time.time())))
            poll_req = urllib.request.Request(status_url.strip(), headers={'Accept': 'application/json'}, method='GET')
            with urllib.request.urlopen(poll_req, timeout=30) as poll_res:
                current = json.loads(poll_res.read().decode())
            delay = min(delay * 1.5, 10.0)
    if ingest_url_path:
        media_url = at_path(current, ingest_url_path)
        if not isinstance(media_url, str) or not media_url.strip():
            raise RuntimeError(f'webhook ingest: no URL at path "{ingest_url_path}"')
        media_req = urllib.request.Request(media_url.strip(), method='GET')
        with urllib.request.urlopen(media_req, timeout=60) as media_res:
            blob = media_res.read()
        name = media_url.rsplit("/", 1)[-1].split("?")[0] or ("still.png" if ingest_input_type == "image" else "clip.mp4")
        mime = "image/png" if ingest_input_type == "image" else "video/mp4"
        return {"doc_id": str(len(blob)), "url": media_url, "filename": name, "mime": mime}
    return at_path(current, response_path)
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

// AI : modular LLM provider stubs for exported pipelines — OpenRouter default + custom enterprise hook.
import { MODEL_CATALOG } from "./model_catalog";
import { OPENROUTER_PROVIDER_ID, DEEPSEEK_SLUG } from "./openrouter_slugs";

function catalogRowsTs(): string[] {
  return MODEL_CATALOG.map(
    (e) =>
      `  { id: ${JSON.stringify(e.id)}, label: ${JSON.stringify(e.label)}, providerId: ${JSON.stringify(e.providerId)}, providerModel: ${JSON.stringify(e.providerModel)} },`,
  );
}

export function llmRuntimeFieldsTs(): string[] {
  return [
    "  /** Infrastructure — e.g. openrouter or your enterprise provider id */",
    "  llmProviderId?: string;",
    "  /** Provider-specific model id (OpenRouter slug when using openrouter) */",
    "  llmProviderModel?: string;",
    "  /** OpenRouter (default provider) — kept for backward compatibility */",
    "  openRouterApiKey?: string;",
    "  openRouterModel?: string;",
    "  openRouterSiteUrl?: string;",
    "  openRouterAppTitle?: string;",
  ];
}

export function llmRuntimeFieldsPy(): string[] {
  return [
    "    llm_provider_id: str | None = None",
    "    llm_provider_model: str | None = None",
    "    open_router_api_key: str | None = None",
    "    open_router_model: str | None = None",
    "    open_router_site_url: str | None = None",
    "    open_router_app_title: str | None = None",
  ];
}

export function llmRuntimeFieldsRust(): string[] {
  return [
    "    pub llm_provider_id: Option<String>,",
    "    pub llm_provider_model: Option<String>,",
    "    pub open_router_api_key: Option<String>,",
    "    pub open_router_model: Option<String>,",
    "    pub open_router_site_url: Option<String>,",
    "    pub open_router_app_title: Option<String>,",
  ];
}

export function llmRuntimeFieldsGo(): string[] {
  return [
    "\tLlmProviderID     string",
    "\tLlmProviderModel  string",
    "\tOpenRouterAPIKey  string",
    "\tOpenRouterModel   string",
    "\tOpenRouterSiteURL string",
    "\tOpenRouterAppTitle string",
  ];
}

export function generateLlmProviderStubsTs(): string[] {
  return [
    "// === LLM providers — OpenRouter is default; registerCustomLlmProvider for enterprise APIs ===",
    "",
    'export type LlmProviderId = string;',
    "export type ProviderModelId = string;",
    "",
    "export type LlmProviderCapabilities = { batch: boolean; streaming: boolean; vision: boolean };",
    "",
    "export type LlmProvider = {",
    "  readonly id: LlmProviderId;",
    "  readonly capabilities: LlmProviderCapabilities;",
    "  chat(prompt: string, providerModel: ProviderModelId, jsonMode: boolean): Promise<string>;",
    "  chatBatch?(prompts: string[], providerModel: ProviderModelId, jsonMode: boolean): Promise<string[]>;",
    "};",
    "",
    "export type ModelCatalogRow = {",
    "  id: string;",
    "  label: string;",
    "  providerId: LlmProviderId;",
    "  providerModel: ProviderModelId;",
    "};",
    "",
    "export const MODEL_CATALOG: ModelCatalogRow[] = [",
    ...catalogRowsTs(),
    "];",
    "",
    `export const DEFAULT_LLM_PROVIDER_ID: LlmProviderId = ${JSON.stringify(OPENROUTER_PROVIDER_ID)};`,
    `export const DEFAULT_PROVIDER_MODEL: ProviderModelId = ${JSON.stringify(DEEPSEEK_SLUG)};`,
    "",
    'const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";',
    "",
    "function extractJsonReply(raw: string): string {",
    "  const fenced = raw.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);",
    "  const body = (fenced ? fenced[1] : raw).trim();",
    '  const start = body.search(/[{[]/);',
    '  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));',
    "  return start !== -1 && end > start ? body.slice(start, end + 1) : body;",
    "}",
    "",
    "function resolveActiveProviderId(): LlmProviderId {",
    "  return runtime.llmProviderId ?? DEFAULT_LLM_PROVIDER_ID;",
    "}",
    "",
    "function resolveProviderModel(): ProviderModelId {",
    "  if (runtime.llmProviderModel) return runtime.llmProviderModel;",
    "  if (runtime.openRouterModel) return runtime.openRouterModel;",
    "  return DEFAULT_PROVIDER_MODEL;",
    "}",
    "",
    "async function openRouterChat(prompt: string, providerModel: ProviderModelId, jsonMode: boolean): Promise<string> {",
    '  if (!runtime.openRouterApiKey) throw new Error("configurePipelineRuntime({ openRouterApiKey }) or set llmProviderId to a registered custom provider");',
    "  const res = await fetch(OPENROUTER_CHAT_URL, {",
    '    method: "POST",',
    "    headers: {",
    '      Authorization: `Bearer ${runtime.openRouterApiKey}`,',
    '      "Content-Type": "application/json",',
    '      "HTTP-Referer": runtime.openRouterSiteUrl ?? "http://localhost:3000",',
    '      "X-Title": runtime.openRouterAppTitle ?? "forge-pipeline-export",',
    "    },",
    "    body: JSON.stringify({",
    "      model: providerModel,",
    '      messages: [{ role: "user", content: prompt }],',
    "      temperature: 0,",
    "      max_tokens: 8192,",
    "      provider: { allow_fallbacks: false },",
    '      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),',
    "    }),",
    "  });",
    "  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);",
    "  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };",
    "  const content = data.choices?.[0]?.message?.content;",
    '  if (!content) throw new Error("OpenRouter returned no message content");',
    "  return content;",
    "}",
    "",
    "const openRouterProvider: LlmProvider = {",
    `  id: ${JSON.stringify(OPENROUTER_PROVIDER_ID)},`,
    "  capabilities: { batch: true, streaming: true, vision: true },",
    "  chat: openRouterChat,",
    "  async chatBatch(prompts, providerModel, jsonMode) {",
    "    return Promise.all(prompts.map((p) => openRouterChat(p, providerModel, jsonMode)));",
    "  },",
    "};",
    "",
    "const customProviders = new Map<LlmProviderId, LlmProvider>();",
    "",
    "/** Register an enterprise / internal LLM provider (persisted for the process lifetime). */",
    "export function registerCustomLlmProvider(provider: LlmProvider): void {",
    "  customProviders.set(provider.id, provider);",
    "}",
    "",
    "export function getLlmProvider(id?: LlmProviderId): LlmProvider {",
    "  const resolved = id ?? resolveActiveProviderId();",
    `  if (resolved === ${JSON.stringify(OPENROUTER_PROVIDER_ID)}) return openRouterProvider;`,
    "  const custom = customProviders.get(resolved);",
    "  if (custom) return custom;",
    '  throw new Error(`Unknown LLM provider: ${resolved} — call registerCustomLlmProvider() or set llmProviderId to openrouter`);',
    "}",
  ];
}

export function llmChatHelperTs(): string[] {
  return [
    "async function llmChat(prompt: string, jsonMode: boolean): Promise<string> {",
    "  const provider = getLlmProvider();",
    "  return provider.chat(prompt, resolveProviderModel(), jsonMode);",
    "}",
  ];
}

export function llmStructuredStubTsModular(): string[] {
  return [
    ...llmChatHelperTs(),
    "",
    "async function llmStructured<T>(prompt: string, schema: unknown): Promise<T> {",
    "  const schemaJson = JSON.stringify(schema ?? {}, null, 2);",
    '  const base = `${prompt}\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n${schemaJson}`;',
    '  let lastError = "";',
    "  for (let attempt = 0; attempt < 2; attempt++) {",
    "    const ask =",
    "      attempt === 0",
    '        ? base',
    '        : `${base}\\n\\nYour previous reply failed validation:\\n${lastError}\\nReturn corrected JSON only.`;',
    "    const raw = await llmChat(ask, true);",
    "    const json = extractJsonReply(raw);",
    "    try {",
    "      return JSON.parse(json) as T;",
    "    } catch (e) {",
    "      lastError = (e as Error).message;",
    '      if (attempt === 1) throw new Error(`structured response parse failed after retry: ${lastError}`);',
    "    }",
    "  }",
    '  throw new Error("structured response failed");',
    "}",
  ];
}

export function llmBatchStubTsModular(): string[] {
  return [
    "async function llmBatchStructured<T>(",
    "  items: unknown[],",
    "  promptFor: (item: unknown) => string,",
    "  schema: unknown,",
    "): Promise<T[]> {",
    "  const provider = getLlmProvider();",
    "  const providerModel = resolveProviderModel();",
    "  const schemaJson = JSON.stringify(schema ?? {}, null, 2);",
    '  const suffix = `\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n${schemaJson}`;',
    "  const prompts = items.map((item) => `${promptFor(item)}${suffix}`);",
    "  const raws = provider.capabilities.batch && provider.chatBatch",
    "    ? await provider.chatBatch(prompts, providerModel, true)",
    "    : await Promise.all(prompts.map((p) => provider.chat(p, providerModel, true)));",
    "  return raws.map((raw) => JSON.parse(extractJsonReply(raw)) as T);",
    "}",
  ];
}

export function generateLlmProviderStubsPy(): string[] {
  return [
    "# === LLM providers — OpenRouter default; register_custom_llm_provider for enterprise ===",
    "",
    "from dataclasses import dataclass",
    "from typing import Any, Callable, Protocol",
    "",
    "LlmProviderId = str",
    "ProviderModelId = str",
    "",
    "@dataclass(frozen=True)",
    "class LlmProviderCapabilities:",
    "    batch: bool = True",
    "    streaming: bool = True",
    "    vision: bool = True",
    "",
    "class LlmProvider(Protocol):",
    "    id: LlmProviderId",
    "    capabilities: LlmProviderCapabilities",
    "    async def chat(self, prompt: str, provider_model: ProviderModelId, json_mode: bool) -> str: ...",
    "    async def chat_batch(self, prompts: list[str], provider_model: ProviderModelId, json_mode: bool) -> list[str]: ...",
    "",
    "MODEL_CATALOG: list[dict[str, str]] = [",
    ...MODEL_CATALOG.map(
      (e) =>
        `    {"id": ${JSON.stringify(e.id)}, "label": ${JSON.stringify(e.label)}, "provider_id": ${JSON.stringify(e.providerId)}, "provider_model": ${JSON.stringify(e.providerModel)}},`,
    ),
    "]",
    "",
    `DEFAULT_LLM_PROVIDER_ID: LlmProviderId = ${JSON.stringify(OPENROUTER_PROVIDER_ID)}`,
    `DEFAULT_PROVIDER_MODEL: ProviderModelId = ${JSON.stringify(DEEPSEEK_SLUG)}`,
    "",
    "_custom_providers: dict[LlmProviderId, LlmProvider] = {}",
    "",
    "def register_custom_llm_provider(provider: LlmProvider) -> None:",
    "    _custom_providers[provider.id] = provider",
    "",
    "def _resolve_active_provider_id() -> LlmProviderId:",
    "    return runtime.llm_provider_id or DEFAULT_LLM_PROVIDER_ID",
    "",
    "def _resolve_provider_model() -> ProviderModelId:",
    "    return runtime.llm_provider_model or runtime.open_router_model or DEFAULT_PROVIDER_MODEL",
  ];
}

export function openRouterHelpersPyModular(): string[] {
  return [
    'OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"',
    "",
    "def _extract_json_reply(raw: str) -> str:",
    '    m = re.search(r"```(?:json)?\\s*([\\s\\S]*?)```", raw, re.I)',
    "    body = (m.group(1) if m else raw).strip()",
    '    starts = [body.find("{"), body.find("[")]',
    "    start = min(x for x in starts if x >= 0) if any(x >= 0 for x in starts) else -1",
    '    end = max(body.rfind("}"), body.rfind("]"))',
    "    return body[start : end + 1] if start != -1 and end > start else body",
    "",
    "async def _open_router_chat(prompt: str, provider_model: ProviderModelId, json_mode: bool) -> str:",
    "    if not runtime.open_router_api_key:",
    '        raise RuntimeError("configure_pipeline_runtime(open_router_api_key=...) or register a custom provider")',
    "    headers = {",
    '        "Authorization": f"Bearer {runtime.open_router_api_key}",',
    '        "Content-Type": "application/json",',
    '        "HTTP-Referer": runtime.open_router_site_url or "http://localhost:3000",',
    '        "X-Title": runtime.open_router_app_title or "forge-pipeline-export",',
    "    }",
    "    payload: dict[str, object] = {",
    '        "model": provider_model,',
    '        "messages": [{"role": "user", "content": prompt}],',
    "        \"temperature\": 0,",
    "        \"max_tokens\": 8192,",
    '        "provider": {"allow_fallbacks": False},',
    "    }",
    "    if json_mode:",
    '        payload["response_format"] = {"type": "json_object"}',
    "    async with httpx.AsyncClient(timeout=120) as client:",
    "        res = await client.post(OPENROUTER_CHAT_URL, headers=headers, json=payload)",
    "    if res.status_code != 200:",
    '        raise RuntimeError(f"OpenRouter {res.status_code}: {res.text}")',
    "    data: Any = res.json()",
    '    choices: Any = data.get("choices") if isinstance(data, dict) else None',
    "    first: Any = choices[0] if isinstance(choices, list) and choices else {}",
    '    message: Any = first.get("message", {}) if isinstance(first, dict) else {}',
    '    content: Any = message.get("content") if isinstance(message, dict) else None',
    "    if not isinstance(content, str) or not content:",
    '        raise RuntimeError("OpenRouter returned no message content")',
    "    return content",
    "",
    "@dataclass",
    "class _OpenRouterProvider:",
    `    id: LlmProviderId = ${JSON.stringify(OPENROUTER_PROVIDER_ID)}`,
    "    capabilities: LlmProviderCapabilities = LlmProviderCapabilities()",
    "",
    "    async def chat(self, prompt: str, provider_model: ProviderModelId, json_mode: bool) -> str:",
    "        return await _open_router_chat(prompt, provider_model, json_mode)",
    "",
    "    async def chat_batch(self, prompts: list[str], provider_model: ProviderModelId, json_mode: bool) -> list[str]:",
    "        return [await self.chat(p, provider_model, json_mode) for p in prompts]",
    "",
    "_open_router_provider = _OpenRouterProvider()",
    "",
    "def get_llm_provider(provider_id: LlmProviderId | None = None) -> LlmProvider:",
    "    resolved = provider_id or _resolve_active_provider_id()",
    "    if resolved == " + JSON.stringify(OPENROUTER_PROVIDER_ID) + ":",
    "        return _open_router_provider",
    "    custom = _custom_providers.get(resolved)",
    "    if custom:",
    "        return custom",
    '    raise RuntimeError(f"Unknown LLM provider: {resolved}")',
  ];
}

export function llmChatHelperPy(): string[] {
  return [
    "async def _llm_chat(prompt: str, json_mode: bool) -> str:",
    "    provider = get_llm_provider()",
    "    return await provider.chat(prompt, _resolve_provider_model(), json_mode)",
  ];
}

export function llmStructuredStubPyModular(): string[] {
  return [
    ...llmChatHelperPy(),
    "",
    "async def llm_structured(prompt: str, schema: Any) -> Any:",
    "    schema_json = json.dumps(schema or {}, indent=2)",
    '    base = f"{prompt}\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n{schema_json}"',
    '    last_error = ""',
    "    for attempt in range(2):",
    "        ask = base if attempt == 0 else f\"{base}\\n\\nYour previous reply failed validation:\\n{last_error}\\nReturn corrected JSON only.\"",
    "        raw = await _llm_chat(ask, True)",
    "        json_text = _extract_json_reply(raw)",
    "        try:",
    "            return json.loads(json_text)",
    "        except json.JSONDecodeError as e:",
    "            last_error = str(e)",
    "            if attempt == 1:",
    '                raise RuntimeError(f"structured response parse failed after retry: {last_error}") from e',
    '    raise RuntimeError("structured response failed")',
  ];
}

export function llmBatchStubPyModular(): string[] {
  return [
    "async def llm_batch_structured(",
    "    items: list[Any],",
    "    prompt_for: Callable[[Any], str],",
    "    schema: Any,",
    ") -> list[Any]:",
    "    provider = get_llm_provider()",
    "    provider_model = _resolve_provider_model()",
    "    schema_json = json.dumps(schema or {}, indent=2)",
    '    suffix = f"\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n{schema_json}"',
    "    prompts = [f\"{prompt_for(item)}{suffix}\" for item in items]",
    "    if provider.capabilities.batch:",
    "        raws = await provider.chat_batch(prompts, provider_model, True)",
    "    else:",
    "        raws = [await provider.chat(p, provider_model, True) for p in prompts]",
    "    return [json.loads(_extract_json_reply(raw)) for raw in raws]",
  ];
}

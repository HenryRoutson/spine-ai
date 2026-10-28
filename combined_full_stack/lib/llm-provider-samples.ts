// AI : client-safe LLM provider example code — shown in model selector for each export language.
import type { CodeViewerLanguage, MultiLangCodeSource } from "@/lib/code-viewer-types";
import { OPENROUTER_PROVIDER_ID } from "@/lib/types";

export type LlmProviderSampleKind = "openrouter" | "custom";

const OPENROUTER_TS = `// OpenRouter provider — default infrastructure for Spine + exports
export type LlmProvider = {
  readonly id: string;
  readonly capabilities: { batch: boolean; streaming: boolean; vision: boolean };
  chat(prompt: string, providerModel: string, jsonMode: boolean): Promise<string>;
  chatBatch?(prompts: string[], providerModel: string, jsonMode: boolean): Promise<string[]>;
};

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

async function openRouterChat(
  prompt: string,
  providerModel: string,
  jsonMode: boolean,
): Promise<string> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: providerModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 8192,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(\`OpenRouter \${res.status}: \${await res.text()}\`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no message content");
  return content;
}

export const openRouterProvider: LlmProvider = {
  id: "${OPENROUTER_PROVIDER_ID}",
  capabilities: { batch: true, streaming: true, vision: true },
  chat: openRouterChat,
  async chatBatch(prompts, providerModel, jsonMode) {
    return Promise.all(prompts.map((p) => openRouterChat(p, providerModel, jsonMode)));
  },
};`;

const OPENROUTER_PY = `# OpenRouter provider — default infrastructure for Spine + exports
from dataclasses import dataclass
from typing import Protocol
import httpx
import os

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

@dataclass(frozen=True)
class LlmProviderCapabilities:
    batch: bool = True
    streaming: bool = True
    vision: bool = True

class LlmProvider(Protocol):
    id: str
    capabilities: LlmProviderCapabilities
    async def chat(self, prompt: str, provider_model: str, json_mode: bool) -> str: ...
    async def chat_batch(self, prompts: list[str], provider_model: str, json_mode: bool) -> list[str]: ...

async def _open_router_chat(prompt: str, provider_model: str, json_mode: bool) -> str:
    headers = {
        "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
        "Content-Type": "application/json",
    }
    payload: dict[str, object] = {
        "model": provider_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 8192,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(OPENROUTER_CHAT_URL, headers=headers, json=payload)
    if res.status_code != 200:
        raise RuntimeError(f"OpenRouter {res.status_code}: {res.text}")
    data = res.json()
    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content:
        raise RuntimeError("OpenRouter returned no message content")
    return content

@dataclass
class OpenRouterProvider:
    id: str = "${OPENROUTER_PROVIDER_ID}"
    capabilities: LlmProviderCapabilities = LlmProviderCapabilities()

    async def chat(self, prompt: str, provider_model: str, json_mode: bool) -> str:
        return await _open_router_chat(prompt, provider_model, json_mode)

    async def chat_batch(self, prompts: list[str], provider_model: str, json_mode: bool) -> list[str]:
        return [await self.chat(p, provider_model, json_mode) for p in prompts]`;

const OPENROUTER_RS = `// OpenRouter provider — default infrastructure for Spine + exports
const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

async fn open_router_chat(prompt: &str, provider_model: &str, json_mode: bool) -> anyhow::Result<String> {
    let key = std::env::var("OPENROUTER_API_KEY")?;
    let mut payload = serde_json::json!({
        "model": provider_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 8192,
    });
    if json_mode {
        payload["response_format"] = serde_json::json!({"type": "json_object"});
    }
    let res = reqwest::Client::new()
        .post(OPENROUTER_CHAT_URL)
        .header("Authorization", format!("Bearer {}", key))
        .json(&payload)
        .send()
        .await?;
    if !res.status().is_success() {
        anyhow::bail!("OpenRouter {}: {}", res.status(), res.text().await.unwrap_or_default());
    }
    let data: serde_json::Value = res.json().await?;
    let content = data.pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("OpenRouter returned no message content"))?;
    Ok(content.to_string())
}`;

const OPENROUTER_GO = `// OpenRouter provider — default infrastructure for Spine + exports
const openRouterChatURL = "https://openrouter.ai/api/v1/chat/completions"

type LlmProvider struct {
\tID           string
\tBatch        bool
\tStreaming    bool
\tVision       bool
}

func openRouterChat(apiKey, providerModel, prompt string, jsonMode bool) (string, error) {
\tpayload := map[string]any{
\t\t"model": providerModel,
\t\t"messages": []map[string]string{{"role": "user", "content": prompt}},
\t\t"temperature": 0,
\t\t"max_tokens": 8192,
\t}
\tif jsonMode {
\t\tpayload["response_format"] = map[string]string{"type": "json_object"}
\t}
\tbody, _ := json.Marshal(payload)
\treq, _ := http.NewRequest(http.MethodPost, openRouterChatURL, bytes.NewReader(body))
\treq.Header.Set("Authorization", "Bearer "+apiKey)
\treq.Header.Set("Content-Type", "application/json")
\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\treturn "", err
\t}
\tdefer res.Body.Close()
\tif res.StatusCode >= 400 {
\t\tb, _ := io.ReadAll(res.Body)
\t\treturn "", fmt.Errorf("OpenRouter %s: %s", res.Status, string(b))
\t}
\tvar data map[string]any
\tif err := json.NewDecoder(res.Body).Decode(&data); err != nil {
\t\treturn "", err
\t}
\tchoices, _ := data["choices"].([]any)
\tfirst, _ := choices[0].(map[string]any)
\tmsg, _ := first["message"].(map[string]any)
\tcontent, _ := msg["content"].(string)
\tif content == "" {
\t\treturn "", fmt.Errorf("OpenRouter returned no message content")
\t}
\treturn content, nil
}

var OpenRouterProvider = LlmProvider{ID: "${OPENROUTER_PROVIDER_ID}", Batch: true, Streaming: true, Vision: true}`;

const OPENROUTER_BAML = `// BAML — OpenRouter client (https://github.com/boundaryml/baml)
client<llm> OpenRouterGpt5Mini {
  provider openrouter
  options {
    model "openai/gpt-4o-mini"
    // api_key from env.OPENROUTER_API_KEY
  }
}

function Summarize(input: string) -> string {
  client OpenRouterGpt5Mini
  prompt #"
    Summarize the input.
    {{ input }}
  "#
}`;

// AI : new custom providers start from the OpenRouter TS reference — same shape, custom id.
export function customProviderRuntimeTemplate(providerId = "custom_provider"): string {
  return OPENROUTER_TS.replace(`id: "${OPENROUTER_PROVIDER_ID}"`, `id: "${providerId}"`);
}

function langSource(
  language: CodeViewerLanguage,
  label: string,
  filename: string,
  content: string,
  hint?: MultiLangCodeSource["hint"],
): MultiLangCodeSource {
  return { language, label, filename, content, hint };
}

export function openRouterProviderSamples(): MultiLangCodeSource[] {
  return [
    langSource("typescript", "TypeScript", "openrouter_provider.ts", OPENROUTER_TS, "runtime"),
    langSource("python", "Python", "openrouter_provider.py", OPENROUTER_PY, "export"),
    langSource("rust", "Rust", "openrouter_provider.rs", OPENROUTER_RS, "export"),
    langSource("go", "Go", "openrouter_provider.go", OPENROUTER_GO, "export"),
    langSource("baml", "BAML", "openrouter_client.baml", OPENROUTER_BAML, "export"),
  ];
}

const CUSTOM_PROVIDER_PY = (providerId: string) => `# Export-only — register at startup with register_custom_llm_provider()
from dataclasses import dataclass

@dataclass
class CustomProvider:
    id: str = "${providerId}"
    capabilities: LlmProviderCapabilities = LlmProviderCapabilities(batch=False)

    async def chat(self, prompt: str, provider_model: str, json_mode: bool) -> str:
        raise NotImplementedError("wire your internal API")`;

const CUSTOM_PROVIDER_RS = (providerId: string) => `// Export-only — wire into your Rust pipeline bootstrap
pub struct CustomProvider {
    pub id: &'static str,
}

impl CustomProvider {
    pub fn new() -> Self {
        Self { id: "${providerId}" }
    }

    pub async fn chat(&self, prompt: &str, provider_model: &str, json_mode: bool) -> anyhow::Result<String> {
        anyhow::bail!("wire your internal API")
    }
}`;

const CUSTOM_PROVIDER_GO = (providerId: string) => `// Export-only — register in your Go pipeline bootstrap
type CustomProvider struct {
\tID string
}

func NewCustomProvider() CustomProvider {
\treturn CustomProvider{ID: "${providerId}"}
}

func (p CustomProvider) Chat(ctx context.Context, prompt, providerModel string, jsonMode bool) (string, error) {
\treturn "", fmt.Errorf("wire your internal API")
}`;

const CUSTOM_PROVIDER_BAML = (providerId: string) => `// Export-only — BAML client stub for ${providerId}
client<llm> CustomProviderClient {
  provider "custom-${providerId}"
  options {
    // api_key from env
  }
}`;

export function customProviderTemplate(language: CodeViewerLanguage, providerId = "custom_provider"): string {
  if (language === "typescript") return customProviderRuntimeTemplate(providerId);
  if (language === "python") return CUSTOM_PROVIDER_PY(providerId);
  if (language === "rust") return CUSTOM_PROVIDER_RS(providerId);
  if (language === "go") return CUSTOM_PROVIDER_GO(providerId);
  if (language === "baml") return CUSTOM_PROVIDER_BAML(providerId);
  return `// Export-only stub for ${language} — see TypeScript runtime tab for the required chat() contract.`;
}

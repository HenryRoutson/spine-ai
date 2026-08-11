import { orderedInputModules } from "@/lib/inference-input";
import { labelAsStateKey } from "./pipeline_state";
import type { PipelineSetupFile } from "./pipeline_export_shared";
import { generatePipelineRunnerFiles } from "./pipeline_export_runners";
import {
  generateLlmProviderStubsPy,
  generateLlmProviderStubsTs,
  llmBatchStubPyModular,
  llmBatchStubTsModular,
  llmRuntimeFieldsGo,
  llmRuntimeFieldsPy,
  llmRuntimeFieldsRust,
  llmRuntimeFieldsTs,
  llmStructuredStubPyModular,
  llmStructuredStubTsModular,
  openRouterHelpersPyModular,
  visionOcrStubPy,
  visionOcrStubTs,
} from "./pipeline_export_llm";
import { ModuleKind } from "./types";
import type { PipelineModule, Project } from "./types";
import { collectWebhookExportEnvKeys } from "@/lib/webhook-step";

export type ExportRuntimeNeeds = {
  llm: boolean;
  llmBatch: boolean;
  quote: boolean;
  humanReview: boolean;
  chatbot: boolean;
  webhook: boolean;
  visionOcr: boolean;
  inputModules: { label: string; filenameHint?: string; inputType?: string }[];
  webhookEnvKeys: { label: string; envKey: string; authEnv?: string }[];
};

export type { PipelineSetupFile } from "./pipeline_export_shared";

export function analyzeExportRuntimeNeeds(project: Project): ExportRuntimeNeeds {
  const inputModules = orderedInputModules(project.modules).map((m) => ({
    label: labelAsStateKey(m.label),
    filenameHint: m.inputNameContains?.trim() || undefined,
    inputType: m.inputType ? (Array.isArray(m.inputType) ? m.inputType.join("|") : m.inputType) : undefined,
  }));
  let llm = false;
  let llmBatch = false;
  let quote = false;
  let humanReview = false;
  let chatbot = false;
  let webhook = false;
  let visionOcr = false;
  for (const m of project.modules) {
    if (m.kind === ModuleKind.Llm) llm = true;
    // AI : example-select uses llmBatchStructured — treat like llm-batch for stub inclusion.
    if (m.kind === ModuleKind.LlmBatch || m.kind === ModuleKind.ExampleSelect) llmBatch = true;
    if (m.kind === ModuleKind.Quote) quote = true;
    if (m.kind === ModuleKind.HumanReview) humanReview = true;
    if (m.kind === ModuleKind.Chatbot) chatbot = true;
    if (m.kind === ModuleKind.Webhook) webhook = true;
    if (m.kind === ModuleKind.Input && m.useOcr) visionOcr = true;
  }
  return {
    llm,
    llmBatch,
    quote,
    humanReview,
    chatbot,
    webhook,
    visionOcr,
    inputModules,
    webhookEnvKeys: collectWebhookExportEnvKeys(project.modules),
  };
}

function projectSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pipeline"
  );
}

export function generateEnvExample(project: Project): string {
  const needs = analyzeExportRuntimeNeeds(project);
  const lines = [
    "# Pipeline runtime — copy to .env and fill in before running exported code.",
    `# Project: ${project.name}`,
    "",
  ];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push(
      "# LLM inference — OpenRouter is default; set LLM_PROVIDER for enterprise internal APIs",
      'LLM_PROVIDER="openrouter"',
      'OPENROUTER_API_KEY=""',
      'OPENROUTER_SITE_URL="http://localhost:3000"',
      'OPENROUTER_APP_TITLE=""',
      "# Custom / enterprise provider (when LLM_PROVIDER is not openrouter)",
      'CUSTOM_LLM_PROVIDER_ID="custom"',
      'CUSTOM_LLM_API_URL=""',
      'CUSTOM_LLM_API_KEY=""',
      "",
    );
  }

  if (needs.quote) {
    lines.push(
      "# Quote linker — source document text + id for span resolution",
      'PIPELINE_SOURCE_TEXT=""',
      'PIPELINE_SOURCE_DOC_ID=""',
      "",
    );
  }

  if (needs.humanReview) {
    lines.push(
      "# Human review — optional webhook or UI endpoint",
      'PIPELINE_REVIEW_WEBHOOK=""',
      "",
    );
  }

  if (needs.webhook && needs.webhookEnvKeys.length) {
    lines.push("# Webhook steps — external integrations (n8n, search APIs, Zapier, …)");
    for (const w of needs.webhookEnvKeys) {
      lines.push(`# Step "${w.label}"`, `${w.envKey}=""`);
      if (w.authEnv) lines.push(`${w.authEnv}=""`);
      lines.push("");
    }
  }

  lines.push(
    "# Connector — gRPC + HTTP JSON bridge (see connector_server.*)",
    'PIPELINE_GRPC_PORT="50051"',
    'PIPELINE_HTTP_PORT="8080"',
    "",
    "# Optional — Supabase persistence for exported app (TODO: migrations in export bundle)",
    '# NEXT_PUBLIC_SUPABASE_URL=""',
    '# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""',
    '# SUPABASE_SERVICE_ROLE_KEY=""',
    "",
    "# Optional — step cache store (TODO: wire Redis/Supabase in connector + orchestrator)",
    '# PIPELINE_CACHE_URL=""',
    "",
    "# Optional — billing UI in the full Spine app (not required for pipeline-only runs)",
    '# NEXT_PUBLIC_STRIPE_ENABLED="false"',
    '# STRIPE_SECRET_KEY=""',
    "",
  );

  return lines.join("\n");
}

export function generateSetupReadme(project: Project, slug: string): string {
  const needs = analyzeExportRuntimeNeeds(project);
  const lines = [
    `# ${project.name}`,
    "",
    "Exported pipeline from Spine — types, step bodies, gRPC/HTTP connector, and inference UI.",
    "",
    "## Quick start",
    "",
    "```bash",
    "cp .env.example .env   # add OPENROUTER_API_KEY",
    "npm install @grpc/grpc-js @grpc/proto-loader dotenv",
    "npx tsx connector_server.ts",
    "# open inference_ui.html → Connector URL http://localhost:8080/v1/run",
    "```",
    "",
    "Or call `runPipeline` / `run_pipeline` directly (see **Run** below).",
    "",
    "## Files",
    "",
    `- \`${slug}_pipeline.ts\` — TypeScript types, steps, orchestrator`,
    `- \`${slug}_pipeline.py\` — Python models, steps, orchestrator`,
    `- \`${slug}_pipeline.rs\` — Rust structs, steps, orchestrator`,
    `- \`${slug}_pipeline.go\` — Go structs, steps, orchestrator`,
    `- \`${slug}_pipeline.baml\` — BAML classes + LLM functions (https://github.com/boundaryml/baml)`,
    "- `pipeline_connector.proto` — gRPC contract (same for TS and Python)",
    "- `connector_server.ts` / `connector_server.py` — gRPC + HTTP JSON bridge",
    "- `inference_ui.html` — standalone inference UI (open in browser, POST to connector)",
    "- `documents/` — sample input files, `inference_setup.json`, and `testing_setup.json` when bundled",
    "- `run_example.ts` / `run_example.py` — load documents/ and print step trace",
    "- `.env.example` — copy to `.env` and fill in (never commit real secrets)",
    "- `requirements.txt` — Python deps (`pip install -r requirements.txt`)",
    "- `README.md` — this file",
    "- `SETUP.md` — pointer to this README",
    "",
    "## 1. Environment",
    "",
    "```bash",
    "cp .env.example .env",
    "# edit .env — add your API keys",
    "```",
    "",
    "Load `.env` in your runner (e.g. `dotenv` for Node, `python-dotenv` for Python).",
    "The exported pipeline file intentionally does **not** embed env access — pass config via `configurePipelineRuntime`.",
    "",
    "TypeScript runner: `npm install dotenv` (or load env in your shell).",
    "",
    "Rust runner: add crates `serde`, `serde_json`, `tokio`, `reqwest` (json feature), `anyhow` — see Cargo snippet under **Run**.",
    "",
    "Go runner: stdlib only (`encoding/json`, `net/http`) — see snippet under **Run**.",
    "",
  ];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push(
      "## 2. LLM",
      "",
      "Wire `configurePipelineRuntime({ openRouterApiKey })` (or Python equivalent) — OpenRouter is the default LLM provider.",
      "For enterprise internal LLMs, call `registerCustomLlmProvider()` / `register_custom_llm_provider()` and set `llmProviderId`.",
      "Override the model via `openRouterModel` in runtime config, or edit step bodies to pass a different slug.",
      "",
    );
  }

  if (needs.visionOcr) {
    lines.push(
      "## Vision OCR",
      "",
      "Input steps with `useOcr` call `visionOcr({ mime, base64 })` (OpenRouter multimodal).",
      "Default vision model: Gemini Flash via OpenRouter (`google/gemini-3-flash-preview`). Override with `visionOcrModel`.",
      "Pass file bytes as base64 on the Document (`{ filename, content?, mime, base64 }`). If `content` is already text, OCR is skipped.",
      "",
      "DeepSeek-OCR (specialized OCR) is not the OpenRouter default — point `visionOcrModel` at a vision-capable slug, or swap the helper for a DeepSeek-OCR / vLLM endpoint.",
      "",
    );
  }

  if (needs.quote) {
    lines.push(
      "## Quote linker",
      "",
      "Set `sourceText` and `sourceDocId` in runtime config (or env `PIPELINE_SOURCE_*`) before quote steps run.",
      "",
    );
  }

  if (needs.humanReview) {
    lines.push(
      "## Human review",
      "",
      "Implement `waitForHumanReview` / `wait_for_human_review` — pause until an operator approves the spine value.",
      "",
    );
  }

  // AI : chatbot README + waitForChatbotSession stubs when pipeline uses Chatbot steps.
  if (needs.chatbot) {
    lines.push(
      "## Chatbot",
      "",
      "Implement `waitForChatbotSession` / `wait_for_chatbot_session` — pause for a prompted chat.",
      "Input is `ChatbotPrompt` (`prompt` field). Return `ChatbotResult` (prompt, transcript, exit_reason).",
      "",
    );
  }

  if (needs.inputModules.length) {
    lines.push("## Input documents", "");
    for (const input of needs.inputModules) {
      const hints = [
        input.filenameHint ? `filename contains \`${input.filenameHint}\`` : null,
        input.inputType ? `type: ${input.inputType}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`- **${input.label}**${hints ? ` — ${hints}` : ""}`);
    }
    lines.push(
      "",
      needs.visionOcr
        ? "Each input step expects `{ filename, content }` and/or `{ filename, mime, base64 }` when vision OCR is enabled."
        : "Each input step expects `{ content: string, filename: string }` (read file text into `content`).",
      "",
    );
  }

  const multi = needs.inputModules.length > 1;
  const runtimeConfigTs =
    needs.llm || needs.llmBatch || needs.visionOcr
      ? "configurePipelineRuntime({ openRouterApiKey: process.env.OPENROUTER_API_KEY! });"
      : "// configurePipelineRuntime({ ... }) if you extend runtime stubs";
  const runtimeConfigPy =
    needs.llm || needs.llmBatch || needs.visionOcr
      ? "configure_pipeline_runtime(open_router_api_key=os.environ['OPENROUTER_API_KEY'])"
      : "# configure_pipeline_runtime(...) if you extend runtime stubs";

  lines.push(
    "## Connector + UI",
    "",
    "Both backends expose the same `PipelineConnector` service from `pipeline_connector.proto`:",
    "",
    "- **gRPC** — default port `50051` (`PIPELINE_GRPC_PORT`)",
    "- **HTTP JSON** — `POST /v1/run` on port `8080` (`PIPELINE_HTTP_PORT`) for `inference_ui.html`",
    "",
    "TypeScript connector:",
    "",
    "```bash",
    "npm install @grpc/grpc-js @grpc/proto-loader dotenv",
    "npx tsx connector_server.ts",
    "```",
    "",
    "Python connector:",
    "",
    "```bash",
    "python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. pipeline_connector.proto",
    "python connector_server.py",
    "```",
    "",
    "Open `inference_ui.html` in a browser (or serve statically). Point **Connector URL** at `http://localhost:8080/v1/run`.",
    "Use **Load sample inputs** to pre-fill file paths from `documents/inference_setup.json`.",
    "After a run, open the **Step trace** tab to inspect per-step outputs (like the in-app logging view).",
    "",
    "## Run",
    "",
    multi
      ? [
          "TypeScript (multiple input slots):",
          "",
          "```typescript",
          "import { configurePipelineRuntime, runPipeline } from './" + slug + "_pipeline';",
          "",
          runtimeConfigTs,
          "",
          "const result = await runPipeline({",
          ...needs.inputModules.map(
            (input) =>
              `  ${JSON.stringify(input.label)}: { content: fs.readFileSync('path/to/${input.filenameHint ?? "file"}.json', 'utf8'), filename: '${input.filenameHint ?? "file"}.json' },`,
          ),
          "});",
          "```",
        ].join("\n")
      : [
          "TypeScript (single input):",
          "",
          "```typescript",
          "import { configurePipelineRuntime, runPipeline } from './" + slug + "_pipeline';",
          "",
          runtimeConfigTs,
          "",
          "const result = await runPipeline({",
          "  content: fs.readFileSync('input.json', 'utf8'),",
          "  filename: 'input.json',",
          "});",
          "```",
        ].join("\n"),
    "",
    "Python:",
    "",
    "```python",
    "from " + slug + "_pipeline import configure_pipeline_runtime, run_pipeline",
    "",
    runtimeConfigPy,
    "# await run_pipeline(...)",
    "```",
    "",
    "Rust:",
    "",
    "```toml",
    "# Cargo.toml deps",
    "serde = { version = \"1\", features = [\"derive\"] }",
    "serde_json = \"1\"",
    "tokio = { version = \"1\", features = [\"rt-multi-thread\", \"macros\"] }",
    "reqwest = { version = \"0.12\", features = [\"json\"] }",
    "anyhow = \"1\"",
    "```",
    "",
    "```rust",
    "// include! or copy " + slug + "_pipeline.rs into your crate",
    needs.llm || needs.llmBatch || needs.visionOcr
      ? '// configure_pipeline_runtime(PipelineRuntime { open_router_api_key: Some(/* from your .env loader */), ..Default::default() });'
      : "// configure_pipeline_runtime(PipelineRuntime { ..Default::default() });",
    "// let result = run_pipeline(/* Document or HashMap */).await?;",
    "```",
    "",
    "Go:",
    "",
    "```go",
    "// copy " + slug + "_pipeline.go into your module (package pipeline)",
    needs.llm || needs.llmBatch || needs.visionOcr
      ? "ConfigurePipelineRuntime(PipelineRuntime{OpenRouterAPIKey: /* from your .env loader */})"
      : "ConfigurePipelineRuntime(PipelineRuntime{})",
    "// result, err := RunPipeline(/* Document or map[string]Document */)",
    "```",
    "",
    "BAML (LLM steps only — orchestrate non-LLM steps in Python/TS):",
    "",
    "```bash",
    "npm i -g @boundaryml/baml   # or: pip install baml",
    "# place " + slug + "_pipeline.baml under baml_src/",
    "baml generate",
    "```",
    "",
    "```python",
    "# from baml_client import b",
    "# result = await b.YourLlmStep(input=...)",
    "```",
    "",
  );

  return lines.join("\n");
}

// AI : setup files may name env vars — only block literal secret values, not placeholder templates.
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bsb_[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
];

export function assertNoSecretValuesInExport(source: string): void {
  for (const re of SECRET_VALUE_PATTERNS) {
    if (re.test(source)) {
      throw new Error("Export blocked: output contains a value that looks like a live secret.");
    }
  }
}

export function generateRequirementsTxt(needs: ExportRuntimeNeeds): string {
  const lines = [
    "# Python pipeline runner",
    "pydantic>=2",
    "python-dotenv>=1",
    "grpcio>=1.62",
    "grpcio-tools>=1.62  # protoc for pipeline_connector.proto",
  ];
  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push("httpx>=0.27  # OpenRouter client for llm_structured");
  }
  return lines.join("\n") + "\n";
}

function openRouterHelpersTs(): string[] {
  return [
    'const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";',
    'const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-chat";',
    "",
    "function extractJsonReply(raw: string): string {",
    "  const fenced = raw.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);",
    "  const body = (fenced ? fenced[1] : raw).trim();",
    '  const start = body.search(/[{[]/);',
    '  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));',
    "  return start !== -1 && end > start ? body.slice(start, end + 1) : body;",
    "}",
    "",
    "async function openRouterChat(prompt: string, jsonMode: boolean): Promise<string> {",
    '  if (!runtime.openRouterApiKey) throw new Error("configurePipelineRuntime({ openRouterApiKey }) first");',
    "  const res = await fetch(OPENROUTER_CHAT_URL, {",
    '    method: "POST",',
    "    headers: {",
    '      Authorization: `Bearer ${runtime.openRouterApiKey}`,',
    '      "Content-Type": "application/json",',
    '      "HTTP-Referer": runtime.openRouterSiteUrl ?? "http://localhost:3000",',
    '      "X-Title": runtime.openRouterAppTitle ?? "forge-pipeline-export",',
    "    },",
    "    body: JSON.stringify({",
    "      model: runtime.openRouterModel ?? DEFAULT_OPENROUTER_MODEL,",
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
  ];
}

function llmStructuredStubTs(): string[] {
  return [
    "async function llmStructured<T>(prompt: string, schema: unknown): Promise<T> {",
    '  if (!runtime.openRouterApiKey) throw new Error("configurePipelineRuntime({ openRouterApiKey }) first");',
    "  const schemaJson = JSON.stringify(schema ?? {}, null, 2);",
    '  const base = `${prompt}\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n${schemaJson}`;',
    '  let lastError = "";',
    "  for (let attempt = 0; attempt < 2; attempt++) {",
    "    const ask =",
    "      attempt === 0",
    '        ? base',
    '        : `${base}\\n\\nYour previous reply failed validation:\\n${lastError}\\nReturn corrected JSON only.`;',
    "    const raw = await openRouterChat(ask, true);",
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

function openRouterHelpersPy(): string[] {
  return [
    "import re",
    "",
    "import httpx",
    "",
    'OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"',
    'DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-chat"',
    "",
    "def _extract_json_reply(raw: str) -> str:",
    '    m = re.search(r"```(?:json)?\\s*([\\s\\S]*?)```", raw, re.I)',
    "    body = (m.group(1) if m else raw).strip()",
    '    starts = [body.find("{"), body.find("[")]',
    "    start = min(x for x in starts if x >= 0) if any(x >= 0 for x in starts) else -1",
    '    end = max(body.rfind("}"), body.rfind("]"))',
    "    return body[start : end + 1] if start != -1 and end > start else body",
    "",
    "async def _open_router_chat(prompt: str, json_mode: bool) -> str:",
    "    if not runtime.open_router_api_key:",
    '        raise RuntimeError("configure_pipeline_runtime(open_router_api_key=...) first")',
    "    headers = {",
    '        "Authorization": f"Bearer {runtime.open_router_api_key}",',
    '        "Content-Type": "application/json",',
    '        "HTTP-Referer": runtime.open_router_site_url or "http://localhost:3000",',
    '        "X-Title": runtime.open_router_app_title or "forge-pipeline-export",',
    "    }",
    "    payload: dict[str, object] = {",
    '        "model": runtime.open_router_model or DEFAULT_OPENROUTER_MODEL,',
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
  ];
}

function llmStructuredStubPy(): string[] {
  return [
    "async def llm_structured(prompt: str, schema: Any) -> Any:",
    "    if not runtime.open_router_api_key:",
    '        raise RuntimeError("configure_pipeline_runtime(open_router_api_key=...) first")',
    "    schema_json = json.dumps(schema or {}, indent=2)",
    '    base = f"{prompt}\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n{schema_json}"',
    '    last_error = ""',
    "    for attempt in range(2):",
    "        ask = base if attempt == 0 else f\"{base}\\n\\nYour previous reply failed validation:\\n{last_error}\\nReturn corrected JSON only.\"",
    "        raw = await _open_router_chat(ask, True)",
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

export function generateCustomLlmProviderExportFiles(project: Project): PipelineSetupFile[] {
  const providers = project.llmProviders ?? [];
  const files: PipelineSetupFile[] = [];
  for (const p of providers) {
    assertNoSecretValuesInExport(p.code);
    files.push({
      filename: `providers/${p.id}_provider.ts`,
      content: `${p.code.trim()}\n`,
      mime: "text/typescript",
    });
    if (p.exportCode) {
      for (const [lang, snippet] of Object.entries(p.exportCode)) {
        const trimmed = snippet?.trim();
        if (!trimmed) continue;
        assertNoSecretValuesInExport(trimmed);
        const ext =
          lang === "python" ? "py" : lang === "rust" ? "rs" : lang === "go" ? "go" : lang === "baml" ? "baml" : "txt";
        files.push({
          filename: `providers/${p.id}_provider.${ext}`,
          content: `${trimmed}\n`,
          mime: "text/plain",
        });
      }
    }
  }
  return files;
}

export function generatePipelineSetupFiles(project: Project): PipelineSetupFile[] {
  // AI : TODO export — add run_example.ts / run_example.py that load .env and read input docs.
  // AI : TODO export — Supabase bundle: migrations SQL, RLS policies, runs/docs/cache tables for exported app persistence.
  // AI : TODO export — step I/O caching (Redis or Supabase storage) keyed by content hash + step signature; wire into connector.
  const slug = projectSlug(project.name);
  const needs = analyzeExportRuntimeNeeds(project);
  const envExample = generateEnvExample(project);
  const setupMd = generateSetupReadme(project, slug);
  const requirements = generateRequirementsTxt(needs);
  assertNoSecretValuesInExport(envExample);
  assertNoSecretValuesInExport(setupMd);
  assertNoSecretValuesInExport(requirements);
  // AI : README is the canonical setup doc (spec); SETUP.md is a short pointer.
  const setupPointer = [
    `# ${project.name} — setup`,
    "",
    "See **[README.md](./README.md)** for environment, connector, OCR, and run instructions.",
    "",
  ].join("\n");
  assertNoSecretValuesInExport(setupPointer);
  return [
    { filename: ".env.example", content: envExample, mime: "text/plain" },
    { filename: "README.md", content: setupMd, mime: "text/markdown" },
    { filename: "SETUP.md", content: setupPointer, mime: "text/markdown" },
    { filename: "requirements.txt", content: requirements, mime: "text/plain" },
    ...generateCustomLlmProviderExportFiles(project),
    ...generatePipelineRunnerFiles(project),
  ];
}

export function generateRuntimeConfigSectionTs(needs: ExportRuntimeNeeds): string {
  const lines = [
    "// === runtime config (load .env in your runner — pass values here, not in this file) ===",
    "export type PipelineRuntime = {",
    ...(needs.llm || needs.llmBatch || needs.visionOcr ? llmRuntimeFieldsTs() : []),
    ...(needs.quote ? ["  sourceText?: string;", "  sourceDocId?: string;"] : []),
    ...(needs.humanReview ? ["  onHumanReview?: <T>(input: T) => Promise<void>;"] : []),
    ...(needs.chatbot
      ? [
          "  onChatbot?: (input: ChatbotPrompt) => Promise<ChatbotResult>;",
        ]
      : []),
    "  // AI : TODO export — Supabase persistence (supabaseUrl, supabaseServiceKey).",
    "  // AI : TODO export — step cache (enableCache, cacheUrl / PIPELINE_CACHE_URL).",
    "};",
    "",
    "let runtime: PipelineRuntime = {};",
    "",
    "export function configurePipelineRuntime(config: PipelineRuntime): void {",
    "  runtime = { ...runtime, ...config };",
    "}",
    "",
  ];
  return lines.join("\n");
}

export function generateRuntimeStubsTs(needs: ExportRuntimeNeeds): string {
  const lines = [
    generateRuntimeConfigSectionTs(needs),
    "// --- runtime stubs (replace bodies or inject via configurePipelineRuntime) ---",
  ];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push(
      "",
      ...generateLlmProviderStubsTs(),
    );
  }
  if (needs.llm || needs.visionOcr) {
    lines.push("", ...llmStructuredStubTsModular());
  }
  if (needs.llmBatch) {
    lines.push("", ...llmBatchStubTsModular());
  }
  if (needs.visionOcr) {
    lines.push("", ...visionOcrStubTs());
  }

  if (needs.quote) {
    lines.push(
      "",
      "function resolveQuotes<T>(_data: unknown, _sourceText: string, _docId: string): T {",
      '  const text = runtime.sourceText ?? _sourceText;',
      '  const docId = runtime.sourceDocId ?? _docId;',
      '  if (!text || !docId) throw new Error("configurePipelineRuntime({ sourceText, sourceDocId }) for quote steps");',
      '  throw new Error("wire resolveQuotes to your quote linker");',
      "}",
    );
  }

  if (needs.humanReview) {
    lines.push(
      "",
      "async function waitForHumanReview<T>(input: T): Promise<void> {",
      "  if (runtime.onHumanReview) {",
      "    await runtime.onHumanReview(input);",
      "    return;",
      "  }",
      '  throw new Error("wire waitForHumanReview or configurePipelineRuntime({ onHumanReview })");',
      "}",
    );
  }

  // AI : chatbot session stub — mirror human review, return ChatbotResult.
  if (needs.chatbot) {
    lines.push(
      "",
      "type ChatbotPrompt = { prompt: string };",
      "type ChatbotTurn = { role: string; content: string };",
      "type ChatbotResult = { prompt: string; transcript: ChatbotTurn[]; exit_reason: string };",
      "",
      "async function waitForChatbotSession(",
      "  input: ChatbotPrompt,",
      "  _opts?: { mode?: string },",
      "): Promise<ChatbotResult> {",
      "  if (runtime.onChatbot) {",
      "    return runtime.onChatbot(input);",
      "  }",
      '  throw new Error("wire waitForChatbotSession or configurePipelineRuntime({ onChatbot })");',
      "}",
    );
  }

  if (needs.webhook) {
    lines.push(
      "",
      "type WebhookCallOpts = {",
      "  urlEnv: string;",
      "  method?: string;",
      "  authEnv?: string;",
      "  includeState?: boolean;",
      "  responsePath?: string;",
      "  timeoutMs?: number;",
      "};",
      "",
      "async function callWebhook(",
      "  input: unknown,",
      "  state: PipelineState,",
      "  opts: WebhookCallOpts,",
      "): Promise<unknown> {",
      '  const url = process.env[opts.urlEnv]?.trim();',
      '  if (!url) throw new Error(`set ${opts.urlEnv} in .env`);',
      "  const headers: Record<string, string> = {",
      '    "Content-Type": "application/json",',
      '    Accept: "application/json",',
      "  };",
      "  if (opts.authEnv) {",
      "    const auth = process.env[opts.authEnv]?.trim();",
      '    if (auth) headers.Authorization = auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;',
      "  }",
      "  const body = opts.includeState === false ? { input } : { input, state };",
      "  const res = await fetch(url, {",
      '    method: opts.method ?? "POST",',
      "    headers,",
      "    body: JSON.stringify(body),",
      "    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),",
      "  });",
      "  if (!res.ok) {",
      '    const text = await res.text().catch(() => "");',
      '    throw new Error(`webhook ${res.status}: ${text.slice(0, 240)}`);',
      "  }",
      "  const raw = await res.json();",
      "  if (!opts.responsePath?.trim()) return raw;",
      "  return opts.responsePath.split(\".\").reduce<unknown>((cur, key) => {",
      '    if (cur == null || typeof cur !== "object") throw new Error(`webhook response path failed at ${key}`);',
      "    return (cur as Record<string, unknown>)[key];",
      "  }, raw);",
      "}",
    );
  }

  return lines.join("\n");
}

export function generateRuntimeConfigSectionPy(needs: ExportRuntimeNeeds): string {
  const lines = [
    "# === runtime config (load .env in your runner — pass values here, not in this file) ===",
    "@dataclass",
    "class PipelineRuntime:",
  ];
  const fields: string[] = [];
  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    fields.push(...llmRuntimeFieldsPy());
  }
  if (needs.quote) {
    fields.push("    source_text: str | None = None", "    source_doc_id: str | None = None");
  }
  if (needs.humanReview) {
    fields.push("    on_human_review: Callable[[Any], Any] | None = None");
  }
  if (needs.chatbot) {
    fields.push("    on_chatbot: Callable[..., Any] | None = None");
  }
  if (!fields.length) fields.push("    pass");
  lines.push(
    ...fields,
    "    # AI : TODO export — Supabase persistence (supabase_url, supabase_service_key).",
    "    # AI : TODO export — step cache (enable_cache, cache_url / PIPELINE_CACHE_URL).",
  );
  lines.push("", "runtime = PipelineRuntime()", "", "def configure_pipeline_runtime(**kwargs: Any) -> None:", "    global runtime", "    for k, v in kwargs.items():", "        if hasattr(runtime, k):", "            setattr(runtime, k, v)", "");
  return lines.join("\n");
}

export function generateRuntimeStubsPy(needs: ExportRuntimeNeeds): string {
  const lines = [generateRuntimeConfigSectionPy(needs), "# --- runtime stubs (replace bodies or inject via configure_pipeline_runtime) ---"];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push(
      "",
      ...generateLlmProviderStubsPy(),
      "",
      ...openRouterHelpersPyModular(),
    );
  }
  if (needs.llm || needs.visionOcr) {
    lines.push("", ...llmStructuredStubPyModular());
  }
  if (needs.llmBatch) {
    lines.push("", ...llmBatchStubPyModular());
  }
  if (needs.visionOcr) {
    lines.push("", ...visionOcrStubPy());
  }

  if (needs.quote) {
    lines.push(
      "",
      "def resolve_quotes(data: Any, source_text: str, doc_id: str) -> Any:",
      "    text = runtime.source_text or source_text",
      "    did = runtime.source_doc_id or doc_id",
      '    if not text or not did:',
      '        raise RuntimeError("configure_pipeline_runtime(source_text=..., source_doc_id=...) for quote steps")',
      '    raise NotImplementedError("wire resolve_quotes to your quote linker")',
    );
  }

  if (needs.humanReview) {
    lines.push(
      "",
      "async def wait_for_human_review(input: Any) -> None:",
      "    if runtime.on_human_review:",
      "        await runtime.on_human_review(input)",
      "        return",
      '    raise NotImplementedError("wire wait_for_human_review or configure_pipeline_runtime(on_human_review=...)")',
    );
  }

  if (needs.chatbot) {
    lines.push(
      "",
      "async def wait_for_chatbot_session(input: Any, mode: str = 'until-exit') -> Any:",
      "    if runtime.on_chatbot:",
      "        return await runtime.on_chatbot(input, mode=mode)",
      '    raise NotImplementedError("wire wait_for_chatbot_session or configure_pipeline_runtime(on_chatbot=...)")',
    );
  }

  if (needs.webhook) {
    lines.push(
      "",
      "async def call_webhook(",
      "    input: Any,",
      "    state: PipelineState,",
      "    *,",
      "    url_env: str,",
      '    method: str = "POST",',
      "    auth_env: str | None = None,",
      "    include_state: bool = True,",
      "    response_path: str | None = None,",
      "    timeout_ms: int = 30_000,",
      ") -> Any:",
      "    import json",
      "    import os",
      "    import urllib.request",
      "    url = (os.environ.get(url_env) or '').strip()",
      "    if not url:",
      "        raise RuntimeError(f'set {url_env} in .env')",
      "    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}",
      "    if auth_env:",
      "        auth = (os.environ.get(auth_env) or '').strip()",
      "        if auth:",
      "            headers['Authorization'] = auth if auth.startswith('Bearer ') else f'Bearer {auth}'",
      "    body = {'input': input} if not include_state else {'input': input, 'state': state}",
      "    req = urllib.request.Request(",
      "        url,",
      "        data=json.dumps(body).encode(),",
      "        headers=headers,",
      "        method=method,",
      "    )",
      "    with urllib.request.urlopen(req, timeout=timeout_ms / 1000) as res:",
      "        raw = json.loads(res.read().decode())",
      "    if not response_path:",
      "        return raw",
      "    cur: Any = raw",
      "    for key in response_path.split('.'):",
      "        if not isinstance(cur, dict):",
      "            raise RuntimeError(f'webhook response path failed at {key}')",
      "        cur = cur[key]",
      "    return cur",
    );
  }

  return lines.join("\n");
}

export function generateRuntimeConfigSectionRust(needs: ExportRuntimeNeeds): string {
  const fields: string[] = [];
  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    fields.push(...llmRuntimeFieldsRust());
  }
  if (needs.quote) {
    fields.push("    pub source_text: Option<String>,", "    pub source_doc_id: Option<String>,");
  }
  if (needs.humanReview) {
    fields.push("    // Wire wait_for_human_review below — no callback field in this stub.");
  }
  if (!fields.length) fields.push("    // extend as needed");
  return [
    "// === runtime config (load .env in your runner — pass values here, not in this file) ===",
    "#[derive(Debug, Clone, Default)]",
    "pub struct PipelineRuntime {",
    ...fields,
    "    // AI : TODO export — Supabase persistence / step cache.",
    "}",
    "",
    "static RUNTIME: std::sync::OnceLock<std::sync::Mutex<PipelineRuntime>> = std::sync::OnceLock::new();",
    "",
    "fn runtime() -> std::sync::MutexGuard<'static, PipelineRuntime> {",
    "    RUNTIME",
    "        .get_or_init(|| std::sync::Mutex::new(PipelineRuntime::default()))",
    "        .lock()",
    '        .expect("pipeline runtime lock")',
    "}",
    "",
    "pub fn configure_pipeline_runtime(config: PipelineRuntime) {",
    "    *runtime() = config;",
    "}",
    "",
  ].join("\n");
}

function openRouterHelpersRust(): string[] {
  return [
    'const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";',
    'const DEFAULT_OPENROUTER_MODEL: &str = "deepseek/deepseek-chat";',
    "",
    "fn extract_json_reply(raw: &str) -> String {",
    "    let body = if let Some(start) = raw.find(\"```\") {",
    "        let after = &raw[start + 3..];",
    "        let after = after.strip_prefix(\"json\").unwrap_or(after).trim_start();",
    "        after.split(\"```\").next().unwrap_or(after).trim()",
    "    } else {",
    "        raw.trim()",
    "    };",
    "    let start = body.find(['{', '[']).unwrap_or(0);",
    "    let end = body.rfind(['}', ']']).map(|i| i + 1).unwrap_or(body.len());",
    "    if end > start { body[start..end].to_string() } else { body.to_string() }",
    "}",
    "",
    "async fn open_router_chat(prompt: &str, json_mode: bool) -> anyhow::Result<String> {",
    "    let rt = runtime();",
    "    let key = rt.open_router_api_key.clone().ok_or_else(|| anyhow::anyhow!(\"configure_pipeline_runtime first\"))?;",
    "    let model = rt.open_router_model.clone().unwrap_or_else(|| DEFAULT_OPENROUTER_MODEL.to_string());",
    "    let site = rt.open_router_site_url.clone().unwrap_or_else(|| \"http://localhost:3000\".to_string());",
    "    let title = rt.open_router_app_title.clone().unwrap_or_else(|| \"forge-pipeline-export\".to_string());",
    "    drop(rt);",
    "    let mut payload = serde_json::json!({",
    '        "model": model,',
    '        "messages": [{"role": "user", "content": prompt}],',
    '        "temperature": 0,',
    '        "max_tokens": 8192,',
    '        "provider": {"allow_fallbacks": false},',
    "    });",
    "    if json_mode {",
    '        payload["response_format"] = serde_json::json!({"type": "json_object"});',
    "    }",
    "    let client = reqwest::Client::new();",
    "    let res = client",
    "        .post(OPENROUTER_CHAT_URL)",
    "        .header(\"Authorization\", format!(\"Bearer {}\", key))",
    "        .header(\"HTTP-Referer\", site)",
    "        .header(\"X-Title\", title)",
    "        .json(&payload)",
    "        .send()",
    "        .await?;",
    "    if !res.status().is_success() {",
    "        let status = res.status();",
    "        let text = res.text().await.unwrap_or_default();",
    '        anyhow::bail!("OpenRouter {}: {}", status, text);',
    "    }",
    "    let data: Value = res.json().await?;",
    "    let content = data",
    '        .pointer("/choices/0/message/content")',
    "        .and_then(|v| v.as_str())",
    '        .ok_or_else(|| anyhow::anyhow!("OpenRouter returned no message content"))?;',
    "    Ok(content.to_string())",
    "}",
  ];
}

function llmStructuredStubRust(): string[] {
  return [
    "async fn llm_structured(prompt: &str, schema: &Value) -> anyhow::Result<Value> {",
    "    if runtime().open_router_api_key.is_none() {",
    '        anyhow::bail!("configure_pipeline_runtime(open_router_api_key=...) first");',
    "    }",
    "    let schema_json = serde_json::to_string_pretty(schema)?;",
    "    let base = format!(",
    '        "{}\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n{}",',
    "        prompt, schema_json",
    "    );",
    "    let mut last_error = String::new();",
    "    for attempt in 0..2 {",
    "        let ask = if attempt == 0 {",
    "            base.clone()",
    "        } else {",
    '            format!("{}\\n\\nYour previous reply failed validation:\\n{}\\nReturn corrected JSON only.", base, last_error)',
    "        };",
    "        let raw = open_router_chat(&ask, true).await?;",
    "        let json_text = extract_json_reply(&raw);",
    "        match serde_json::from_str::<Value>(&json_text) {",
    "            Ok(v) => return Ok(v),",
    "            Err(e) => {",
    "                last_error = e.to_string();",
    "                if attempt == 1 {",
    '                    anyhow::bail!("structured response parse failed after retry: {}", last_error);',
    "                }",
    "            }",
    "        }",
    "    }",
    '    anyhow::bail!("structured response failed")',
    "}",
  ];
}

export function generateRuntimeStubsRust(needs: ExportRuntimeNeeds): string {
  const lines = [
    generateRuntimeConfigSectionRust(needs),
    "// --- runtime stubs (replace bodies or inject via configure_pipeline_runtime) ---",
  ];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push("", ...openRouterHelpersRust(), "", ...llmStructuredStubRust());
  }

  if (needs.quote) {
    lines.push(
      "",
      "fn resolve_quotes(data: &impl serde::Serialize, source_text: &str, doc_id: &str) -> anyhow::Result<Value> {",
      "    let rt = runtime();",
      "    let text = rt.source_text.as_deref().unwrap_or(source_text);",
      "    let did = rt.source_doc_id.as_deref().unwrap_or(doc_id);",
      "    if text.is_empty() || did.is_empty() {",
      '        anyhow::bail!("configure_pipeline_runtime(source_text=..., source_doc_id=...) for quote steps");',
      "    }",
      "    let _ = data;",
      '    anyhow::bail!("wire resolve_quotes to your quote linker")',
      "}",
    );
  }

  if (needs.humanReview) {
    lines.push(
      "",
      "async fn wait_for_human_review<T: serde::Serialize>(_input: &T) -> anyhow::Result<()> {",
      '    anyhow::bail!("wire wait_for_human_review")',
      "}",
    );
  }

  if (needs.chatbot) {
    lines.push(
      "",
      "async fn wait_for_chatbot_session<T: serde::Serialize>(_input: &T) -> anyhow::Result<serde_json::Value> {",
      '    anyhow::bail!("wire wait_for_chatbot_session")',
      "}",
    );
  }

  if (needs.webhook) {
    lines.push(
      "",
      "async fn call_webhook(_input: &serde_json::Value, _state: &PipelineState) -> anyhow::Result<serde_json::Value> {",
      '    anyhow::bail!("wire call_webhook — set WEBHOOK_URL_* env vars and HTTP client")',
      "}",
    );
  }

  return lines.join("\n");
}

export function generateRuntimeConfigSectionGo(needs: ExportRuntimeNeeds): string {
  const fields: string[] = [];
  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    fields.push(...llmRuntimeFieldsGo());
  }
  if (needs.quote) {
    fields.push("\tSourceText  string", "\tSourceDocID string");
  }
  if (needs.humanReview) {
    fields.push("\t// Wire WaitForHumanReview below — no callback field in this stub.");
  }
  if (!fields.length) fields.push("\t// extend as needed");
  return [
    "// === runtime config (load .env in your runner — pass values here, not in this file) ===",
    "type PipelineRuntime struct {",
    ...fields,
    "\t// AI : TODO export — Supabase persistence / step cache.",
    "}",
    "",
    "var (",
    "\truntimeMu sync.Mutex",
    "\truntimeCfg PipelineRuntime",
    ")",
    "",
    "func ConfigurePipelineRuntime(config PipelineRuntime) {",
    "\truntimeMu.Lock()",
    "\tdefer runtimeMu.Unlock()",
    "\truntimeCfg = config",
    "}",
    "",
    "func currentRuntime() PipelineRuntime {",
    "\truntimeMu.Lock()",
    "\tdefer runtimeMu.Unlock()",
    "\treturn runtimeCfg",
    "}",
    "",
  ].join("\n");
}

function openRouterHelpersGo(): string[] {
  return [
    'const openRouterChatURL = "https://openrouter.ai/api/v1/chat/completions"',
    'const defaultOpenRouterModel = "deepseek/deepseek-chat"',
    "",
    "func extractJSONReply(raw string) string {",
    "\tbody := strings.TrimSpace(raw)",
    '\tif i := strings.Index(body, "```"); i >= 0 {',
    "\t\tafter := body[i+3:]",
    '\t\tafter = strings.TrimPrefix(after, "json")',
    "\t\tafter = strings.TrimSpace(after)",
    '\t\tif j := strings.Index(after, "```"); j >= 0 {',
    "\t\t\tafter = after[:j]",
    "\t\t}",
    "\t\tbody = strings.TrimSpace(after)",
    "\t}",
    '	start := strings.IndexAny(body, "{[")',
    "\tif start < 0 {",
    "\t\tstart = 0",
    "\t}",
    '	end := strings.LastIndexAny(body, "}]")',
    "\tif end >= start {",
    "\t\treturn body[start : end+1]",
    "\t}",
    "\treturn body",
    "}",
    "",
    "func openRouterChat(prompt string, jsonMode bool) (string, error) {",
    "\trt := currentRuntime()",
    '\tif rt.OpenRouterAPIKey == "" {',
    '\t\treturn "", fmt.Errorf("ConfigurePipelineRuntime first")',
    "\t}",
    "\tmodel := rt.OpenRouterModel",
    '\tif model == "" {',
    "\t\tmodel = defaultOpenRouterModel",
    "\t}",
    "\tsite := rt.OpenRouterSiteURL",
    '\tif site == "" {',
    '\t\tsite = "http://localhost:3000"',
    "\t}",
    "\ttitle := rt.OpenRouterAppTitle",
    '\tif title == "" {',
    '\t\ttitle = "forge-pipeline-export"',
    "\t}",
    "\tpayload := map[string]any{",
    '\t\t"model": model,',
    '\t\t"messages": []map[string]string{{"role": "user", "content": prompt}},',
    '\t\t"temperature": 0,',
    '\t\t"max_tokens": 8192,',
    '\t\t"provider": map[string]any{"allow_fallbacks": false},',
    "\t}",
    "\tif jsonMode {",
    '\t\tpayload["response_format"] = map[string]string{"type": "json_object"}',
    "\t}",
    "\tbody, err := json.Marshal(payload)",
    "\tif err != nil {",
    '\t\treturn "", err',
    "\t}",
    "\treq, err := http.NewRequest(http.MethodPost, openRouterChatURL, bytes.NewReader(body))",
    "\tif err != nil {",
    '\t\treturn "", err',
    "\t}",
    '\treq.Header.Set("Authorization", "Bearer "+rt.OpenRouterAPIKey)',
    '\treq.Header.Set("HTTP-Referer", site)',
    '\treq.Header.Set("X-Title", title)',
    '\treq.Header.Set("Content-Type", "application/json")',
    "\tres, err := http.DefaultClient.Do(req)",
    "\tif err != nil {",
    '\t\treturn "", err',
    "\t}",
    "\tdefer res.Body.Close()",
    "\trespBody, err := io.ReadAll(res.Body)",
    "\tif err != nil {",
    '\t\treturn "", err',
    "\t}",
    "\tif res.StatusCode < 200 || res.StatusCode >= 300 {",
    '\t\treturn "", fmt.Errorf("OpenRouter %s: %s", res.Status, string(respBody))',
    "\t}",
    "\tvar data map[string]any",
    "\tif err := json.Unmarshal(respBody, &data); err != nil {",
    '\t\treturn "", err',
    "\t}",
    '\tchoices, _ := data["choices"].([]any)',
    "\tif len(choices) == 0 {",
    '\t\treturn "", fmt.Errorf("OpenRouter returned no message content")',
    "\t}",
    "\tchoice, _ := choices[0].(map[string]any)",
    '\tmsg, _ := choice["message"].(map[string]any)',
    '\tcontent, _ := msg["content"].(string)',
    '\tif content == "" {',
    '\t\treturn "", fmt.Errorf("OpenRouter returned no message content")',
    "\t}",
    "\treturn content, nil",
    "}",
  ];
}

function llmStructuredStubGo(): string[] {
  return [
    "func llmStructured(prompt string, schema json.RawMessage) (json.RawMessage, error) {",
    '\tif currentRuntime().OpenRouterAPIKey == "" {',
    '\t\treturn nil, fmt.Errorf("ConfigurePipelineRuntime(OpenRouterAPIKey=...) first")',
    "\t}",
    "\tvar pretty any",
    "\t_ = json.Unmarshal(schema, &pretty)",
    '\tschemaJSON, _ := json.MarshalIndent(pretty, "", "  ")',
    "\tif len(schemaJSON) == 0 {",
    '\t\tschemaJSON = []byte("{}")',
    "\t}",
    '\tbase := prompt + "\\n\\nRespond with ONLY a JSON value that validates against this JSON Schema:\\n" + string(schemaJSON)',
    "\tvar lastError string",
    "\tfor attempt := 0; attempt < 2; attempt++ {",
    "\t\task := base",
    "\t\tif attempt > 0 {",
    '\t\t\task = base + "\\n\\nYour previous reply failed validation:\\n" + lastError + "\\nReturn corrected JSON only."',
    "\t\t}",
    "\t\traw, err := openRouterChat(ask, true)",
    "\t\tif err != nil {",
    "\t\t\treturn nil, err",
    "\t\t}",
    "\t\tjsonText := extractJSONReply(raw)",
    "\t\tif json.Valid([]byte(jsonText)) {",
    "\t\t\treturn json.RawMessage(jsonText), nil",
    "\t\t}",
    '\t\tlastError = "invalid JSON"',
    "\t\tif attempt == 1 {",
    '\t\t\treturn nil, fmt.Errorf("structured response parse failed after retry: %s", lastError)',
    "\t\t}",
    "\t}",
    '\treturn nil, fmt.Errorf("structured response failed")',
    "}",
  ];
}

export function generateRuntimeStubsGo(needs: ExportRuntimeNeeds): string {
  const lines = [
    generateRuntimeConfigSectionGo(needs),
    "// --- runtime stubs (replace bodies or inject via ConfigurePipelineRuntime) ---",
  ];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push("", ...openRouterHelpersGo(), "", ...llmStructuredStubGo());
  }

  if (needs.quote) {
    lines.push(
      "",
      "func resolveQuotes(data any, sourceText, docID string) (json.RawMessage, error) {",
      "\trt := currentRuntime()",
      "\ttext := rt.SourceText",
      '\tif text == "" {',
      "\t\ttext = sourceText",
      "\t}",
      "\tdid := rt.SourceDocID",
      '\tif did == "" {',
      "\t\tdid = docID",
      "\t}",
      '\tif text == "" || did == "" {',
      '\t\treturn nil, fmt.Errorf("ConfigurePipelineRuntime(SourceText=..., SourceDocID=...) for quote steps")',
      "\t}",
      "\t_ = data",
      '\treturn nil, fmt.Errorf("wire resolveQuotes to your quote linker")',
      "}",
    );
  }

  if (needs.humanReview) {
    lines.push(
      "",
      "func WaitForHumanReview(_input any) error {",
      '\treturn fmt.Errorf("wire WaitForHumanReview")',
      "}",
    );
  }

  if (needs.chatbot) {
    lines.push(
      "",
      "func WaitForChatbotSession(_input any) (any, error) {",
      '\treturn nil, fmt.Errorf("wire WaitForChatbotSession")',
      "}",
    );
  }

  if (needs.webhook) {
    lines.push(
      "",
      "type WebhookOpts struct {",
      "\tURLEnv       string",
      "\tMethod       string",
      "\tAuthEnv      string",
      "\tIncludeState bool",
      "\tResponsePath string",
      "\tTimeoutMs    int",
      "}",
      "",
      "func CallWebhook(_input any, _state PipelineState, _opts WebhookOpts) (json.RawMessage, error) {",
      '\treturn nil, fmt.Errorf("wire CallWebhook — set WEBHOOK_URL_* env vars")',
      "}",
    );
  }

  return lines.join("\n");
}

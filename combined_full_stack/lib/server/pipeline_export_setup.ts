import { orderedInputModules } from "@/lib/inference-input";
import { labelAsStateKey } from "./pipeline_state";
import { ModuleKind } from "./types";
import type { PipelineModule, Project } from "./types";

export type ExportRuntimeNeeds = {
  llm: boolean;
  llmBatch: boolean;
  quote: boolean;
  humanReview: boolean;
  visionOcr: boolean;
  inputModules: { label: string; filenameHint?: string; inputType?: string }[];
};

export type PipelineSetupFile = {
  filename: string;
  content: string;
  mime: string;
};

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
  let visionOcr = false;
  for (const m of project.modules) {
    if (m.kind === ModuleKind.Llm) llm = true;
    if (m.kind === ModuleKind.LlmBatch) llmBatch = true;
    if (m.kind === ModuleKind.Quote) quote = true;
    if (m.kind === ModuleKind.HumanReview) humanReview = true;
    if (m.kind === ModuleKind.Input && m.useOcr) visionOcr = true;
  }
  return { llm, llmBatch, quote, humanReview, visionOcr, inputModules };
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
      "# LLM inference (OpenRouter-compatible API)",
      'OPENROUTER_API_KEY=""',
      'OPENROUTER_SITE_URL="http://localhost:3000"',
      'OPENROUTER_APP_TITLE=""',
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

  lines.push(
    "# Optional — only if you persist runs/docs outside this export",
    '# NEXT_PUBLIC_SUPABASE_URL=""',
    '# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""',
    '# SUPABASE_SERVICE_ROLE_KEY=""',
    "",
    "# Optional — billing UI in the full Forge app (not required for pipeline-only runs)",
    '# NEXT_PUBLIC_STRIPE_ENABLED="false"',
    '# STRIPE_SECRET_KEY=""',
    "",
  );

  return lines.join("\n");
}

export function generateSetupReadme(project: Project, slug: string): string {
  const needs = analyzeExportRuntimeNeeds(project);
  const lines = [
    `# ${project.name} — exported pipeline setup`,
    "",
    "This folder was generated from Forge. Wire the runtime stubs, then run the orchestrator.",
    "",
    "## Files",
    "",
    `- \`${slug}_pipeline.ts\` — TypeScript types, steps, orchestrator`,
    `- \`${slug}_pipeline.py\` — Python models, steps, orchestrator`,
    "- `.env.example` — copy to `.env` and fill in (never commit real secrets)",
    "- `requirements.txt` — Python deps (`pip install -r requirements.txt`)",
    "- `SETUP.md` — this file",
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
  ];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push(
      "## 2. LLM",
      "",
      "Wire `configurePipelineRuntime({ openRouterApiKey })` (or Python equivalent) — `llmStructured` calls OpenRouter by default.",
      "Override the model via `openRouterModel` in runtime config, or edit step bodies to pass a different slug.",
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
      "Each input step expects `{ content: string, filename: string }` (read file text into `content`).",
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
  const lines = ["# Python pipeline runner", "pydantic>=2", "python-dotenv>=1"];
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
    "    data = res.json()",
    '    content = (data.get("choices") or [{}])[0].get("message", {}).get("content")',
    "    if not content:",
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

export function generatePipelineSetupFiles(project: Project): PipelineSetupFile[] {
  // AI : TODO export — add run_example.ts / run_example.py that load .env and read input docs.
  // AI : TODO export — full-stack bundle (Supabase SQL, Next.js inference UI) per spec.
  const slug = projectSlug(project.name);
  const needs = analyzeExportRuntimeNeeds(project);
  const envExample = generateEnvExample(project);
  const setupMd = generateSetupReadme(project, slug);
  const requirements = generateRequirementsTxt(needs);
  assertNoSecretValuesInExport(envExample);
  assertNoSecretValuesInExport(setupMd);
  assertNoSecretValuesInExport(requirements);
  return [
    { filename: ".env.example", content: envExample, mime: "text/plain" },
    { filename: "SETUP.md", content: setupMd, mime: "text/markdown" },
    { filename: "requirements.txt", content: requirements, mime: "text/plain" },
  ];
}

export function generateRuntimeConfigSectionTs(needs: ExportRuntimeNeeds): string {
  const lines = [
    "// === runtime config (load .env in your runner — pass values here, not in this file) ===",
    "export type PipelineRuntime = {",
    ...(needs.llm || needs.llmBatch || needs.visionOcr
      ? ["  openRouterApiKey?: string;", "  openRouterModel?: string;", "  openRouterSiteUrl?: string;", "  openRouterAppTitle?: string;"]
      : []),
    ...(needs.quote ? ["  sourceText?: string;", "  sourceDocId?: string;"] : []),
    ...(needs.humanReview ? ["  onHumanReview?: <T>(input: T) => Promise<void>;"] : []),
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
      ...openRouterHelpersTs(),
      "",
      ...llmStructuredStubTs(),
      "",
      "async function llmBatchStructured<T>(",
      "  items: unknown[],",
      "  promptFor: (item: unknown) => string,",
      "  schema: unknown,",
      "): Promise<T[]> {",
      "  return Promise.all(items.map((item) => llmStructured<T>(promptFor(item), schema)));",
      "}",
    );
  }

  if (needs.quote) {
    lines.push(
      "",
      "function resolveQuotes<T>(data: unknown, _sourceText: string, _docId: string): T {",
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

  return lines.join("\n");
}

export function generateRuntimeConfigSectionPy(needs: ExportRuntimeNeeds): string {
  const lines = [
    "# === runtime config (load .env in your runner — pass values here, not in this file) ===",
    "from dataclasses import dataclass",
    "",
    "@dataclass",
    "class PipelineRuntime:",
  ];
  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push(
      "    open_router_api_key: str | None = None",
      "    open_router_model: str | None = None",
      "    open_router_site_url: str | None = None",
      "    open_router_app_title: str | None = None",
    );
  }
  if (needs.quote) {
    lines.push("    source_text: str | None = None", "    source_doc_id: str | None = None");
  }
  if (needs.humanReview) {
    lines.push("    on_human_review: Any = None  # async callable(input) -> None");
  }
  lines.push("", "runtime = PipelineRuntime()", "", "def configure_pipeline_runtime(**kwargs: Any) -> None:", "    global runtime", "    for k, v in kwargs.items():", "        if hasattr(runtime, k):", "            setattr(runtime, k, v)", "");
  return lines.join("\n");
}

export function generateRuntimeStubsPy(needs: ExportRuntimeNeeds): string {
  const lines = [generateRuntimeConfigSectionPy(needs), "# --- runtime stubs (replace bodies or inject via configure_pipeline_runtime) ---"];

  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    lines.push(
      "",
      ...openRouterHelpersPy(),
      "",
      ...llmStructuredStubPy(),
      "",
      "async def llm_batch_structured(",
      "    items: list[Any],",
      "    prompt_for: Any,",
      "    schema: Any,",
      ") -> list[Any]:",
      "    return [await llm_structured(prompt_for(item), schema) for item in items]",
    );
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

  return lines.join("\n");
}

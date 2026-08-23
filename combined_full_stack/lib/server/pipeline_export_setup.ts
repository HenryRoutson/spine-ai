// AI : zip extras (.env, README, runners). Runtime libraries are copied on the server (pipeline_export_runtime_files).
import { orderedInputModules } from "@/lib/inference-input";
import { labelAsStateKey } from "./pipeline_state";
import type { PipelineSetupFile } from "./pipeline_export_shared";
import { generatePipelineRunnerFiles } from "./pipeline_export_runners";
import { ModuleKind } from "./types";
import { isMergeModuleKind } from "@/lib/module-kinds";
import type { Project } from "./types";
import { flattenPipelineModules } from "@/lib/fork-pipeline";
import { collectWebhookExportEnvKeys } from "@/lib/webhook-step";

export type ExportRuntimeNeeds = {
  llm: boolean;
  llmBatch: boolean;
  exampleSelect: boolean;
  merge: boolean;
  quote: boolean;
  humanReview: boolean;
  chatbot: boolean;
  webhook: boolean;
  visionOcr: boolean;
  docToText: boolean;
  inputModules: { label: string; filenameHint?: string; inputType?: string }[];
  webhookEnvKeys: { label: string; envKey: string; authEnv?: string; optional?: boolean }[];
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
  let exampleSelect = false;
  let merge = false;
  let quote = false;
  let humanReview = false;
  let chatbot = false;
  let webhook = false;
  let visionOcr = false;
  let docToText = false;
  for (const m of flattenPipelineModules(project.modules)) {
    if (m.kind === ModuleKind.Llm) llm = true;
    // AI : example-select uses llmBatchStructured — treat like llm-batch for stub inclusion.
    if (m.kind === ModuleKind.LlmBatch || m.kind === ModuleKind.ExampleSelect) llmBatch = true;
    if (m.kind === ModuleKind.ExampleSelect) exampleSelect = true;
    if (isMergeModuleKind(m.kind) && !m.mergeCustom?.trim()) merge = true;
    if (m.kind === ModuleKind.Fork && m.forkJoin === "merge") merge = true;
    if (m.kind === ModuleKind.Quote) quote = true;
    if (m.kind === ModuleKind.HumanReview) humanReview = true;
    if (m.kind === ModuleKind.Chatbot) chatbot = true;
    if (m.kind === ModuleKind.Webhook) webhook = true;
    if (m.kind === ModuleKind.DocToText) docToText = true;
    if (m.kind === ModuleKind.DocToText && m.useOcr) visionOcr = true;
  }
  return {
    llm,
    llmBatch,
    exampleSelect,
    merge,
    quote,
    humanReview,
    chatbot,
    webhook,
    visionOcr,
    docToText,
    inputModules,
    webhookEnvKeys: collectWebhookExportEnvKeys(flattenPipelineModules(project.modules)),
  };
}

export function projectSlug(name: string): string {
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
      'OPENROUTER_SEED=""',
      'OPENROUTER_SITE_URL="http://localhost:3000"',
      'OPENROUTER_APP_TITLE=""',
      "# Custom / enterprise provider (when LLM_PROVIDER is not openrouter)",
      'CUSTOM_LLM_PROVIDER_ID="custom"',
      'CUSTOM_LLM_API_URL=""',
      'CUSTOM_LLM_API_KEY=""',
      "",
    );
  }

  if (needs.docToText) {
    lines.push(
      "# Convert to text — directory of original files (read by filename, not stored on Document)",
      'PIPELINE_DOCS_DIR="docs"',
      "",
    );
  }

  if (needs.visionOcr) {
    lines.push(
      "# DeepSeek-OCR-2 (vLLM OpenAI-compatible). Leave empty to fall back to OpenRouter vision.",
      'DEEPSEEK_OCR_BASE_URL=""',
      'DEEPSEEK_OCR_MODEL="deepseek-ai/DeepSeek-OCR-2"',
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
      lines.push(`# Step "${w.label}"${w.optional ? " (optional — public default in generated code)" : ""}`);
      lines.push(`${w.envKey}=""`);
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
    "- `pipeline_runtime.ts` / `.py` / `.go` / `.rs` — shared runtime library (LLM, merge, example-select) — written once, not generated",
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
      "## Convert to text / DeepSeek OCR",
      "",
      "PDF/Word/image inputs emit Document with `content=None`. The locked **Convert to text** step instantiates `content` from files in `docsDir` (default `./docs`) — it does **not** put base64 on Document.",
      "OCR mode calls DeepSeek-OCR-2 via a vLLM OpenAI-compatible endpoint (`DEEPSEEK_OCR_BASE_URL`, model `deepseek-ai/DeepSeek-OCR-2`).",
      "If that URL is unset, the helper falls back to OpenRouter multimodal (Gemini Flash). Transcribed text is cached in memory by file hash.",
      "",
      "Parser mode reads UTF-8 from the file (PDF.js already ran at upload in the hosted app; export expects text or OCR).",
      "",
    );
  } else if (needs.docToText) {
    lines.push(
      "## Convert to text",
      "",
      "Set `docsDir` / `docs_dir` so Convert to text can read originals by filename. Document on the spine stays `{ filename, content }` — never encoded file bytes.",
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
      needs.docToText
        ? "Each input step expects `{ filename, content? }`. Convert to text reads originals from `docsDir` by filename — do not put base64 on Document."
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

import { orderedInputModules } from "@/lib/inference-input";
import { inputTypeLabel } from "@/lib/inference-input-core";
import { labelAsStateKey } from "./pipeline_state";
import { analyzeExportRuntimeNeeds } from "./pipeline_export_setup";
import type { PipelineSetupFile } from "./pipeline_export_shared";
import type { Project } from "./types";

// AI : TODO export connector — Supabase bundle in export (migrations SQL, RLS, runs/docs tables).
// AI : TODO export connector — step I/O cache via PIPELINE_CACHE_URL (Redis or Supabase storage).

function projectSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pipeline"
  );
}

// AI : shared gRPC + HTTP JSON contract — same messages for TS and Python backends.
export function generateConnectorProto(project: Project): string {
  const needs = analyzeExportRuntimeNeeds(project);
  const inputComments = needs.inputModules
    .map((i) => `  // input slot: ${i.label}${i.inputType ? ` (${i.inputType})` : ""}`)
    .join("\n");

  return [
    'syntax = "proto3";',
    "",
    "package forge.pipeline;",
    "",
    "// Generated from Spine — language-neutral connector for exported pipeline runners.",
    `// Project: ${project.name}`,
    "",
    "message Document {",
    "  string content = 1;",
    "  string filename = 2;",
    "}",
    "",
    "message InputSlot {",
    "  string label = 1;",
    "  Document document = 2;",
    "}",
    "",
    "message RunPipelineRequest {",
    "  Document initial_input = 1;",
    "  repeated InputSlot inputs = 2;",
    inputComments || "  // no input modules",
    "}",
    "",
    "message RunPipelineResponse {",
    "  string result_json = 1;",
    "  string error = 2;",
    "}",
    "",
    "message HealthRequest {}",
    "",
    "message HealthResponse {",
    '  string status = 1;  // "ok"',
    "}",
    "",
    "service PipelineConnector {",
    "  rpc RunPipeline(RunPipelineRequest) returns (RunPipelineResponse);",
    "  rpc Health(HealthRequest) returns (HealthResponse);",
    "}",
    "",
  ].join("\n");
}

function httpRunHandlerTs(slug: string, multi: boolean): string {
  if (multi) {
    return [
      "  const inputs: Record<string, { content: string; filename: string }> = {};",
      "  for (const slot of body.inputs ?? []) {",
      "    if (slot?.label && slot.document) inputs[slot.label] = slot.document;",
      "  }",
      "  const result = await runPipeline(inputs);",
    ].join("\n");
  }
  return [
    "  const doc = body.initialInput ?? body.initial_input;",
    '  if (!doc?.content) throw new Error("initialInput.content required");',
    "  const result = await runPipeline(doc);",
  ].join("\n");
}

function grpcRunHandlerTs(multi: boolean): string {
  if (multi) {
    return [
      "  const inputs: Record<string, { content: string; filename: string }> = {};",
      "  for (const slot of call.request.inputs ?? []) {",
      "    if (slot?.label && slot.document) inputs[slot.label] = slot.document;",
      "  }",
      "  const result = await runPipeline(inputs);",
    ].join("\n");
  }
  return [
    "  const doc = call.request.initialInput ?? call.request.initial_input;",
    '  if (!doc?.content) return cb({ code: grpc.status.INVALID_ARGUMENT, message: "initialInput.content required" });',
    "  const result = await runPipeline(doc);",
  ].join("\n");
}

export function generateConnectorServerTs(project: Project, slug: string): string {
  const inputMods = orderedInputModules(project.modules);
  const multi = inputMods.length > 1;

  return [
    "// Generated Spine pipeline connector — gRPC + HTTP JSON on the same contract.",
    "// AI : TODO — persist run + step outputs to Supabase when NEXT_PUBLIC_SUPABASE_URL is set.",
    "// AI : TODO — cache LLM step I/O via PIPELINE_CACHE_URL before invoking runPipeline.",
    "// npm install @grpc/grpc-js @grpc/proto-loader dotenv",
    'import "dotenv/config";',
    "import * as grpc from '@grpc/grpc-js';",
    "import * as protoLoader from '@grpc/proto-loader';",
    "import { createServer } from 'node:http';",
    `import { configurePipelineRuntime, runPipeline, getLastRunTrace } from './${slug}_pipeline';`,
    "",
    "const PROTO_PATH = new URL('./pipeline_connector.proto', import.meta.url).pathname;",
    "const GRPC_PORT = process.env.PIPELINE_GRPC_PORT ?? '50051';",
    "const HTTP_PORT = process.env.PIPELINE_HTTP_PORT ?? '8080';",
    "",
    "configurePipelineRuntime({",
    "  openRouterApiKey: process.env.OPENROUTER_API_KEY,",
    "  openRouterModel: process.env.OPENROUTER_MODEL,",
    "  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL,",
    "  openRouterAppTitle: process.env.OPENROUTER_APP_TITLE,",
    "  sourceText: process.env.PIPELINE_SOURCE_TEXT,",
    "  sourceDocId: process.env.PIPELINE_SOURCE_DOC_ID,",
    "});",
    "",
    "async function executeRun(body: Record<string, unknown>): Promise<{ resultJson: string; stepTrace: unknown[] }> {",
    httpRunHandlerTs(slug, multi),
    "  return {",
    "    resultJson: JSON.stringify(result, null, 2),",
    "    stepTrace: getLastRunTrace(),",
    "  };",
    "}",
    "",
    "const packageDefinition = protoLoader.loadSync(PROTO_PATH, {",
    "  keepCase: true,",
    "  longs: String,",
    "  enums: String,",
    "  defaults: true,",
    "  oneofs: true,",
    "});",
    "const proto = grpc.loadPackageDefinition(packageDefinition) as grpc.GrpcObject;",
    "const connector = (proto.forge as grpc.GrpcObject).pipeline as grpc.GrpcObject;",
    "",
    "const serviceImpl = {",
    "  RunPipeline: async (",
    "    call: grpc.ServerUnaryCall<Record<string, unknown>, { result_json?: string; error?: string }>,",
    "    cb: grpc.sendUnaryData<{ result_json?: string; error?: string }>,",
    "  ) => {",
    "    try {",
    grpcRunHandlerTs(multi),
    "      cb(null, { result_json: JSON.stringify(result, null, 2) });",
    "    } catch (e) {",
    "      cb(null, { error: (e as Error).message });",
    "    }",
    "  },",
    "  Health: (_call: grpc.ServerUnaryCall<object, { status: string }>, cb: grpc.sendUnaryData<{ status: string }>) => {",
    '    cb(null, { status: "ok" });',
    "  },",
    "};",
    "",
    "const server = new grpc.Server();",
    "server.addService(connector.PipelineConnector.service, serviceImpl);",
    "server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {",
    "  if (err) throw err;",
    "  server.start();",
    "  console.log(`gRPC PipelineConnector on :${port}`);",
    "});",
    "",
    "createServer(async (req, res) => {",
    "  if (req.method === 'GET' && req.url === '/health') {",
    '    res.writeHead(200, { "Content-Type": "application/json" });',
    '    res.end(JSON.stringify({ status: "ok" }));',
    "    return;",
    "  }",
    "  if (req.method === 'POST' && req.url === '/v1/run') {",
    "    const chunks: Buffer[] = [];",
    "    for await (const chunk of req) chunks.push(chunk as Buffer);",
    "    try {",
    "      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;",
    "      const payload = await executeRun(body);",
    '      res.writeHead(200, { "Content-Type": "application/json" });',
    "      res.end(JSON.stringify(payload));",
    "    } catch (e) {",
    '      res.writeHead(500, { "Content-Type": "application/json" });',
    "      res.end(JSON.stringify({ error: (e as Error).message }));",
    "    }",
    "    return;",
    "  }",
    "  res.writeHead(404);",
    "  res.end();",
    "}).listen(Number(HTTP_PORT), () => {",
    "  console.log(`HTTP JSON bridge on :${HTTP_PORT} (POST /v1/run)`);",
    "});",
    "",
  ].join("\n");
}

function httpRunHandlerPy(multi: boolean): string {
  if (multi) {
    return [
      "    inputs = {",
      "        slot['label']: slot['document']",
      "        for slot in (body.get('inputs') or [])",
      "        if slot.get('label') and slot.get('document')",
      "    }",
      "    result = await run_pipeline(inputs)",
    ].join("\n");
  }
  return [
    "    doc = body.get('initialInput') or body.get('initial_input')",
    "    if not doc or not doc.get('content'):",
    '        raise ValueError("initialInput.content required")',
    "    result = await run_pipeline(doc)",
  ].join("\n");
}

function grpcRunHandlerPy(multi: boolean): string {
  if (multi) {
    return [
      "            inputs = {",
      "                slot.label: {'content': slot.document.content, 'filename': slot.document.filename}",
      "                for slot in request.inputs",
      "                if slot.label and slot.document",
      "            }",
      "            result = await run_pipeline(inputs)",
    ].join("\n");
  }
  return [
    "            doc = request.initial_input",
    "            if not doc or not doc.content:",
    '                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)',
    '                context.set_details("initialInput.content required")',
    "                return pipeline_connector_pb2.RunPipelineResponse(error='initialInput.content required')",
    "            result = await run_pipeline({'content': doc.content, 'filename': doc.filename})",
  ].join("\n");
}

export function generateConnectorServerPy(project: Project, slug: string): string {
  const inputMods = orderedInputModules(project.modules);
  const multi = inputMods.length > 1;

  return [
    '# Generated Spine pipeline connector — gRPC + HTTP JSON on the same contract.',
    "# AI : TODO — persist run + step outputs to Supabase when NEXT_PUBLIC_SUPABASE_URL is set.",
    "# AI : TODO — cache LLM step I/O via PIPELINE_CACHE_URL before invoking run_pipeline.",
    "# pip install grpcio grpcio-tools python-dotenv httpx",
    "from __future__ import annotations",
    "",
    "import asyncio",
    "import json",
    "import os",
    "from concurrent import futures",
    "",
    "import grpc",
    "from dotenv import load_dotenv",
    "",
    "load_dotenv()",
    "",
    "# After: python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. pipeline_connector.proto",
    "import pipeline_connector_pb2",
    "import pipeline_connector_pb2_grpc",
    "",
    `from ${slug}_pipeline import configure_pipeline_runtime, get_last_run_trace, run_pipeline`,
    "",
    'GRPC_PORT = os.environ.get("PIPELINE_GRPC_PORT", "50051")',
    'HTTP_PORT = int(os.environ.get("PIPELINE_HTTP_PORT", "8080"))',
    "",
    "configure_pipeline_runtime(",
    "    open_router_api_key=os.environ.get('OPENROUTER_API_KEY'),",
    "    open_router_model=os.environ.get('OPENROUTER_MODEL'),",
    "    open_router_site_url=os.environ.get('OPENROUTER_SITE_URL'),",
    "    open_router_app_title=os.environ.get('OPENROUTER_APP_TITLE'),",
    "    source_text=os.environ.get('PIPELINE_SOURCE_TEXT'),",
    "    source_doc_id=os.environ.get('PIPELINE_SOURCE_DOC_ID'),",
    ")",
    "",
    "",
    "async def execute_run(body: dict) -> dict:",
    httpRunHandlerPy(multi),
    "    return {",
    '        "resultJson": json.dumps(result, indent=2),',
    '        "stepTrace": get_last_run_trace(),',
    "    }",
    "",
    "",
    "class PipelineConnectorServicer(pipeline_connector_pb2_grpc.PipelineConnectorServicer):",
    "    async def RunPipeline(self, request, context):",
    "        try:",
    grpcRunHandlerPy(multi),
    "            return pipeline_connector_pb2.RunPipelineResponse(result_json=json.dumps(result, indent=2))",
    "        except Exception as e:",
    "            return pipeline_connector_pb2.RunPipelineResponse(error=str(e))",
    "",
    "    async def Health(self, request, context):",
    '        return pipeline_connector_pb2.HealthResponse(status="ok")',
    "",
    "",
    "async def handle_http(reader, writer):",
    "    data = await reader.read(10_000_000)",
    "    line = data.decode('utf8', errors='replace').split('\\r\\n', 1)[0]",
    "    headers_raw, _, body_raw = data.decode('utf8', errors='replace').partition('\\r\\n\\r\\n')",
    "    first = headers_raw.split('\\r\\n')[0]",
    "    if first.startswith('GET /health'):",
    '        writer.write(b"HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\n\\r\\n{\\"status\\":\\"ok\\"}")',
    "        await writer.drain()",
    "        writer.close()",
    "        return",
    "    if first.startswith('POST /v1/run'):",
    "        try:",
    "            body = json.loads(body_raw or '{}')",
    "            payload = await execute_run(body)",
    '            body = json.dumps({"resultJson": payload["resultJson"], "stepTrace": payload["stepTrace"]}).encode()',
    '            writer.write(b"HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\nContent-Length: " + str(len(body)).encode() + b"\\r\\n\\r\\n" + body)',
    "        except Exception as e:",
    '            payload = json.dumps({"error": str(e)}).encode()',
    '            writer.write(b"HTTP/1.1 500 Internal Server Error\\r\\nContent-Type: application/json\\r\\nContent-Length: " + str(len(payload)).encode() + b"\\r\\n\\r\\n" + payload)',
    "        await writer.drain()",
    "        writer.close()",
    "        return",
    "    writer.write(b'HTTP/1.1 404 Not Found\\r\\n\\r\\n')",
    "    await writer.drain()",
    "    writer.close()",
    "",
    "",
    "async def main() -> None:",
    "    server = grpc.aio.server()",
    "    pipeline_connector_pb2_grpc.add_PipelineConnectorServicer_to_server(PipelineConnectorServicer(), server)",
    "    server.add_insecure_port(f'[::]:{GRPC_PORT}')",
    "    await server.start()",
    '    print(f"gRPC PipelineConnector on :{GRPC_PORT}")',
    "",
    "    http_server = await asyncio.start_server(handle_http, '0.0.0.0', HTTP_PORT)",
    '    print(f"HTTP JSON bridge on :{HTTP_PORT} (POST /v1/run)")',
    "    async with http_server:",
    "        await http_server.serve_forever()",
    "",
    "",
    'if __name__ == "__main__":',
    "    asyncio.run(main())",
    "",
  ].join("\n");
}

function inputSlotHtml(project: Project): string {
  const inputMods = orderedInputModules(project.modules);
  return inputMods
    .map((m) => {
      const label = labelAsStateKey(m.label);
      const typeLabel = inputTypeLabel(m.inputType);
      const nameHint = m.inputNameContains?.trim();
      return [
        `<section class="card input-slot" data-label="${label}">`,
        `  <header><strong>${m.label}</strong><span class="badge">${typeLabel}</span>${nameHint ? `<span class="badge muted">name ∋ "${nameHint}"</span>` : ""}</header>`,
        `  <input type="file" class="file-input" data-label="${label}" />`,
        `  <p class="file-name muted" data-label="${label}">No file selected</p>`,
        `</section>`,
      ].join("\n");
    })
    .join("\n");
}

function buildRunPayloadJs(multi: boolean, inputMods: ReturnType<typeof orderedInputModules>): string {
  if (multi) {
    const slots = inputMods
      .map((m) => {
        const label = labelAsStateKey(m.label);
        return `{ label: ${JSON.stringify(label)}, document: slots[${JSON.stringify(label)}] }`;
      })
      .join(",\n      ");
    return `{ inputs: [\n      ${slots}\n    ] }`;
  }
  return "{ initialInput: slots.__single__ }";
}

export function generateInferenceUiHtml(project: Project): string {
  const inputMods = orderedInputModules(project.modules);
  const multi = inputMods.length > 1;
  const runPayload = buildRunPayloadJs(multi, inputMods);
  const stepLabels = project.modules.map((m) => labelAsStateKey(m.label)).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${project.name} — inference</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: hsl(240 10% 3.9%);
      --card: hsl(240 6% 6%);
      --border: hsl(240 3.7% 15.9%);
      --fg: hsl(0 0% 98%);
      --muted: hsl(240 5% 64.9%);
      --primary: hsl(0 0% 98%);
      --destructive: hsl(0 62.8% 50%);
      --ok: hsl(142 71% 45%);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--fg);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .shell { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    .header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.25rem; }
    .step { font: 600 11px/1 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
    h1 { margin: 0.25rem 0 0; font-size: 1.125rem; }
    .desc { margin: 0.35rem 0 0; font-size: 0.75rem; color: var(--muted); }
    .card {
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      background: var(--card);
      padding: 0.875rem;
      margin-bottom: 0.75rem;
    }
    .input-slot header { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.8125rem; }
    .badge {
      font: 500 9px/1 var(--mono);
      border: 1px solid var(--border);
      border-radius: 0.25rem;
      padding: 0.15rem 0.35rem;
      text-transform: capitalize;
    }
    .badge.muted { color: var(--muted); }
    .file-input { width: 100%; font-size: 0.75rem; }
    .file-name { margin: 0.35rem 0 0; font: 500 10px/1.4 var(--mono); }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 1rem 0; }
    .endpoint {
      flex: 1 1 12rem;
      min-width: 0;
      font: 500 10px/1.4 var(--mono);
      color: var(--muted);
    }
    .endpoint input {
      width: 100%;
      margin-top: 0.25rem;
      padding: 0.35rem 0.5rem;
      border-radius: 0.35rem;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--fg);
      font: inherit;
    }
    button {
      border: 1px solid var(--border);
      background: var(--primary);
      color: var(--bg);
      border-radius: 0.35rem;
      padding: 0.45rem 0.85rem;
      font: 600 10px/1 var(--mono);
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.ghost { background: transparent; color: var(--fg); }
    pre.output {
      margin: 0;
      padding: 0.875rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--card);
      font: 500 11px/1.5 var(--mono);
      white-space: pre-wrap;
      word-break: break-word;
      min-height: 8rem;
    }
    .status { font: 500 10px/1 var(--mono); }
    .status.err { color: var(--destructive); }
    .status.ok { color: var(--ok); }
    .status.run { color: var(--muted); }
    .tabs { display: flex; gap: 0.35rem; margin-bottom: 0.5rem; }
    .tabs button { background: transparent; color: var(--muted); font: 600 10px/1 var(--mono); }
    .tabs button.active { color: var(--fg); border-color: var(--fg); }
    .panel { display: none; }
    .panel.active { display: block; }
    .trace-list { display: flex; flex-direction: column; gap: 0.35rem; max-height: 28rem; overflow: auto; }
    .trace-step {
      border: 1px solid var(--border);
      border-radius: 0.35rem;
      background: var(--bg);
      overflow: hidden;
    }
    .trace-step summary {
      cursor: pointer;
      list-style: none;
      padding: 0.45rem 0.6rem;
      font: 600 10px/1.4 var(--mono);
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .trace-step summary::-webkit-details-marker { display: none; }
    .trace-step pre {
      margin: 0;
      padding: 0.6rem;
      border-top: 1px solid var(--border);
      font: 500 10px/1.45 var(--mono);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 14rem;
      overflow: auto;
    }
    .trace-empty { font: 500 10px/1.4 var(--mono); color: var(--muted); padding: 0.5rem 0; }
  </style>
</head>
<body>
  <div class="shell">
    <header class="header">
      <div class="step">inference / exported</div>
      <h1>${project.name}</h1>
      <p class="desc">Upload inputs and run via the shared PipelineConnector (HTTP JSON or gRPC backend).</p>
    </header>

    <div id="inputs">
${inputSlotHtml(project)}
    </div>

    <div class="actions">
      <label class="endpoint">
        Connector URL
        <input id="endpoint" type="url" value="http://localhost:8080/v1/run" />
      </label>
      <button id="run" type="button">Run pipeline</button>
      <button id="loadPreset" type="button" class="ghost">Load sample inputs</button>
      <button id="health" type="button" class="ghost">Health</button>
      <span id="status" class="status"></span>
    </div>

    <section class="card">
      <div class="tabs">
        <button type="button" class="tab active" data-tab="output">Output</button>
        <button type="button" class="tab" data-tab="trace">Step trace</button>
      </div>
      <div id="panel-output" class="panel active">
        <div class="step" style="margin-bottom:0.5rem">final result</div>
        <pre id="output" class="output">—</pre>
      </div>
      <div id="panel-trace" class="panel">
        <div class="step" style="margin-bottom:0.5rem">per-step outputs (logging view)</div>
        <div id="trace" class="trace-list"><p class="trace-empty">Run the pipeline to populate step outputs.</p></div>
      </div>
    </section>
  </div>
  <script>
    const multi = ${multi ? "true" : "false"};
    const stepLabels = ${JSON.stringify(stepLabels)};
    const slots = {};

    async function readFile(input) {
      const file = input.files?.[0];
      if (!file) return null;
      const content = await file.text();
      return { content, filename: file.name };
    }

    document.querySelectorAll('.file-input').forEach((input) => {
      input.addEventListener('change', () => {
        const label = input.dataset.label;
        const nameEl = document.querySelector('.file-name[data-label="' + label + '"]');
        if (nameEl) nameEl.textContent = input.files?.[0]?.name ?? 'No file selected';
      });
    });

    async function collectInputs() {
      const out = {};
      for (const input of document.querySelectorAll('.file-input')) {
        const label = input.dataset.label;
        const doc = await readFile(input);
        if (!doc) throw new Error('Select a file for ' + label);
        if (multi) out[label] = doc;
        else out.__single__ = doc;
      }
      return out;
    }

    function endpointBase() {
      const raw = document.getElementById('endpoint').value.trim();
      const idx = raw.indexOf('/v1/run');
      return idx >= 0 ? raw.slice(0, idx) : raw;
    }

    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });

    function renderTrace(stepTrace) {
      const trace = document.getElementById('trace');
      if (!stepTrace || !stepTrace.length) {
        trace.innerHTML = '<p class="trace-empty">No step trace returned — use connector_server.ts with getLastRunTrace().</p>';
        return;
      }
      trace.innerHTML = stepTrace.map((entry, i) => {
        const label = entry.label || stepLabels[i] || ('Step ' + (i + 1));
        const body = JSON.stringify(entry.output, null, 2);
        return '<details class="trace-step"' + (i === stepTrace.length - 1 ? ' open' : '') + '><summary><span>' + label + '</span><span class="muted">' + body.length + ' chars</span></summary><pre>' + body.replace(/</g, '&lt;') + '</pre></details>';
      }).join('');
    }

    async function loadPresetFiles() {
      const res = await fetch('documents/inference_setup.json');
      if (!res.ok) throw new Error('documents/inference_setup.json not found — open UI from export folder');
      const setup = await res.json();
      const inputs = setup.inputs || (setup.presets && setup.presets[0] && setup.presets[0].inputs) || {};
      for (const [label, filename] of Object.entries(inputs)) {
        const fileRes = await fetch('documents/' + filename);
        if (!fileRes.ok) throw new Error('Missing documents/' + filename);
        const content = await fileRes.text();
        const input = document.querySelector('.file-input[data-label="' + label + '"]');
        const nameEl = document.querySelector('.file-name[data-label="' + label + '"]');
        if (!input) continue;
        const file = new File([content], String(filename), { type: 'text/plain' });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        if (nameEl) nameEl.textContent = filename + ' (preset)';
      }
    }

    document.getElementById('loadPreset').addEventListener('click', async () => {
      const status = document.getElementById('status');
      status.textContent = 'Loading…';
      status.className = 'status run';
      try {
        await loadPresetFiles();
        status.textContent = 'Preset loaded';
        status.className = 'status ok';
      } catch (e) {
        status.textContent = e.message;
        status.className = 'status err';
      }
    });

    document.getElementById('health').addEventListener('click', async () => {
      const status = document.getElementById('status');
      status.textContent = 'Checking…';
      status.className = 'status run';
      try {
        const res = await fetch(endpointBase() + '/health');
        const data = await res.json();
        status.textContent = data.status === 'ok' ? 'Backend ok' : JSON.stringify(data);
        status.className = data.status === 'ok' ? 'status ok' : 'status err';
      } catch (e) {
        status.textContent = e.message;
        status.className = 'status err';
      }
    });

    document.getElementById('run').addEventListener('click', async () => {
      const runBtn = document.getElementById('run');
      const status = document.getElementById('status');
      const output = document.getElementById('output');
      runBtn.disabled = true;
      status.textContent = 'Running…';
      status.className = 'status run';
      output.textContent = '—';
      document.getElementById('trace').innerHTML = '<p class="trace-empty">Running…</p>';
      try {
        const slots = await collectInputs();
        const body = ${runPayload};
        const res = await fetch(document.getElementById('endpoint').value, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        output.textContent = data.resultJson ?? JSON.stringify(data, null, 2);
        renderTrace(data.stepTrace);
        status.textContent = 'Done';
        status.className = 'status ok';
        document.querySelector('.tab[data-tab="trace"]').click();
      } catch (e) {
        output.textContent = e.message;
        status.textContent = 'Failed';
        status.className = 'status err';
      } finally {
        runBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
`;
}

export function generatePipelineConnectorFiles(project: Project): PipelineSetupFile[] {
  const slug = projectSlug(project.name);
  const proto = generateConnectorProto(project);
  const serverTs = generateConnectorServerTs(project, slug);
  const serverPy = generateConnectorServerPy(project, slug);
  const ui = generateInferenceUiHtml(project);

  return [
    { filename: "pipeline_connector.proto", content: proto, mime: "text/plain" },
    { filename: "connector_server.ts", content: serverTs, mime: "text/typescript" },
    { filename: "connector_server.py", content: serverPy, mime: "text/x-python" },
    { filename: "inference_ui.html", content: ui, mime: "text/html" },
  ];
}

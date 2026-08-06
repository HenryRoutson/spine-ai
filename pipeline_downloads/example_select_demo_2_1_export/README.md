# Example Select Demo 2 1

Exported pipeline from Spine — types, step bodies, gRPC/HTTP connector, and inference UI.

## Quick start

```bash
cp .env.example .env   # add OPENROUTER_API_KEY
npm install @grpc/grpc-js @grpc/proto-loader dotenv
npx tsx connector_server.ts
# open inference_ui.html → Connector URL http://localhost:8080/v1/run
```

Or call `runPipeline` / `run_pipeline` directly (see **Run** below).

## Files

- `example_select_demo_2_1_pipeline.ts` — TypeScript types, steps, orchestrator
- `example_select_demo_2_1_pipeline.py` — Python models, steps, orchestrator
- `example_select_demo_2_1_pipeline.rs` — Rust structs, steps, orchestrator
- `example_select_demo_2_1_pipeline.go` — Go structs, steps, orchestrator
- `example_select_demo_2_1_pipeline.baml` — BAML classes + LLM functions (https://github.com/boundaryml/baml)
- `pipeline_connector.proto` — gRPC contract (same for TS and Python)
- `connector_server.ts` / `connector_server.py` — gRPC + HTTP JSON bridge
- `inference_ui.html` — standalone inference UI (open in browser, POST to connector)
- `.env.example` — copy to `.env` and fill in (never commit real secrets)
- `requirements.txt` — Python deps (`pip install -r requirements.txt`)
- `README.md` — this file
- `SETUP.md` — pointer to this README

## 1. Environment

```bash
cp .env.example .env
# edit .env — add your API keys
```

Load `.env` in your runner (e.g. `dotenv` for Node, `python-dotenv` for Python).
The exported pipeline file intentionally does **not** embed env access — pass config via `configurePipelineRuntime`.

TypeScript runner: `npm install dotenv` (or load env in your shell).

Rust runner: add crates `serde`, `serde_json`, `tokio`, `reqwest` (json feature), `anyhow` — see Cargo snippet under **Run**.

Go runner: stdlib only (`encoding/json`, `net/http`) — see snippet under **Run**.

## 2. LLM

Wire `configurePipelineRuntime({ openRouterApiKey })` (or Python equivalent) — OpenRouter is the default LLM provider.
For enterprise internal LLMs, call `registerCustomLlmProvider()` / `register_custom_llm_provider()` and set `llmProviderId`.
Override the model via `openRouterModel` in runtime config, or edit step bodies to pass a different slug.

## Input documents

- **Work Description** — filename contains `work_description` · type: text
- **Job Example Library** — filename contains `job_example_library` · type: json
- **Work Item Catalog** — filename contains `work_item_catalog` · type: json

Each input step expects `{ content: string, filename: string }` (read file text into `content`).

## Connector + UI

Both backends expose the same `PipelineConnector` service from `pipeline_connector.proto`:

- **gRPC** — default port `50051` (`PIPELINE_GRPC_PORT`)
- **HTTP JSON** — `POST /v1/run` on port `8080` (`PIPELINE_HTTP_PORT`) for `inference_ui.html`

TypeScript connector:

```bash
npm install @grpc/grpc-js @grpc/proto-loader dotenv
npx tsx connector_server.ts
```

Python connector:

```bash
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. pipeline_connector.proto
python connector_server.py
```

Open `inference_ui.html` in a browser (or serve statically). Point **Connector URL** at `http://localhost:8080/v1/run`.

## Run

TypeScript (multiple input slots):

```typescript
import { configurePipelineRuntime, runPipeline } from './example_select_demo_2_1_pipeline';

configurePipelineRuntime({ openRouterApiKey: process.env.OPENROUTER_API_KEY! });

const result = await runPipeline({
  "Work Description": { content: fs.readFileSync('path/to/work_description.json', 'utf8'), filename: 'work_description.json' },
  "Job Example Library": { content: fs.readFileSync('path/to/job_example_library.json', 'utf8'), filename: 'job_example_library.json' },
  "Work Item Catalog": { content: fs.readFileSync('path/to/work_item_catalog.json', 'utf8'), filename: 'work_item_catalog.json' },
});
```

Python:

```python
from example_select_demo_2_1_pipeline import configure_pipeline_runtime, run_pipeline

configure_pipeline_runtime(open_router_api_key=os.environ['OPENROUTER_API_KEY'])
# await run_pipeline(...)
```

Rust:

```toml
# Cargo.toml deps
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
reqwest = { version = "0.12", features = ["json"] }
anyhow = "1"
```

```rust
// include! or copy example_select_demo_2_1_pipeline.rs into your crate
// configure_pipeline_runtime(PipelineRuntime { open_router_api_key: Some(/* from your .env loader */), ..Default::default() });
// let result = run_pipeline(/* Document or HashMap */).await?;
```

Go:

```go
// copy example_select_demo_2_1_pipeline.go into your module (package pipeline)
ConfigurePipelineRuntime(PipelineRuntime{OpenRouterAPIKey: /* from your .env loader */})
// result, err := RunPipeline(/* Document or map[string]Document */)
```

BAML (LLM steps only — orchestrate non-LLM steps in Python/TS):

```bash
npm i -g @boundaryml/baml   # or: pip install baml
# place example_select_demo_2_1_pipeline.baml under baml_src/
baml generate
```

```python
# from baml_client import b
# result = await b.YourLlmStep(input=...)
```

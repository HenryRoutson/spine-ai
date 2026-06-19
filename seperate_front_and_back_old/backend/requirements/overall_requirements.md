# Backend Requirements

The backend powers **Forge** — the AI engineering pipeline builder. The v2 frontend
(`V0 frontend prototypes/v2/ai-pipeline-builder`) is presentation-only: it imports a
`lib/` (`store`, `types`, `run-engine`, `pydantic`, `doc-viewer`) that does not exist yet.
The backend owns that `lib/` plus all real data, execution and persistence.

Stack is JS + `zod` (zod is our pydantic). Default LLM is a cheap Chinese model via
OpenRouter (`deepseek/deepseek-chat`). The pipeline is a **straight line, not a tree**.

Everything below is grouped by the UI tab that consumes it. Anything not built for the
demo is marked **TODO placeholder** (fake data behind a stable, valid schema).

---

## Architecture & contract (decided — see `approach.md`)

Build in steps: this is the **standalone backend prototype** in `/backend`, built without the
frontend and combined with the V0 prototype later.

- **No separate server.** The backend is a library of pure TS modules (like
  `openrouter_llm.ts`), not a running API service. When combined, this logic runs inside the
  Next.js runtime and is imported directly — there is no standalone backend server.
- **Real OpenRouter calls.** The backend itself hits OpenRouter (it must be testable now).
  OpenRouter is the only external network dependency.
- **No Python.** Pure JS/TS only — e.g. PDF→text via a JS lib (`pdf-parse`/`pdfjs`).
  DeepSeek OCR and the custom-code Python sandbox remain **TODO placeholder**.
- **Persistence = local JSON now.** Simplest possible local store (JSON files under
  `backend/data/`, written via `file_write_helper`). Keep the storage access behind one thin
  interface so it can later swap to **Supabase** (needed for sign-ins) — leave a note at each
  call site, don't build auth yet.
- **Standalone surface.** Expose tab logic as importable functions + `vitest` tests (mirroring
  `openrouter_llm.test.ts`); a tiny CLI/script harness is fine to demo a full pipeline run.
- **Seed content is real.** Use `documents/legal_doc_text.*` and
  `documents/company_for_assessment.*` (pdf + `latex/` + `markdown/`) for the default
  Company Legal Evaluation pipeline and the doc-viewer source text.

---

## 0. Shared foundation (used by every tab)

Already built: `openrouter/openrouter_llm.ts` — `getStringResponse`, `getStructuredResponse`
(zod-validated JSON with one self-correcting retry), default cheap model.

To add:

- `config.ts` — load all env (`OPENROUTER_API_KEY`) into one typed constant, fail early if missing.
- Model registry consumed by `ModelSelector` / `MODEL_OPTIONS`:
  ```ts
  type ModelId = string & { __brand: "ModelId" };
  type CentsPer1kTokens = number;
  interface ModelOption { id: ModelId; label: string; flag: string; cheap: boolean; costPer1k: CentsPer1kTokens }
  ```
- Project store. Each project owns its own models, pipeline, runs, docs, strategies, billing.
  ```ts
  type ProjectId = string & { __brand: "ProjectId" };
  interface Project { id: ProjectId; name: string; kind: string }
  ```
  Default seeded project = **Company Legal Evaluation** (see §2 pipeline).
- `file_write_helper` — write both `<name>_latest.<ext>` and `<name>_<DDMonYYYY_time>.<ext>`.
- Token-usage capture on every LLM call (prompt + completion tokens) → feeds Logging + Billing.

---

## 1. Structure tab

Frontend (`structure-builder.tsx`) edits a list of models and renders a generated `models.py`
via `allModelsToPydantic(models)`.

Backend provides:

```ts
type ModelId = string & { __brand: "StructureModelId" };
type FieldType = "text" | "number" | "boolean" | "quote"
  | "tuple[text, quote]" | "list[text]" | "model" | "list[model]"; // = FIELD_TYPES
interface ModelField { id: string; name: string; type: FieldType; optional: boolean; description: string; ref?: ModelId }
interface StructureModel { id: ModelId; name: string; description: string; fields: ModelField[]; auto?: boolean }
```

- CRUD + persistence of `StructureModel[]` per project.
- `allModelsToPydantic(models)` and the canonical `zodFromModel(model)` — one definition,
  both the code view and runtime validation derive from it.
- `validate(value, model)` — implicit schema validation reused by Pipeline/Inference. There is
  **no standalone validation step**; it runs on every step's I/O.
- Auto-structure (`auto: true`): infer a `StructureModel` from a sample JSON value. Used by the
  Combine step ("company data") and Excel infer. **TODO placeholder** beyond the legal example.

---

## 2. Pipeline tab

Frontend (`pipeline-builder.tsx`) edits an ordered list of modules and flags I/O mismatches.

```ts
type ModuleKind = "input" | "doc-to-text" | "llm" | "transform" | "combine" | "custom-code" | "output";
type InputType = "pdf" | "word" | "excel" | "json" | "text" | "web" | "image"; // = INPUT_TYPES
interface PipelineModule {
  id: string; kind: ModuleKind; label: string; note?: string;
  cached: boolean; avgMs: number; avgCostCents: number;
  inputType?: InputType; inStructureId?: ModelId; outStructureId?: ModelId;
  prompt?: string; code?: string; model?: ModelId;
}
```

Backend provides:

- CRUD + persistence of the ordered `PipelineModule[]` per project, plus `MODULE_META` (label/description per kind).
- Canonical validity check (mirrors `computeInvalid`): a step is invalid when the upstream
  `outStructureId` ≠ this step's `inStructureId`. `input` sources its own data; `combine` may
  reshape. Drives the "run button goes dark" / invalid badges.
- Per-kind executor (`run-engine`):
  - **input** — load a doc / web / json into the declared output model.
  - **doc-to-text** — Python PDF reader by default (demo only uses PDFs); **DeepSeek OCR placeholder** option.
  - **llm** — `getStructuredResponse(prompt, zodFromModel(outStructure), { model })`.
  - **transform** — deterministic reshape.
  - **combine** — merge current pipeline data with a new input into an auto-generated model
    (`{ "Company data": ..., "Company legal requirements": ... }`); see Merge module in pitch.
  - **custom-code** — run a user Python step in a sandbox. **TODO placeholder**.
  - **output** — render the final document.
- Per-module metrics (`avgMs`, `avgCostCents`) aggregated from historical runs.

### Default pipeline to seed (Company Legal Evaluation)
1. `doc-to-text` legal PDF → `text` (annotated with purpose).
2. `llm` rules extraction: `text -> list[tuple[text, quote]]` (rule + source quote, quote linked to doc).
3. `combine` company data → auto model `{ Company data, Company legal requirements }`.
4. `output` document of legal considerations.

(Sliding-window split and per-rule fan-out are **skipped** for the demo per the outline.)

---

## 3. A/B Test tab

Frontend (`ab-testing.tsx`) toggles strategies, runs a benchmark, shows accuracy / pass-rate /
latency / cost bars, and an LLM-judge "best" pick.

```ts
type StrategyKind = "single-llm" | "rlm" | "claude-code" | "cheap-claude-code";
interface Strategy {
  id: string; name: string; kind: StrategyKind; model: ModelId; enabled: boolean;
  accuracy: number; passRate: number; latencyMs: number; costCents: number;
}
```

Backend provides:

- A runner per `StrategyKind` over the same pipeline task:
  1. **single-llm** — one structured call (real).
  2. **rlm** — recursive language model. **TODO placeholder** (real module exists in pitch).
  3. **claude-code** — full Claude Code instance. **TODO placeholder**.
  4. **cheap-claude-code** — Claude-Code-like loop on a cheap Chinese model. **TODO placeholder**.
- Metrics per strategy: `accuracy`, schema `passRate`, `latencyMs`, `costCents`.
- LLM judge that scores the enabled strategies and returns the winner + rationale.
- `STRATEGY_META` (description per kind). Demo may ship seeded numbers — mark **TODO placeholder**.

---

## 4. Inference tab

Frontend (`inference.tsx`) drops a doc onto an input, calls `buildRun(modules, models, model, docSha)`,
animates per-step progress, and renders validated output with clickable quotes.

Backend provides:

- `runPipeline(projectId, inputDocId, model)` — executes the linear pipeline step by step,
  honouring the cache, and streams progress (step index + status) for the live progress bar /
  high-level HTML view.
- Returns:
  ```ts
  type RunStatus = "ok" | "cached" | "error";
  interface RunStep { moduleId: string; kind: ModuleKind; label: string; status: RunStatus;
    model?: ModelId; ms: number; costCents: number; inputPreview: string; outputPreview: string; outputJson?: string }
  interface PipelineRun { id: string; status: "ok" | "error"; model: ModelId;
    inputDocId: string; startedAt: number; totalMs: number; billedCents: number; savedCents: number; steps: RunStep[] }
  ```
- Validated output = extracted rules each with a `quote` and `{ start, end }` offsets into the
  source doc, powering the doc-viewer jump (see §6 quotation).
- Same I/O-mismatch errors as the Pipeline tab; run button dark when invalid.
- Shareable read-only link to just this run/page. **TODO placeholder**.

---

## 5. Logging tab

Frontend (`logging.tsx`) lists every run, filters by model/step/id, and shows the full step trace
with JSON syntax highlighting.

Backend provides:

- Persist every `PipelineRun` (full per-step trace, token counts, cost, ms, cache status).
- Query/filter run history per project.
- Detailed logs **and** a **high-level HTML view** (progress bars, easy to read) — the same
  high-level stream rendered in the Inference tab.
- Download endpoint for a run's logs (JSON / markdown). Persist via `file_write_helper`
  (`*_latest` + timestamped) so the Documents tab's "previous runs" can list them.

---

## 6. Documents tab

Frontend (`documents.tsx`) is a content-addressed store; identical uploads dedupe by hash.
`doc-viewer.tsx` shows source text and highlights an extracted span by offset.

```ts
type DocId = string & { __brand: "ContentHash" }; // hash = id
type DocLabel = "inference" | "training";
interface Doc { id: DocId; name: string; type: InputType; sizeKb: number; label: DocLabel; uploadedAt: number }
```

Backend provides:

- Content-addressed ingest: `addDoc` returns the existing ref on hash collision (no reprocessing,
  drives the dedup toast). Filter by `inference` / `training`.
- PDF: serve **both** a PDF view and a text view (no OCR needed just to display).
- Source text + offsets for the doc viewer; jumps resolve to the real source document
  (`LEGAL_SOURCE_TEXT` seed in the demo).
- **Quotation / validated text** (langextract-style): extract a quote, validate it against the
  source, find the closest match if not exact, and store the `{ text, quote, start, end }` link.
- "Previous runs": cached step outputs saved here as JSON files, each with its static, valid zod
  structure attached, alongside `document_input_latest.txt` / `document_input_<timestamp>.txt`.

---

## 7. Billing tab

Frontend (`billing.tsx`) shows daily stacked spend per model/service and a cost-attribution table.

Backend provides:

- Aggregate token usage from every LLM call into spend, per model **and** per processing service
  (e.g. `doc-parse svc`), bucketed by day:
  ```ts
  interface BillingPoint { day: string; [modelOrService: string]: number | string }
  ```
- Cost = tokens × `MODELS[id].costPer1k`. Split spend into cheap/open vs frontier models.
- Cache savings: cents avoided by cache hits (cross-checked against Logging `savedCents`).
- Demo may seed the 7-day series — mark **TODO placeholder** where not wired to real runs.

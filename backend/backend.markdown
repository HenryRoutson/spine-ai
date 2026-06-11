# Backend outline — AI Engineering Pipeline Builder

Goal: power the V0 Next.js prototype (structure builder, pipeline builder, AB testing, inference, logging, documents, billing) with a real backend, demo-ready, minimal infra.

## Stack

- **TypeScript + Next.js API routes** (`app/api/*`) — no separate server, frontend imports shared types directly, easy `npm run dev`, easy to share an inference link.
- **Zod** as the "pydantic of TS" — runtime validation + serializable to JSON Schema for the UI.
- **OpenRouter** for all LLM calls (default to a cheap Chinese model, e.g. `deepseek/deepseek-chat`), one env var: `OPENROUTER_API_KEY`.
- **Filesystem as the database** (`/data` folder, JSON + saved documents). No DB for the hackathon. Hash-based IDs give dedup for free.
- **SSE** (server-sent events) for live run progress → drives the high-level HTML progress view.

```
backend/ (or app/api + lib/)
  lib/
    types.ts        # branded ids + core models
    schemas.ts      # structure (zod) registry, JSON Schema export
    pipeline.ts     # pipeline model + validity check
    executor.ts     # run a step / run a pipeline, caching
    llm.ts          # openrouter call, cost + latency tracking
    quotes.ts       # validated-text / quote matching (langextract style)
    store.ts        # fs read/write helpers (_latest + timestamped)
    log.ts          # jsonl logs + high-level events
  data/
    projects/<projectId>/
      project.json
      runs/<runId>/<stepId>/input_latest.json, output_latest.json, output_11Jun2026_12pm45.json
      logs/<runId>.jsonl
    documents/<sha256>.{pdf,txt,json} + index.json
    billing.jsonl
```

## 1. Core types (`lib/types.ts`)

Branded types so ids can't be mixed up; shared with the frontend.

```ts
// AI : branded strings — zero runtime cost, prevents passing a runId where a stepId is expected
type Brand<T, B extends string> = T & { __brand: B };
export type ProjectId = Brand<string, "ProjectId">;
export type StepId = Brand<string, "StepId">;
export type RunId = Brand<string, "RunId">;
export type SchemaId = Brand<string, "SchemaId">;   // name of a structure, e.g. "RuleList"
export type DocumentId = Brand<string, "DocumentId">; // sha256 of file content
export type ModelSlug = Brand<string, "ModelSlug">;   // openrouter slug
export type Usd = Brand<number, "Usd">;
export type Ms = Brand<number, "Ms">;

export type StepKind = "document_to_text" | "llm_extract" | "new_input_data" | "llm_transform" | "custom_code";

export interface Step {
  id: StepId;
  kind: StepKind;
  name: string;
  purpose: string;            // shown as annotation in UI
  inputSchema: SchemaId;
  outputSchema: SchemaId;
  model?: ModelSlug;          // only for llm steps
  prompt?: string;
}

export interface Pipeline {
  projectId: ProjectId;
  steps: Step[];              // straight line, ordered
}
```

## 2. Structure builder (`lib/schemas.ts`)

Structures are zod schemas kept in a registry, exported as JSON Schema so the UI can render/edit them, and used to validate every step boundary.

```ts
import { z } from "zod";

// AI : registry maps SchemaId -> zod schema; UI gets zodToJsonSchema(schema)
const registry = new Map<SchemaId, z.ZodTypeAny>();

// demo defaults
const Quote = z.object({ text: z.string(), start: z.number(), end: z.number() });
register("Text", z.object({ text: z.string() }));
register("RuleList", z.object({ rules: z.array(z.object({ rule: z.string(), quote: Quote })) }));
register("CompanyAssessmentInput", z.object({ company_data: z.string(), company_legal_requirements: z.array(z.string()) }));
register("LegalConsiderations", z.object({ considerations: z.array(z.object({ rule: z.string(), finding: z.string(), risk: z.enum(["low","medium","high"]) })) }));
```

API:
- `GET /api/projects/:id/schemas` → `{ id, jsonSchema }[]`
- `POST /api/projects/:id/schemas` → create/update from UI (accept JSON Schema or zod source string)

## 3. Pipeline validity (`lib/pipeline.ts`)

Schema validation is **implicit**, not a step. The single most important function:

```ts
export interface PipelineIssue { stepId: StepId; message: string }

// AI : invalid where step[i].outputSchema !== step[i+1].inputSchema — UI highlights these edges red
export function validatePipeline(p: Pipeline): PipelineIssue[] {
  return p.steps.slice(0, -1).flatMap((s, i) =>
    s.outputSchema === p.steps[i + 1].inputSchema ? [] :
    [{ stepId: p.steps[i + 1].id, message: `expects ${p.steps[i + 1].inputSchema} but receives ${s.outputSchema}` }]);
}
```

Runtime: every step's input AND output is parsed with its zod schema; failure = step error in logs, run halts.

## 4. Executor + caching (`lib/executor.ts`)

```ts
// AI : cache key = hash(stepId + prompt + model + input json) — rerunning an unchanged step is free
function cacheKey(step: Step, input: unknown): string {
  return sha256(JSON.stringify([step.id, step.prompt, step.model, input]));
}

export interface StepResult {
  output: unknown;
  cached: boolean;
  latency: Ms;
  cost: Usd;
}

export async function runStep(step: Step, input: unknown): Promise<StepResult> { /*
  1. validate input against registry[step.inputSchema]
  2. check data/cache/<cacheKey>.json -> return { cached: true }
  3. dispatch on step.kind (document_to_text | llm call | merge new input | custom code)
  4. validate output, write cache, write output_latest.json + timestamped copy
  5. append log events, append billing entry
*/ }

export async function runPipeline(projectId: ProjectId, fromStep?: StepId): Promise<RunId>
```

- Per-step **run button** support: `POST /api/projects/:id/steps/:stepId/run` — allowed when cache exists for upstream or an input file is attached.
- Outputs saved via `store.ts` as `output_latest.json` **and** `output_11Jun2026_12pm45.json` (your `file_write_helper` pattern) → these surface in the Documents tab under "previous runs".

## 5. LLM service (`lib/llm.ts`)

```ts
export interface LlmCall {
  model: ModelSlug;            // default "deepseek/deepseek-chat"
  prompt: string;
  responseSchema: SchemaId;    // appended to prompt as JSON Schema, output parsed + validated
}

export interface LlmResult { parsed: unknown; raw: string; cost: Usd; latency: Ms; tokensIn: number; tokensOut: number }
```

- One `fetch` to `https://openrouter.ai/api/v1/chat/completions`.
- Extract JSON from response (strip backticks, find first `{...}` block), `registry[responseSchema].parse()` it. One retry with the validation error fed back.
- Every call appends `{ ts, model, projectId, runId, stepId, tokensIn, tokensOut, cost }` to `data/billing.jsonl`.

## 6. Validated text / quotes (`lib/quotes.ts`)

For step 2 of the demo (rules + quotes) — langextract-style grounding:

```ts
// AI : exact indexOf first; fallback to fuzzy best-substring so slightly-paraphrased llm quotes still ground
export function groundQuote(quote: string, source: string, sourceDoc: DocumentId):
  { start: number; end: number; exact: boolean } | null
```

Output rules carry `{ quote, start, end, documentId }` → UI click jumps to `GET /api/documents/:id?highlight=start,end`.

## 7. AB testing

```ts
export type Approach = "single_llm" | "rlm" | "claude_code" | "cheap_agent";

export interface AbRun {
  stepId: StepId;
  approaches: Approach[];
  results: Record<Approach, StepResult & { judgeScore: number; judgeReason: string }>;
  winner: Approach;
}
```

- `POST /api/projects/:id/ab` runs the same step input through each approach.
- For the demo, `rlm` / `claude_code` / `cheap_agent` can share the single-call implementation with different models + a system-prompt wrapper — the comparison + judge is what's demoed.
- **Judge = one LLM call**: give it the step purpose, output schema, and the N candidate outputs → returns `{ winner, scores, reason }` (validated by zod, naturally).

## 8. Logging (`lib/log.ts`)

Two layers from one event stream:

```ts
export interface LogEvent {
  ts: number; runId: RunId; stepId?: StepId;
  level: "debug" | "info" | "error";
  kind: "step_start" | "step_output" | "llm_raw" | "step_done" | "run_done";
  payload: unknown;           // json — UI syntax-highlights
}
```

- **Technical page**: `GET /api/runs/:runId/logs` streams the `.jsonl`; download button = same file.
- **High-level page + inference progress**: `GET /api/runs/:runId/events` (SSE). Frontend renders progress bars from `step_start`/`step_done` (knows total step count) — no HTML generated server-side, just events.

## 9. Documents

- `POST /api/documents` (multipart) → `sha256(bytes)` as `DocumentId`; if it exists, return existing (dedup). Index entry: `{ id, filename, mime, label: "inference" | "training", uploadedAt }`.
- `document_to_text` step kind: pdf → text via `pdf-parse` (good enough for demo; swap for deepseek-OCR later).
- Run inputs/outputs are also listed here under "previous runs" (read from `runs/` folders).

## 10. Billing

- `GET /api/billing?groupBy=model|day` → aggregates `billing.jsonl` for the graph. Nothing else needed.

## API summary

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/projects` | list / create projects |
| GET/PUT | `/api/projects/:id/pipeline` | pipeline + `validatePipeline` issues in response |
| GET/POST | `/api/projects/:id/schemas` | structure builder |
| POST | `/api/projects/:id/run` | full run → `RunId` |
| POST | `/api/projects/:id/steps/:stepId/run` | single step run (cached/ready only) |
| GET | `/api/runs/:runId/events` | SSE progress |
| GET | `/api/runs/:runId/logs` | jsonl logs (+ `?download=1`) |
| POST/GET | `/api/documents`, `/api/documents/:id` | upload (dedup), fetch (+highlight) |
| POST | `/api/projects/:id/ab` | AB test a step |
| GET | `/api/billing` | billing aggregates |
| GET | `/api/models` | selectable openrouter models, cheap default first |

## Default project seed

Seed `data/projects/legal-eval/project.json` on first boot — the COMPANY LEGAL EVALUATION pipeline:

1. `document_to_text` — "Convert legal PDF to text" — `Document -> Text`
2. `llm_extract` — "Extract atomic rules with quotes" — `Text -> RuleList` (quotes grounded via `quotes.ts`)
3. `new_input_data` — "Combine with company data" — `RuleList -> CompanyAssessmentInput` (merges uploaded/web "company data")
4. `llm_transform` — "Assess legal considerations" — `CompanyAssessmentInput -> LegalConsiderations`

## Build order (demo-driven)

1. `types.ts` + `schemas.ts` + `validatePipeline` — UI can immediately show red invalid edges.
2. `llm.ts` (openrouter) + `executor.ts` with caching + file history.
3. Seed project + run endpoints + SSE — inference tab works end to end.
4. `quotes.ts` — the "validated text" click-to-source wow moment.
5. Logging endpoints, documents dedup, billing aggregate.
6. AB testing last — it reuses everything above.

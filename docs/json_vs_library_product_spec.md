# Spine product spec — JSON IR vs JavaScript library authoring

This is an AI description of the JSON-IR vs library authoring slice, including the 2026-08-29 prompt about JSON coding performance. The complete product spec is `docs/product_spec.md`. The raw UI feature dump is `combined_full_stack_specification.md`.

## What Spine is

Spine is a series-parallel document pipeline builder. A **project** is a group of **functions** (pipelines) that share **structures** (typed models = SQL tables). Non-technical users vibe-code; technical users edit steps, types, and custom code. Websites bind to those functions.

A pipeline is a left-to-right spine of steps: input → convert/parse → llm / llm-batch / fork / combine / assemble / custom-code → output. Adjacent steps must agree on **which structure** and **single vs list**. Validation is implicit on every hop. Caching, last-run traces, and a DAG view are how you debug and avoid re-billing.

The LLM that *builds* the pipeline writes **ordinary TypeScript** (`workflow()` / `task()`, Windmill workflows-as-code). That compiles to the JSON IR. Asking the model to emit the OpenFlow-shaped / `modules` JSON dialect is the failure mode this spec exists to stop.

## The problem this spec answers

Custom JSON is a small, recent language. Models that are strong at TypeScript still mis-write `structureIn: list[Document]` on `llm-batch`, skip required `note`s, emit a parsed model from a text input, or fork with one lane. A `pipeline(input(), llmBatch(), output())` graph constructor is still a new dialect. `workflow(async () => { await input(...); await llmBatch(...); })` is the shape models already know (Windmill, Temporal, Inngest).

Two responses, both wanted:

1. **TS → JSON.** The model writes Windmill-shaped TypeScript; `compileSpineJs` emits the IR. Storage, UI, Python/Rust/Go export, SQL types still consume JSON. OpenFlow is an *export* of that IR, never the LLM's job.
2. **Library.** Caching, step-by-step output, and DAG visualisation are **functions you import**, not extra JSON fields. The frontend (Lovable-style React) sees only the generated OpenAPI / `src/spine-api.d.ts` contract — never the graph IR.

The tension: a library is language-specific. JSON is the only cheap cross-language IR. Intensive steps can still be Rust (or Python) behind a JS orchestrator. The IR stays JSON so we do not reimplement Spine once per language.

## Decisions

| Layer | Role |
| --- | --- |
| **JSON IR** | Portable pipeline. Same `moduleSpecSchema` for vibe, CLI, MCP, seeds, exports. |
| **spine-js** | Authoring library. `workflow()` / `task()` (Windmill-shaped). Each step helper takes **one Zod-parsed object**. Compile to JSON IR. `pipeline(...)` is the IR constructor. |
| **Runtime exports** | `mermaidFromProgram`, `cachePlan`, `stepOutputs`, `withCache` live on the library. They are derived, not stored as JSON keys. |
| **Frontend contract** | After a valid compile, React vibe sees OpenAPI + `src/spine-api.d.ts` (`pipeline-client-contract`). Never the node graph. |
| **Cross-language** | Keep emitting TS/Py/Go/Rust *from* the JSON IR (`lib/export_runtime/*`). OpenFlow (`lib/windmill/compile.ts`) is export/execution, not authoring. |
| **Default path** | JS workflow authoring + compile-error retries, then JSON fallback. Up to two I/O validation retries. Schema-valid is not done (contract checks). |
| **Flags** | `SPINE_VIBE_AUTHORING=json` restores graph-JSON LLM output. Unset/anything else = `js`. `SPINE_VIBE_HARNESS=1` is the file loop. |

## Library contract

Every addable step is one function, one argument, one Zod object:

```js
const ReceiptRow = model("ReceiptRow", {
  date: z.string().describe("Receipt date"),
  vendor: z.string().describe("Vendor name"),
  amount: z.number().describe("Total amount"),
})

export const main = workflow(async () => {
  await input({ schema: z.array(Document), type: "text", note: "Many receipt files." })
  await llmBatch({ schema: ReceiptRow, note: "One row per file.", prompt: "Extract date, vendor, amount." })
  await output({ schema: ReceiptRow })
})
```
```

Compile (`compileSpineJs`) must:

1. Parse each function argument with that function's Zod schema.
2. Convert Zod schemas to structure models + `structureIn` / `structureOut` strings.
3. Re-parse the emitted JSON with the **same** `moduleSpecSchema` used by the JSON assistant (notes, Document-only non-JSON inputs, llm-batch item `in`, combine state `in`, fork ≥ 2 lanes, known connect ids, …).
4. Fail closed. A restriction the JSON path would reject must also fail here.

Library-only conveniences that do not weaken the IR:

- Infer `in` from the previous step when omitted.
- `llm-batch` `in: z.array(Document)` unwraps to item `Document` (the JSON footgun).

Features that must **not** become JSON fields: cache policy, mermaid, per-step traces. Import them from the library after compile.

## Collection modes to compare

Today's JSON path is **direct retry**: one structured object, then up to two retries on I/O / topology errors.

The file **harness** (`SPINE_VIBE_HARNESS=1`) is a write / `run_tests` loop. It can write JSON or `pipeline.js`.

The experiment is a 2×2:

| | Direct retry | Harness |
| --- | --- | --- |
| **JSON** | Current default | Existing file loop on `pipeline.json` |
| **Library (JS)** | Model emits JS; compile; retry with compile + validation errors | File loop writes `pipeline.js` |

Metrics: reliability (valid pipeline **and** topology hit), seconds per task, prompt tokens, completion tokens.

### Reward hacking (do not do this)

Matching the user task string to few-shot Example 1–5 and emitting that example’s `payload` is **reward hacking**. Seed then scores 100% reliable without generating a pipeline. That is not a test of JSON vs library vs harness.

Seed may emit a generic notes stub so offline tests still return a proposal. Catalog tests (`vibe-coding-examples.test.ts`, `spine-js` round-trip) prove the few-shot graphs are I/O-valid — they are not LLM tests. Seed A/B records wiring and tokens; it must not assert topology. Live OpenRouter is the coding-performance comparison.

### Live OpenRouter (DeepSeek V4, 2026-08-29)

42 live tests passed (`hasProposal`). Reliability = valid **and** topology. `generator` is what actually produced the proposal: `js` means spine-js compiled; `json` means the JSON path (including fallback after a JS miss).

| mode | reliable | valid | topology | sec/task | mean promptTok |
| --- | ---: | ---: | ---: | ---: | ---: |
| json-direct | 7/7 | 7/7 | 7/7 | 58.3 | 42073 |
| json-harness | 7/7 | 7/7 | 7/7 | 110.2 | 31702 |
| js-direct | 7/7 | 7/7 | 7/7 | 58.3 | 27640 |
| js-harness | 6/7 | 6/7 | 7/7 | 125.9 | 35425 |

js-direct used `generator=js` on ex1, ex1b, and ex5 only. ex1c, ex2, ex3, ex4 **fell back to JSON**. js-harness missed validity on ex3 (combine) after falling back to JSON. JSON-direct stayed on JSON for every task.

On this model, the library path is cheaper when it sticks (ex1/ex1b/ex5). It does not yet beat JSON on harder spines; JSON fallback is carrying the 7/7. That A/B used `pipeline(...)` graph constructors — still a new dialect. **2026-08-30:** authoring is `workflow()` / `task()` (Windmill-shaped); default is JS; JSON is IR + fallback. Schema-valid is not done.

The older json vs harness A/B (no library) was 7/7 vs 7/7, harness slower.

## What this does not change

- The UI still edits the JSON/project graph.
- Python / Rust / Go export still print from the IR. OpenFlow is an export of a compiled project.
- Users can keep a mixed graph: JS-authored spine, one custom-code step in Rust/TS.
- JSON fallback still runs if workflow compile misses, so a JS regression cannot empty Vibe.

## Success

1. `docs/prompts.md` exists and includes this prompt.
2. This spec exists.
3. `lib/spine-js` compiles JS → JSON IR and rejects the same illegal graphs as `moduleSpecSchema`.
4. Seed A/B: records the 2×2 without pasting few-shot payloads. Must not require topology hits (that was reward hacking).
5. Live OpenRouter A/B (when a key is present) is the coding-performance comparison.

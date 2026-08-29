# Spine product spec — JSON IR vs JavaScript library authoring

This is an AI description of the JSON-IR vs library authoring slice, including the 2026-08-29 prompt about JSON coding performance. The complete product spec is `docs/product_spec.md`. The raw UI feature dump is `combined_full_stack_specification.md`.

## What Spine is

Spine is a series-parallel document pipeline builder. A **project** is a group of **functions** (pipelines) that share **structures** (typed models = SQL tables). Non-technical users vibe-code; technical users edit steps, types, and custom code. Websites bind to those functions.

A pipeline is a left-to-right spine of steps: input → convert/parse → llm / llm-batch / fork / combine / assemble / custom-code → output. Adjacent steps must agree on **which structure** and **single vs list**. Validation is implicit on every hop. Caching, last-run traces, and a DAG view are how you debug and avoid re-billing.

The LLM that *builds* the pipeline today is asked to emit a **custom JSON dialect** (`pipeline.json` / the assistant `modules` array). That dialect is new to the model. Ordinary JavaScript is not.

## The problem this spec answers

Custom JSON is a small, recent language. Models that are strong at TypeScript still mis-write `structureIn: list[Document]` on `llm-batch`, skip required `note`s, emit a parsed model from a text input, or fork with one lane. Retries and a file harness reduce the miss rate; they do not make the dialect familiar.

Two responses, both wanted:

1. **JS → JSON.** Let the model write normal JavaScript, then compile it into the existing JSON schema (the IR). The rest of the product — storage, UI, Python/Rust/Go export, SQL types — still consumes JSON.
2. **Library.** Caching, step-by-step output, and DAG visualisation should be **functions you import**, not extra JSON fields. A pipeline file should say `pipeline(input({ schema }), llmBatch({ schema, prompt }), output({ schema }))`. The library enforces the same restrictions the JSON schema already has.

The tension: a library is language-specific. JSON is the only cheap cross-language IR. Intensive steps can still be Rust (or Python) behind a JS orchestrator. The IR stays JSON so we do not reimplement Spine once per language.

## Decisions

| Layer | Role |
| --- | --- |
| **JSON IR** | Portable pipeline. Same `moduleSpecSchema` for vibe, CLI, MCP, seeds, exports. |
| **spine-js** | Authoring library. Each step function takes **one Zod-parsed object**. The I/O type is a Zod schema in `schema`. Compile to JSON IR. |
| **Runtime exports** | `mermaidFromProgram`, `cachePlan`, `stepOutputs`, `withCache` live on the library. They are derived, not stored as JSON keys. |
| **Cross-language** | Keep emitting TS/Py/Go/Rust *from* the JSON IR (`lib/export_runtime/*`). Do not require those languages to author pipelines. A heavy step can be a Rust custom-code body inside a JS-authored graph. |
| **Default path** | Unchanged: JSON + direct structured output + up to two validation retries. |
| **Flags** | `SPINE_VIBE_AUTHORING=js` turns on JS authoring. `SPINE_VIBE_HARNESS=1` is the file loop (writes `pipeline.js` when authoring is js). |

## Library contract

Every addable step is one function, one argument, one Zod object:

```js
const ReceiptRow = model("ReceiptRow", {
  date: z.string().describe("Receipt date"),
  vendor: z.string().describe("Vendor name"),
  amount: z.number().describe("Total amount"),
})

export default pipeline(
  input({ schema: z.array(Document), type: "text", note: "Many receipt files." }),
  llmBatch({ schema: ReceiptRow, note: "One row per file.", prompt: "Extract date, vendor, amount." }),
  output({ schema: ReceiptRow }),
)
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

On this model, the library path is cheaper when it sticks (ex1/ex1b/ex5). It does not yet beat JSON on harder spines; JSON fallback is carrying the 7/7. Keep JSON as default.

The older json vs harness A/B (no library) was 7/7 vs 7/7, harness slower.

## What this does not change

- The UI still edits the JSON/project graph.
- Python / Rust / Go export still print from the IR.
- Users can keep a mixed graph: JS-authored spine, one custom-code step in Rust/TS.
- JSON remains the default so a regression in JS compile cannot empty Vibe.

## Success

1. `docs/prompts.md` exists and includes this prompt.
2. This spec exists.
3. `lib/spine-js` compiles JS → JSON IR and rejects the same illegal graphs as `moduleSpecSchema`.
4. Seed A/B: records the 2×2 without pasting few-shot payloads. Must not require topology hits (that was reward hacking).
5. Live OpenRouter A/B (when a key is present) is the coding-performance comparison.

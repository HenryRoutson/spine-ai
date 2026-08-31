# Spine product spec — JSON IR vs JavaScript library authoring

This is an AI description of the JSON-IR vs library authoring slice, including the 2026-08-29 prompt about JSON coding performance. The complete product spec is `docs/product_spec.md`. The raw UI feature dump is `combined_full_stack_specification.md`.

## What Spine is

Spine is a series-parallel document pipeline builder. A **project** is a group of **functions** (pipelines) that share **structures** (typed models = SQL tables). Non-technical users vibe-code; technical users edit steps, types, and custom code. Websites bind to those functions.

A pipeline is a left-to-right spine of steps: input → convert/parse → llm / llm-batch / fork / combine / assemble / custom-code → output. Adjacent steps must agree on **which structure** and **single vs list**. Validation is implicit on every hop. Caching, last-run traces, and a DAG view are how you debug and avoid re-billing.

The LLM that *builds* the pipeline is asked to write **ordinary TypeScript** (`workflow` / `task` / `generateObject`). That shape has a pretraining prior. The OpenFlow-shaped node/edge dialect does not. Compile (`compileSpineJs`) traces the TypeScript into the existing JSON IR. The rest of the product — storage, UI, Python/Rust/Go export, SQL types, Windmill OpenFlow execution — still consumes JSON.

## The problem this spec answers

Custom JSON is a small, recent language. Models that are strong at TypeScript still mis-write `structureIn: list[Document]` on `llm-batch`, skip required `note`s, emit a parsed model from a text input, or fork with one lane. Structured decoding (grammar-constrained sampling) stops *syntactic* failures; leftover failures are semantic — the model does not know the IR. Few-shot JSON was papering over a missing prior.

Two responses, both wanted; this session picks (2) as the default authoring path:

1. **JS → JSON (old library).** `pipeline(input(), llmBatch(), output())` and `workflow(async () => { await input(...); await llmBatch(...) })` still compile.
2. **Workflows as code (default).** The model writes Windmill-shaped `export const main = workflow(async (files) => { await task(fn)(file) })` plus `generateObject`. Tracing lowers `for` → llm-batch, `Promise.all` → fork, two args (parse first, keep second raw) → combine, two parsed returns → assemble, `flatMap` / `step()` → custom-code. Caching, DAG visualisation, and step traces stay **library exports**, not JSON fields.

JSON remains the portable IR so we do not reimplement Spine once per language. Intensive steps can still be Rust (or Python) behind a TS orchestrator.

## Decisions

| Layer | Role |
| --- | --- |
| **JSON IR** | Portable pipeline. Same `moduleSpecSchema` for vibe compile output, CLI, MCP, seeds, exports, OpenFlow. The model does not emit this. |
| **workflow TS** | Default authoring. `workflow` / `task` / `step` / `generateObject`. Compile to JSON IR. |
| **spine-js pipeline()** | Lower-level step DSL. Still compiles. Not what the LLM is asked to write. |
| **Runtime exports** | `mermaidFromProgram`, `cachePlan`, `stepOutputs`, `withCache` live on the library. |
| **Frontend contract** | After a successful compile, `contract.d.ts` + `openapi.json` (`run(input): Promise<RunOutput>`), plus hosted React `src/spine-api.d.ts` from `pipeline-client-contract`. Lovable-style generation sees only this — never the graph. |
| **Cross-language** | Keep emitting TS/Py/Go/Rust *from* the JSON IR. Windmill OpenFlow is the execution IR (`compileProjectToOpenFlow`). |
| **Default path** | TypeScript workflow authoring. Compile-error retry. No fallback to asking the model for a modules JSON array. |
| **Flags** | `SPINE_VIBE_AUTHORING=json` is the opt-out (A/B). `SPINE_VIBE_HARNESS=1` is the file loop (writes `pipeline.ts` when JS is on). |

## Library contract

The model is asked for this shape (not a node graph):

```ts
import { z, model, workflow, task, generateObject } from "spine"

const ReceiptRow = model("ReceiptRow", {
  date: z.string().describe("Receipt date"),
  vendor: z.string().describe("Vendor name"),
  amount: z.number().describe("Total amount"),
})

async function extractReceipt(doc: { filename: string; content?: string }) {
  return generateObject({
    schema: ReceiptRow,
    prompt: "Extract date, vendor, amount.",
    note: "One row per file.",
  })
}

export const main = workflow(async (files) => {
  const rows = []
  for (const file of files) rows.push(await task(extractReceipt)(file))
  return rows
})
```

Compile (`compileSpineJs`) must:

1. Transpile TS, strip `async`/`await` for tracing, bind `workflow`/`task`/`step`/`generateObject`.
2. Lower familiar control flow into the JSON IR (batch / fork / combine / assemble / custom-code).
3. Re-parse the emitted JSON with the **same** `moduleSpecSchema` used by the JSON assistant.
4. Fail closed. A restriction the JSON path would reject must also fail here.
5. Return compile errors as the tool/retry payload so the next turn can fix the TypeScript (Windmill `createScript` loop).

Pass is not "validates against Zod":

- At least one processing step (not input → output).
- At least two test files with different contents.
- custom-code that ignores its input, or returns the same value on two different samples, fails.

## Collection modes to compare

JSON **direct retry** is the opt-out: structured object, then up to two retries on I/O / topology errors.

The file **harness** (`SPINE_VIBE_HARNESS=1`) is a write / `run_tests` loop. Default writes `pipeline.ts`.

The experiment is a 2×2:

| | Direct retry | Harness |
| --- | --- | --- |
| **JSON** | `SPINE_VIBE_AUTHORING=json` | File loop on `pipeline.json` |
| **Workflow TS** | Model emits TS; compile; retry with compile + semantic + validation errors | File loop writes `pipeline.ts` |

Metrics: reliability (valid pipeline **and** topology hit), seconds per task, prompt tokens, completion tokens.

### Reward hacking (do not do this)

Matching the user task string to few-shot Example 1–5 and emitting that example’s `payload` is **reward hacking**. Seed then scores 100% reliable without generating a pipeline. That is not a test of JSON vs library vs harness.

Seed may emit a generic notes stub so offline tests still return a proposal. Catalog tests (`vibe-coding-examples.test.ts`, `spine-js` round-trip) prove the few-shot graphs are I/O-valid — they are not LLM tests. Seed A/B records wiring and tokens; it must not assert topology. Live OpenRouter is the coding-performance comparison.

Nearest-example retrieval (1–3 past-good TypeScript samples per request) is allowed in the *prompt*. Exact-task payload paste into seed is not.

### Live OpenRouter (DeepSeek V4, 2026-08-29)

42 live tests passed (`hasProposal`). Reliability = valid **and** topology. `generator` is what actually produced the proposal: `js` means spine-js compiled; `json` means the JSON path (including fallback after a JS miss).

| mode | reliable | valid | topology | sec/task | mean promptTok |
| --- | ---: | ---: | ---: | ---: | ---: |
| json-direct | 7/7 | 7/7 | 7/7 | 58.3 | 42073 |
| json-harness | 7/7 | 7/7 | 7/7 | 110.2 | 31702 |
| js-direct | 7/7 | 7/7 | 7/7 | 58.3 | 27640 |
| js-harness | 6/7 | 6/7 | 7/7 | 125.9 | 35425 |

That run used the **pipeline() DSL** and **fell back to JSON** on harder spines. This session removes that fallback and switches the asked-for shape to `workflow()`/`task()`. Re-run live OpenRouter before treating the table as current.

## What this does not change

- The UI still edits the JSON/project graph (the compile target).
- Python / Rust / Go export still print from the IR.
- Windmill OpenFlow is still how we execute (`compileProjectToOpenFlow`).
- Users can keep a mixed graph: TS-authored spine, one custom-code step in Rust/TS.

## Success

1. `docs/prompts.md` includes this prompt.
2. This spec exists and says workflow TS is the default; JSON is the IR + opt-out.
3. `lib/spine-js` compiles `workflow()` → JSON IR and rejects the same illegal graphs as `moduleSpecSchema`.
4. Semantic checks reject empty / passthrough / identical-test-doc pipelines.
5. Frontend generation is prompted with `run()` types, not the graph.
6. Seed A/B: records the 2×2 without pasting few-shot payloads. Must not require topology hits (that was reward hacking).
7. Live OpenRouter A/B (when a key is present) is the coding-performance comparison.


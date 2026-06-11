# Backend Progress & TODO Tracker

Living status doc for the **Forge** backend (`/backend`). Pairs with `overall_requirements.md`
(the spec) and `approach.md` (the decisions). Update this file as work lands.

**Status key:** ✅ done · 🟡 placeholder (stable schema / fake data, marked "TODO placeholder" in code) · ⬜ not started

Last verified: `npx tsc --noEmit` clean · `npm test` → 35/35 pass (incl. live OpenRouter) ·
`npm run demo` runs the full legal pipeline end-to-end (~37s) · `npm run demo:ab` runs the live
A/B benchmark (4 environments on deepseek, ~2.5min, judge picks winner).

---

## How it's wired (start-from-scratch map)

Pure TS library under `backend/lib/` (no server) — combines into the V0 frontend's `lib/` later.
Real OpenRouter calls. Local-JSON persistence behind one `Store` interface (swap → Supabase).

| Area | File(s) | Status |
| --- | --- | --- |
| Env / config | `lib/config.ts` | ✅ |
| Shared types + model registry | `lib/types.ts` | ✅ |
| OpenRouter gateway + token usage | `openrouter/openrouter_llm.ts`, `lib/llm.ts`, `lib/usage.ts` | ✅ |
| Persistence (local JSON, content-addressed docs) | `lib/store.ts` | ✅ |
| `file_write_helper` (`_latest` + timestamped) | `lib/file_write_helper.ts` | ✅ |
| Seed: generic JSON project seeds (legal example) | `seeds/company_legal_evaluation.json` + `lib/seed.ts` loader | ✅ |
| Public surface barrel | `lib/index.ts` | ✅ |
| CLI demo harness | `lib/demo.ts` | ✅ |

---

## By tab

### 0. Shared foundation
- ✅ `config.ts` — typed env, fails early if `OPENROUTER_API_KEY` missing.
- ✅ Model registry `MODEL_OPTIONS` (+ `slug`, `cheap`, `costPer1k`), `slugFor`, `modelOption`.
- ✅ Per-project store; default seeded project = Company Legal Evaluation.
- ✅ `file_write_helper`; ✅ token-usage capture on every LLM call → Logging + Billing.

### 1. Structure
- ✅ CRUD helpers (`upsertModel`/`removeModel`) on `StructureModel[]` (persist via store).
- ✅ Canonical `zodFromModel` + `validate` (one definition backs code view + runtime I/O).
- ✅ `allModelsToPydantic` / `modelToPydantic` (matches frontend `models.py` view).
- ✅ `llmSchema` (quote fields → string for the model; offsets resolved after the call).
- 🟡 Auto-structure `inferModel` — flat objects only; nested inference is a placeholder.

### 2. Pipeline
- ✅ Ordered `PipelineModule[]` per project + `MODULE_META`.
- ✅ `computeInvalid` / `isPipelineValid` / `canRunStep` (mirrors frontend `computeInvalid`).
- ✅ Executors: `input`, `doc-to-text` (pdf-parse), `llm`, `transform`, `combine`, `output`.
- 🟡 `doc-to-text` DeepSeek OCR option (`docToTextOcrPlaceholder`).
- ✅ `custom-code` — saved TypeScript `(input) => output` function, compiled via `node:vm` and run on the previous step's output; code persisted per run (`<module>_code_latest.ts` + timestamped). Seeded example: "Sort Rules by Severity".
- ✅ `llm-batch` — one structured (zod-validated) call per list item with bounded concurrency, merged into a typed list in input order (`llmBatchStructured`).
- ✅ Per-module metrics from history (`moduleMetrics`).
- ✅ Default 4-stage legal pipeline seeded (sliding-window + per-rule fan-out skipped per outline).

### 3. A/B Test (reworked per demo_outline §3, 11 Jun)
- ✅ All four "LLL environments" run for **real**: `single-llm` (one call), `rlm` (decompose →
  solve sub-tasks → synthesize), `claude-code` + `cheap-agent` (draft → validate → critique loop).
- 🟡 `claude-code` runs the shared agent loop — spawning a real Claude Code instance is still a
  TODO placeholder (noted in its log header).
- ✅ Benchmark runs every enabled environment on the cheap model (`deepseek-v3`); if none work it
  falls back to a single `sonnet-4.7` call (`BENCH_FALLBACK_MODEL`, verified live on OpenRouter).
- ✅ Logs kept per environment: markdown with fenced/syntax-highlightable code blocks in
  `data/ab_tests/` (`<kind>_log_latest.md` + timestamped, plus `benchmark_latest.md`).
- ✅ LLM judge scores accuracy per environment + picks the winner with rationale.
- ✅ `npm run demo:ab` CLI harness.

### 4. Inference
- ✅ `runPipeline(store, projectId, inputDocId, opts)` — linear exec, cache, streamed `onStep`.
- ✅ Returns full `PipelineRun` (per-step trace, totals, `billedCents`/`savedCents`).
- ✅ Validated output: rules carry `{text, quote:{doc_id,start,end}}` resolving into the source.
- ✅ Refuses to run an invalid pipeline (run button dark).
- ⬜ Shareable read-only run link.

### 5. Logging
- ✅ Persist every `PipelineRun` (full trace/tokens/cost/cache); ✅ `filterRuns`.
- ✅ Markdown download (`runToMarkdown`) + high-level HTML view (`runToHtml`, progress bars,
  archived per run as `data/runs/<id>/run_high_level_latest.html`).
- ✅ `*_latest` + timestamped artifacts per run (→ Documents "previous runs").
- ✅ **testing.log** (added 11 Jun) — python-style streaming log: `lib/file_log.ts` (`FileLog`)
  writes ANSI-highlighted `data/logs/testing.log` (`tail -f`-able) + a mirrored syntax-highlighted
  `testing.html`; wired into vitest via `lib/vitest_reporter.ts` (every test result streams in).
- ✅ **Live HTML progress** (added 11 Jun) — `runPipeline` rewrites `data/live/run_live.html`
  on every step transition: overall bar + per-step bars, pulsing "running" row, pending rows,
  auto-refresh meta tag dropped when the run finishes. Same renderer (`progressHtml`) backs the
  static Logging view → feeds the Inference tab UI when combined.

### 6. Documents
- ✅ Content-addressed ingest with hash dedupe; `inference`/`training` labels.
- ✅ PDF → text (`pdfToText`) + stored text view; source text + offsets for the viewer.
- ✅ Quotation / validated text (`findQuote`: exact → whitespace-tolerant → fuzzy closest).
- ✅ "Previous runs": per-step JSON with attached static zod structure + `document_input_*`.

### 7. Billing
- ✅ Real aggregation from runs: daily spend per model **and** per service (`doc-parse svc`).
- ✅ `spendSplit` (cheap/open vs frontier); ✅ `totalSaved` (cache savings).
- 🟡 `seededBillingSeries` (7-day) fallback when no run history yet.

---

## Open TODOs (prioritised)
1. ⬜ Combine with the V0 frontend: replace its presentation-only `lib/` with this backend.
2. ⬜ Shareable read-only inference run link.
3. 🟡 Promote remaining placeholders to real: spawn a true Claude Code instance for the
   `claude-code` environment, DeepSeek OCR.
4. ⬜ Migrate `JsonStore` → Supabase (auth/sign-ins) — single interface, noted at the seam.
5. 🟡 Nested/array auto-structure inference beyond flat objects.

## Bugs found — NOT yet fixed (11 Jun second review; `// AI : TODO bug` at each site)
1. **Cache hit skips execModule side effects** (`run_engine.ts`) — a cached `input` step never
   shifts the inputQueue (next input module consumes the wrong doc) and never sets
   `sourceText`/`sourceDocId` (quotes resolve against `""`, llm steps lose their SOURCE DOCUMENT
   context). Latent: seed has `cached:false` everywhere; breaks once a user toggles `cached`.
2. **Cache key too narrow** (`run_engine.ts`) — key omits secondary input docs
   (`opts.inputDocIds`, e.g. the company doc) and the step prompt; swapping the company doc or
   editing a prompt serves stale cached output.
3. **Nested quote fields** (`structure.ts` `llmSchema` + `run_engine.ts` `resolveQuotes`) — only
   top-level `tuple[text,quote]` fields collapse to strings / get offset-resolved; a quote field
   inside a nested `model`/`list[model]` ref asks the LLM for byte offsets and then fails
   validation. Latent for the seed, real for user-authored structures.
4. **Benchmark fallback duplicates a kind** (`strategies.ts` `runBenchmark`) — the Sonnet
   fallback row shares its `kind` with the failed cheap row; judge scores are keyed by kind, so
   both rows get the same accuracy and `winnerKind` can't distinguish them.
5. **Judge cost dropped** (`strategies.ts` `judgeStrategies`) — its ledger is billed but never
   read; the judge call is missing from every benchmark cost total.
6. **`runProjects` never pruned** (`store.ts` `addRun`) — runs are capped at 100 but evicted
   runs' map entries stay in store.json forever.
7. **json_object vs array schemas** (`openrouter_llm.ts`) — json mode formally promises an
   object while every `outIsList` schema expects a top-level array; works on deepseek today,
   brittle on stricter providers (risk, not yet observed failing).

## Bugs found & fixed (11 Jun review)
- **OpenRouter 402 on Anthropic models** — no `max_tokens` cap meant OpenRouter reserved the
  model's full 64k output against the account balance. Gateway now defaults to 8192.
- **Dead model slug** — `claude-opus-4.6` mapped to `anthropic/claude-3.5-sonnet` (404 on
  OpenRouter now). Remapped to `anthropic/claude-opus-4.1`; added `sonnet-4.7` →
  `anthropic/claude-sonnet-4.5` (probed live, works).
- **Input-doc assignment** — `runPipeline` appended *every* store doc to the input queue, so any
  unrelated upload could silently become the Company Data input. Now: explicit docs first, then
  only unused `inference`-labelled docs in upload order.
- **Stale cache across models** — step cache key ignored the model; switching models could serve
  another model's cached output. Model is now part of the key.
- **Hardcoded default model** — `runPipeline` fell back to `"qwen-2.5-72b"` instead of
  `DEFAULT_MODEL`.
- **Billing sort across years** — daily buckets sorted by parsing `"Jun 11"` (year-less). Now
  sorted by the earliest real run timestamp per day.
- **Non-idempotent test** — `store.test.ts` used static content, so a second `npm test` against
  persisted data failed the dedupe count. Content is now unique per run.
- **Shared strategy ids** — blank projects copied the legal project's strategy ids verbatim.

## Notes / decisions
- Seeds are generic JSON (11 Jun): the legal example lives in
  `seeds/company_legal_evaluation.json` — project + models + modules + strategies + source docs
  (`file` is a name under repo `/documents`). `loadProjectSeed(path)` zod-validates and loads any
  such file at import time (fails early on a bad seed); author a new JSON to seed a new project.
- Default model `deepseek-v3` (→ `deepseek/deepseek-chat`): qwen-2.5-72b was ~3x slower for
  large structured outputs on OpenRouter. Still a cheap Chinese model per the spec.
- Rule extraction capped at the 6 most important rules to keep demo latency sane (~37s).
- Fixed: `openrouter_llm.ts` was loading `.env` from `backend/.env` instead of the repo root.
- Run: `npm run demo` (full live pipeline) · `npm test` (unit + live) · `npm run typecheck`.

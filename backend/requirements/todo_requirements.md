# Backend Progress & TODO Tracker

Living status doc for the **Forge** backend (`/backend`). Pairs with `overall_requirements.md`
(the spec) and `approach.md` (the decisions). Update this file as work lands.

**Status key:** ✅ done · 🟡 placeholder (stable schema / fake data, marked "TODO placeholder" in code) · ⬜ not started

Last verified: `npx tsc --noEmit` clean · `npm test` → 31/31 pass (incl. live OpenRouter) · `npm run demo` runs the full legal pipeline end-to-end (~37s).

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
| Seed: Company Legal Evaluation project + real docs | `lib/seed.ts` | ✅ |
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
- 🟡 `custom-code` — passes input through (Python sandbox not built).
- ✅ Per-module metrics from history (`moduleMetrics`).
- ✅ Default 4-stage legal pipeline seeded (sliding-window + per-rule fan-out skipped per outline).

### 3. A/B Test
- ✅ `single-llm` runner (real, one structured call).
- 🟡 `rlm`, `claude-code`, `cheap-agent` — seeded numbers (`real: false`).
- ✅ LLM judge `judgeStrategies` (winner + rationale); ✅ `runBenchmark`; ✅ `STRATEGY_META`.

### 4. Inference
- ✅ `runPipeline(store, projectId, inputDocId, opts)` — linear exec, cache, streamed `onStep`.
- ✅ Returns full `PipelineRun` (per-step trace, totals, `billedCents`/`savedCents`).
- ✅ Validated output: rules carry `{text, quote:{doc_id,start,end}}` resolving into the source.
- ✅ Refuses to run an invalid pipeline (run button dark).
- ⬜ Shareable read-only run link.

### 5. Logging
- ✅ Persist every `PipelineRun` (full trace/tokens/cost/cache); ✅ `filterRuns`.
- ✅ Markdown download (`runToMarkdown`) + high-level HTML view (`runToHtml`, progress bars).
- ✅ `*_latest` + timestamped artifacts per run (→ Documents "previous runs").

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
3. 🟡 Promote placeholders to real: `rlm`, agent strategies, custom-code sandbox, DeepSeek OCR.
4. ⬜ Migrate `JsonStore` → Supabase (auth/sign-ins) — single interface, noted at the seam.
5. 🟡 Nested/array auto-structure inference beyond flat objects.

## Notes / decisions
- Default model `deepseek-v3` (→ `deepseek/deepseek-chat`): qwen-2.5-72b was ~3x slower for
  large structured outputs on OpenRouter. Still a cheap Chinese model per the spec.
- Rule extraction capped at the 6 most important rules to keep demo latency sane (~37s).
- Fixed: `openrouter_llm.ts` was loading `.env` from `backend/.env` instead of the repo root.
- Run: `npm run demo` (full live pipeline) · `npm test` (unit + live) · `npm run typecheck`.

# Inference Tab — Requirements

Rework the **Inference** tab (`components/inference.tsx`) so it matches how pipelines
actually run: multiple heterogeneous inputs (files *or* web scrapes), a read-only pipeline
mirror, per-step cache control, and partial **run from** execution when prior step output
is already cached.

Pairs with Pipeline tab §2 in `backend/requirements/overall_requirements.md` and the existing
`runPipeline` implementation in `lib/server/run_engine.ts`.

Last updated: 11 Jun 2026

---

## Problem (current behaviour)

The Inference tab is built around a **single global file drop zone** and one `inputDocId`
passed to `POST /api/runs`. That is wrong for several real pipelines:

| Gap | Example |
| --- | --- |
| **One drop zone for all inputs** | Legal pipeline has two file inputs (legal PDF + company PDF) inside a combine block; DB migration has two JSON inputs. User cannot assign a file per slot. |
| **Assumes first input is always a file** | A pipeline's first `input` step may be `inputType: "web"` (website scrape). There is nothing to drag — the UI still shows "Drop a document". |
| **No execution view of the pipeline** | User sees a drop zone + progress list, not the same linear/combine layout they configured in the Pipeline tab. Hard to see *where* each file goes. |
| **Cache toggle lives in Pipeline builder** | `module.cached` in the inspector is a design-time flag mixed with pipeline config. Inference should control cache **per run**, not while editing prompts. |
| **No partial re-run** | If steps 1–4 are cached and the user changes the company doc, they must re-run from the start (or manually toggle cache on every upstream step in the builder). |

Backend already accepts `opts.inputDocIds` on `runPipeline`, but the API route and UI never
send it — secondary inputs silently fall back to seeded inference docs in store order.

---

## Goals

1. Show a **read-only copy** of the pipeline (structure only — no config inspector).
2. Let the user **supply data at each input location** (file drop or web URL, depending on `inputType`).
3. **Per-step "Use cache" toggle** at run time (default on when a cache entry exists).
4. **"Run from"** on each step — start execution at that step when all upstream outputs are
   available (from cache or from inputs already loaded this session).
5. Keep validated output + quote linking on the right pane unchanged.

Non-goals for this pass: shareable run links, A/B integration, editing pipeline from Inference.

---

## UI layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 04 / Inference · Run Pipeline                          [Reset]  │
├──────────────────────────────┬──────────────────────────────────┤
│  READ-ONLY PIPELINE MIRROR   │  VALIDATED OUTPUT (unchanged)    │
│                              │                                  │
│  Start                       │  rules / quotes / final JSON     │
│    [01 Input: Legal Doc]     │                                  │
│      └─ drop pdf  OR sample  │                                  │
│    [02 Doc → Text]           │                                  │
│      ○ use cache  [Run from] │                                  │
│    ...                       │                                  │
│    ┌─ combine block ─────┐   │                                  │
│    │ [05 Combine]        │   │                                  │
│    │ [04 Company Input]  │   │                                  │
│    │   └─ drop word      │   │                                  │
│    └─────────────────────┘   │                                  │
│  End                         │                                  │
│                              │                                  │
│  [Run pipeline]  (primary)   │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

### 1. Read-only pipeline mirror

Reuse the **visual structure** from `pipeline-builder.tsx` / `segmentPipeline()`:

- Same step order, numbering, combine grouping (dashed box around combine + its secondary input).
- Show: step label, kind icon, I/O model names (or `inputType` for input steps).
- **Do not show**: label editor, prompt, model selector, code editor, add/remove/reorder, cache
  switch in the inspector, latency/cost stats from builder.

Extract a shared presentational component (e.g. `PipelineCanvas`) with a `mode: "edit" | "run"`
prop, or a thin `InferencePipelineView` that maps `segmentPipeline(modules)` to read-only nodes.

Invalid pipeline (I/O mismatch): mirror shows the same red borders as the builder; primary
**Run pipeline** disabled; per-step **Run from** disabled.

### 2. Per-input data slots

Discover all `input` modules in pipeline order (including combine-attached secondary inputs).

For each input module, render an **input slot** attached to that node:

| `inputType` | Slot UI | Becomes |
| --- | --- | --- |
| `pdf`, `word`, `excel`, `json`, `text`, `image` | Drag-and-drop + click-to-upload; accept extensions matching type; show filename badge + clear | `DocId` via `addDoc(file, "inference")` |
| `web` | URL text field + **Fetch** (or **Use sample** if project seeds a scraped page); show domain preview | `DocId` of stored scrape text (see backend §) |

Validation before run:

- Every **file** input slot must have a doc assigned (or explicit sample).
- Every **web** input must have a fetched/stored doc (URL alone is not enough).
- File extension / detected type should match `inputType` when possible; warn on mismatch, block run if incompatible.

**Use sample** per slot: pick the project's seeded inference doc whose type/name best matches
that input (scoped via `project.seedDocNames` / `docsForProject`), not one global sample.

Remove the single full-width drop zone at the top.

### 3. Per-step cache toggle

Each non-input step row shows:

```
[label]   [○ Use cache]   [Run from ▶]
```

- Toggle label: **Use cache** — when ON, `runPipeline` may serve this step from disk cache.
- Default: **ON** if a cache file exists for `(projectId, moduleId, model, relevant input hash)`; **OFF** otherwise.
- Toggle state is **run-scoped** (React state), not persisted on `PipelineModule.cached`.

**Deprecate / relocate** the "Cache results" switch in the Pipeline builder inspector — it
conflates "always cache this step in every run" with run-time choice. Options:

- **A (preferred):** remove from builder; cache control lives only on Inference.
- **B:** builder switch sets the default for the Inference toggle on first load.

### 4. "Run from" button

On each step (including combine rows as one logical step or split per combine + input — see
open question below):

- **Enabled when:** all steps with index `< this step` either (a) have cache available **and**
  "Use cache" ON, or (b) completed successfully in the current session (in-memory `outputs` map).
- **Disabled when:** an upstream step lacks cache and has not run this session, or pipeline is invalid.
- **Action:** call run API with `startFromModuleId` (or index) + current input doc map + per-step
  cache flags; engine hydrates `ctx.outputs` / `ctx.byModel` from cache for skipped prefix.

Visual hint when enabled: subtle primary outline or "cached prefix available" badge on the step.

Primary **Run pipeline** = run from step 0 with current inputs and cache toggles.

### 5. Progress + output

Keep existing progress bar, step status icons (`running` / `ok` / `cached` / `error`), and right-hand
validated output (rules, quotes, final JSON). Progress list should match the mirror order
(use `segmentPipeline`, not flat `modules.filter`).

---

## Backend / API

### Extend `POST /api/runs`

```ts
interface RunRequest {
  projectId: ProjectId;
  model?: ModelId;
  // AI : map each input MODULE to its doc — replaces single inputDocId
  inputDocs: Record<ModuleId, DocId>;
  startFromModuleId?: ModuleId;  // omit = run from start
  useCache?: Record<ModuleId, boolean>;  // per-step; default true when cache exists
}
```

Backward compat: if `inputDocId` still sent, treat as the first `input` module's doc.

### Cache probe (optional but needed for default toggles)

```
GET /api/cache?projectId=&inputDocs=<json>&model=
→ { [moduleId: string]: { hit: boolean; key?: string } }
```

Uses the same key function as `run_engine.ts` `cacheKey()` — **after fixing key bugs** (below).

### Web input ingest

New helper `addWebDoc(url, label?)`:

1. Fetch/scrape URL → plain text (placeholder: `fetch` + strip HTML, or seed file for demo).
2. Store as content-addressed doc with `type: "web"`, `name: hostname + path`.
3. Return `DocId` for the input slot.

### `runPipeline` changes

```ts
interface RunOptions {
  model: ModelId;
  inputDocs: Map<ModuleId, DocId>;       // replaces inputDocId + inputDocIds[]
  startFromModuleId?: ModuleId;
  useCache?: Map<ModuleId, boolean>;
  onStep?: (p: StepProgress) => void;
  persist?: boolean;
  liveHtml?: boolean;
}
```

Execution loop:

1. Build ordered list of input modules; assign docs from `inputDocs` (error if any missing).
2. If `startFromModuleId` set, find index `i`. For steps `0..i-1`:
   - If `useCache.get(moduleId) !== false` and cache hit → load into `ctx.outputs` / `ctx.byModel`
     **and run input-module side effects** (`inputQueue`, `sourceText`, `sourceDocId`).
   - Else if no cache → throw / return 400 "cannot run from here — step N not cached".
3. Begin loop at index `i` (or 0).
4. For each step, honour `useCache.get(moduleId)` before reading `module.cached`.

Fix known cache bugs while touching this:

- Cache key must include **all input doc ids**, **prompt hash**, and **code hash** where relevant.
- Cache hit on `input` / `doc-to-text` must still run context side effects (see TODO in `run_engine.ts`).

---

## Component breakdown

| Piece | Location | Notes |
| --- | --- | --- |
| `InferencePipelineView` | `components/inference-pipeline-view.tsx` | Read-only canvas + input slots + cache toggles + run-from buttons |
| `InputSlot` | same file or `components/input-slot.tsx` | File drop vs URL field by `inputType` |
| `Inference` | `components/inference.tsx` | Orchestrates state, API calls, output pane |
| `PipelineCanvas` (optional refactor) | shared with `pipeline-builder.tsx` | Only if duplication becomes painful |

### Client state

```ts
type InputAssignment = Map<ModuleId, DocRef>;
type CachePreference = Map<ModuleId, boolean>;
type CacheAvailability = Map<ModuleId, boolean>;  // from GET /api/cache

// session outputs for "run from" without disk cache
type SessionOutputs = Map<ModuleId, unknown>;
```

---

## Run button rules

| Control | Enabled when |
| --- | --- |
| **Run pipeline** | Pipeline valid; all input slots filled |
| **Run from** (step S) | Pipeline valid; slots filled; upstream of S satisfied (cache or session) |
| **Use cache** toggle | Always interactive; no effect if no cache file (step always executes) |

During run: disable all controls except **Reset** (after completion or error).

---

## Acceptance criteria

1. **Legal pipeline:** user drops legal PDF on slot 1, company PDF on slot 4 (combine input);
   run produces combined assessment; each file can be changed independently between runs.
2. **DB migration pipeline:** two JSON files on two input slots; no silent fallback to wrong seed file.
3. **Web-first pipeline:** first input is `inputType: "web"` — URL field shown, no file drop on that slot; file inputs still accept files on their slots.
4. **Cache:** after a full run, toggling cache ON for steps 1–3 and changing only the company doc,
   **Run from** combine step executes only downstream steps; billing reflects cache savings.
5. **Read-only mirror:** no prompt/model/code editable from Inference; layout matches Pipeline tab.
6. **Invalid pipeline:** run buttons disabled; mismatch hints visible on mirror.

---

## Open questions

1. **Combine block granularity:** one "Run from" on the combine step only, or separate controls on
   combine vs its document input? Recommendation: one control on the combine row; the attached
   input slot still needs its file before run-from-combine is enabled.
2. **Web scrape implementation:** real fetch on Vercel (CORS, robots) vs seeded scrape files for
   demo? Recommendation: seeded text for pitch; real fetch behind env flag.
3. **Builder cache switch:** remove entirely (option A) or keep as default (option B)?

---

## Implementation order

1. Requirements sign-off (this doc).
2. API: `inputDocs` map + cache probe endpoint.
3. `InferencePipelineView` read-only mirror + per-slot file drop.
4. Wire `POST /api/runs` from Inference with multi-doc payload.
5. Per-step cache toggles + cache availability on load.
6. `startFromModuleId` in engine + **Run from** buttons.
7. Web input slot + `addWebDoc`.
8. Remove/relocate builder cache switch.
9. Fix cache key + cache-hit side-effect bugs in `run_engine.ts`.

---

## References

- Current Inference UI: `components/inference.tsx`
- Pipeline layout: `lib/pipeline-layout.ts`, `components/pipeline-builder.tsx`
- Run engine: `lib/server/run_engine.ts` (`inputQueue`, `cacheKey`, `RunOptions`)
- V0 prototype (multi-file list): `V0 frontend prototypes/v1/.../inference.tsx`
- Input types registry: `INPUT_TYPES` in `lib/server/types.ts` (`web` = "Web")

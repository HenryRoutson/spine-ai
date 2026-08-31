# Spine product specification

This is the complete product spec in AI prose. It expands the running feature dump in `combined_full_stack_specification.md` (kept as the raw checklist) and folds in the type, share, authoring, and platform plans. If a later prompt contradicts this file, update this file and log the prompt in `docs/prompts.md`.

Spine is the working name of the product in this repo (`combined_full_stack/`, landing page, ops dashboard). The public site is spine-ai.dev.

---

## 1. What Spine is

Spine is an **AI engineering pipeline builder**. A user turns messy documents and a task into a **typed, checkable, cacheable series of steps** whose every hop is validated against a structure. The product is not a generic chatbot that “does the work” in one hidden loop. The product is the **visible spine**: input → convert → reason / transform / join → output, with implicit schema validation on every edge.

That spine exists so work can be:

1. **Checked.** Intermediate structures make it obvious which step went wrong.
2. **Split.** Hard LLM jobs become smaller typed jobs (batch a list of rules; select relevant examples; merge the results).
3. **Reused.** Structures and steps are modular across projects.
4. **Cached.** Identical step input does not get billed twice.
5. **Shared.** The same graph can be a UI link, a hosted API, a marketplace listing, a website binding, or exported code.

A **project** is a development group: one set of **structures** (types = Zod/Pydantic = SQL tables), one or more **functions** (each function is a pipeline), a **document store**, and optional **websites** that bind those functions. Non-technical users start from a single prompt (Vibe). Technical users edit structures, steps, custom code, SQL, and exports. Consumers never see the builder; they run shared links and marketplace pipelines.

There is **no vector RAG**. Traceability is **quotes** (source-linked spans) and **example select** (cheap per-item LLM relevance). Retrieval-by-embedding is out of scope on purpose.

The **JSON IR** (`pipeline.json` / the `modules` array) is the portable graph. The UI, CLI, MCP, seeds, language exports, and Windmill OpenFlow all consume that IR. Vibe authors ordinary TypeScript (`workflow` / `task` / `generateObject`); `compileSpineJs` traces it into the same IR. Caching, mermaid, and per-step traces are **derived**, not extra JSON fields. Hosted React sees the generated OpenAPI types (`contract.d.ts` / `pipeline-client-contract`), not the graph.

---

## 2. Product principles

**One type system.** A Structure is the Pydantic/Zod model, the SQL table annotation, and the runtime validator. There is no separate “database schema” tab and no pydantic↔SQL linking homework.

**Validation is implicit.** There is no “schema validation” step. Every hop checks that the upstream output type equals the downstream input type (including list vs single). Invalid pipelines disable Inference and Testing.

**The pipeline tab is the backend.** Functions live there. Websites are a different object that bind functions. Do not nest a page studio as the only home of a pipeline.

**JSON is the IR; TypeScript is authoring.** Cross-language export prints from JSON. Intensive steps may be Rust or Python inside a TS-authored graph. Default vibe authoring is `workflow()` / `task()` / `generateObject` TypeScript; `SPINE_VIBE_AUTHORING=json` is the opt-out (old graph-JSON LLM path).

**Quotes over RAG.** If an LLM extracts text, the user clicks it and jumps to the source span. Example select filters a candidate list with `is_relevant` + reasoning, not embeddings.

**Frontend is presentation.** The Next.js app renders store, types, run engine, and documents. Execution, persistence, billing, and OpenRouter/custom providers live in `lib/` and `/api`.

**Graduated complexity.** Three audiences share one product, not three products:

| Audience | What they see first | What is hidden |
| --- | --- | --- |
| Consumer | Run shared links and marketplace | Structures, Pipeline, Testing |
| Builder (non-technical) | Vibe → run the pipeline | Full type IR, export lint, custom providers |
| Builder (developer) | Structure → Pipeline → Testing → Inference | Nothing material; full stepper |

Starting a project is a **single prompt**, then feedback on what was built, so the agent’s one-shot ability improves.

---

## 3. Object model

```
Project (shared types + storage + last-opened)
├── Structures[]     type = CREATE TABLE / Zod / Pydantic. Rows optional.
├── Type aliases[]   standalone TypeExpr names (quote_id_t, list[list[int]], …)
├── Functions[]      each function is a pipeline (ordered modules + label-keyed state)
├── Documents        content-addressed (hash = id); available-in project list
├── Docs             project markdown + derived mermaid of the pipeline
├── Tests            *_testing.json documents
├── Inference setups *_inference.json named input assignments
├── Cache            step I/O keyed by fingerprint
├── Runs             immutable pipeline snapshot + step trace + billing
└── Websites *──n    hosted pages bind any functions from any project
```

**Do not add a Data tab** that duplicates Structures. SQL preview and stored rows live on Structures.

**Mix and match**

- A structure is attached when a step’s `inStructureId` / `outStructureId` / TypeExpr names it. Click the chip → that step.
- Websites bind functions many-to-many (`pipelineBindings: { alias, projectId, functionId? }[]`).
- Rows are keyed by structure and shared by every function in the project.
- Type drift across projects is avoided by keeping groups small; unify/merge across projects is later.

**Storage plan.** Today: JSON maps on `Project.structureRows` / `projects.data`. Next: `public.structure_rows` with RLS. Later: isolated Supabase per hosted site; live SQL at run time. `schema.sql` is a **type annotation** until the run engine reads tables. Example-select `{example}` is a VIEW (projection); the spine still carries the full row.

---

## 4. Surfaces and navigation

### 4.1 Primary sections (L0)

Every signed-in session shares four header sections:

| Section | Builder | Consumer |
| --- | --- | --- |
| **Run** | — | Shared with me, marketplace, active shared run |
| **Build** | Workspace with an active project | Goes to project picker / builder |
| **Billing** | Account billing (hides workspace tabs) | Account billing |
| **Settings** | Account settings (hides workspace tabs) | Account settings |

Account Billing / Settings are **not** the same as project Billing / Settings.

### 4.2 Builder workspace tabs (L1)

Numbered horizontal tabs under the header. A blocked tab turns destructive and does not run. Validity is a **waterfall**: broken types disable Pipeline; a disabled Pipeline disables Testing and Inference; unpaid billing blocks run with a Billing CTA.

| # | Tab | Role |
| --- | --- | --- |
| 01 | Structures | Shared types, type aliases, code preview, examples |
| 02 | Pipeline | Function editor — step canvas + inspector |
| 03 | Testing | Partial expected I/O, expected errors, pass/fail |
| 04 | Inference | Named setups, run, live trace, outputs |
| 05 | Share | Link, API, marketplace, websites, activity |
| 06 | Earnings | Creator balance from paid shares |
| 07 | Logging | Canonical run trace |
| 08 | Cache | Browse cached step I/O |
| 09 | Documents | Upload, view, derive structures, availability |
| 10 | Docs | Project markdown + derived mermaid |
| 11 | Project billing | Per-project usage |
| 12 | Project settings | Langfuse export and project prefs |

Logical groupings exist in config (`Build` / `Deploy` / `Observe` / `Library`) and should become L1 area tabs plus a Build stepper (01–04). Today they are twelve flat peers.

### 4.3 Routes

| Route | Mode | Purpose |
| --- | --- | --- |
| `/` | workspace or consumer | Builder if a project is active; consumer Run if not |
| `/projects` | picker | Gallery — no active project loaded |
| `/run/[id]` | standalone | Public/shared link runner (no sidebar) |
| `/site/[id]` | standalone | Hosted website |
| `/embed/[id]` | standalone | Embeddable runner |
| `/demo` | embed | Landing / marketing preview of builder tabs (run buttons dead) |
| `/login` | — | Sign in / sign up |
| `/privacy`, `/terms`, `/cookies`, `/accessibility` | — | Legal |

`/projects` exists so selecting a project does **not** checkout/switch-load in a loop. There is no active project while in picker mode. Opening a project sets `activeProjectId` and navigates to `/`.

If a signed-in user has **zero projects**, the shell is replaced by a no-projects page (templates + blank CTA, no tabs).

### 4.4 Consumer mode

Users without a project (or who cleared the active project) get a slim Run view: Shared with me, Marketplace, and an optional full-screen shared run. They do not see Structure / Pipeline / Testing. Billing and Settings remain via L0.

### 4.5 Shared chrome

Always available once a project is active:

- Project selector (create, rename, clone, delete, switch). Selected project is highlighted. Created-at is shown. **Last opened** is stored per project; load opens the latest so the same stale project is not forced every time. Hover/focus prefetches `GET /api/state` so switch skips the loading overlay when ready.
- Default LLM model picker (provider and model are separate: `openrouter:gpt-5-mini` vs `custom_provider:gpt-5-mini`).
- Account menu (email, sign out).
- Running jobs hub, project agent dock toggle, diagnosis-agent hub, feedback.
- Global document viewer (text / PDF / JSON / image; quote-span highlight; Esc to close).
- Resizable splits on list + canvas layouts.

Signed-in users persist to Supabase per user. Anonymous users use a local store.

---

## 5. Sign in and out

Supabase email + password at the top of the screen and on `/login`. Success redirects into the app. Sign out returns to `/login`. Shared “you pay, no sign-in” links may run without an account. “Receiver pays” always requires sign-in so billing can attach.

---

## 6. Projects

A user selects among **active projects**. They can:

- Create a blank project.
- Clone bundled example projects.
- Clone from the marketplace.
- Rename or delete a project.
- See created-at (and last-opened) in the UI.

The selector lives in the header on every builder tab. The dedicated `/projects` page is the place to browse without forcing a checkout.

### 6.1 Bundled example projects

These are the default teaching set. They must actually run, not merely exist as empty graphs.

1. **Company legal evaluation.** A legal-requirements document plus a company-implementation document. The pipeline breaks the law into **atomic rules** (batch LLM), assesses each rule against the company pack, and produces a spreadsheet of pass/fail plus consequences. Inputs are diverse (PDF, Word, text). Quotes on extracted rules click through to the source span.

2. **Legacy SQL migration.** Map old table field names to new field names and likely data flow. When mapping is many-to-one (or one-to-many), include a field of Python that produces the target field.

3. **GPS site profiling.** A set of coordinates. Using inherent model knowledge (not a maps API), profile what the sites have in common — “Russian nuclear bases”, “scenic waterfalls”, “towns named Jeremy”. Parallel LLM calls.

4. **Parallel LLM example.** The simplest batch: ten trivia questions at once, typed list of answers.

5. **Whole book writer.** Brief → LLM chapter list → batch-LLM each chapter → join into one markdown manuscript exportable as `.md`.

Harder greenfield prompts (KYC, quantum, tax monitoring, investment-banking diligence, Australian PTR) live in `docs/example_prompts.md` and should remain buildable from Vibe.

### 6.2 Project description

Each project has a text editor and optional markdown preview. This is the high-level brief the agent reads first so it does not rediscover the project from steps alone.

---

## 7. Structures (types)

Structures are the shared type system for every function in the project.

### 7.1 What a user can do

On a **structure** (named model / table):

- Create, rename, delete.
- Docstring-style description on the whole model.
- Add / rename / delete fields.
- Change field type, description, optional flag.
- Mark a field **deterministic** (exact-testable) vs probabilistic (summaries, free prose).
- Set numeric **test tolerance** (`±`) on int/float fields — field-level, not per test.
- Provide **multiple positive examples** and a **list of negative examples**. Examples are injected into prompts automatically. They must **validate** as the field’s type (no raw commas-in-CSV hacks, no “random text” in a number field). Opening the example list uses a JSON/schema editor popup, not a single spreadsheet cell.
- Nest another model as a field type. A cycle where **nothing** in the cycle is optional is a validity error.
- **Quote fields** — text paired with a source-document span. After any LLM step that emits them, a locked **Link Quotes** step resolves strings to offsets.
- PK / FK **relations** on fields (`id` is treated as PK if none is marked). Relations are SQL annotation; runtime values stay JSON until live SQL lands.
- Quick **AI summarise** per structure — not a replacement for human descriptions; a lint that catches `document_summary: int`.
- Preview generated code: Pydantic, TypeScript/Zod, Rust, Go, BAML, and `schema.sql`, with syntax highlighting.
- Ask an AI assistant to propose model edits; apply only after approval.

On a **type alias** (standalone type, not a fielded struct):

- Click a placeholder and build `list[list[int]]`, `dict[str, str]`, branded names like `quote_id_t`, or unfilled `set[UNSET]`.
- This is a dedicated page/mode — it does not pretend to be the struct field grid.

### 7.2 TypeExpr

The IR for every spine edge and every field is **TypeExpr**: primitives, document, quote, `text_quote`, list, optional, set, map, union, generic, model ref, file(inputTypes), unknown. Cardinality lives on the type (`list[Rule]`), not on a parallel `outIsList` flag. Custom-code stubs must be generated against those signatures, not `unknown`.

SQL DDL is the human/LLM-facing spelling of the same IR (`docs/sql_types.md`). Prompt VIEWs project columns into `{example}` / `{input_to_prompt}` without dropping fields from the spine row.

### 7.3 Locking and provenance

Auto-generated structures (combine products, inferred homework marking schemas, upload-derived sheets) are **locked**. Clicking a locked field shows a clear error: this struct is locked, and **why**.

A structure inferred from a file keeps `sourceDocId` and a clickable link back to that document.

### 7.4 Derive from files

A file-upload affordance derives a structure from Excel / CSV / JSON.

- Each sheet becomes a type; a **combined** type has one field per sheet, with a **sheet prefix** on sheet-level structs.
- On upload, the system matches existing structs and **adds** the parts that do not match (e.g. existing `Tree[Node]` + new `CyclicGraph[Node]` → reuse `Node`, add `CyclicGraph`). The same pass runs on files already in the store.
- Matching and derivation are available from the Documents tab as well: click a derived model to add it to Structures.

### 7.5 Dynamic schemas

Some tasks cannot hardcode the output shape. Homework marking: the sheet becomes text, then an LLM must emit a **MarkingSchema** whose fields are question 7a/7b/… with criteria inside. Structures may be marked **dynamic**: output must adhere to a generic envelope and is validated the same way, with the concrete field set inferred per run.

### 7.6 Views vs types

Complex nested JSON is always viewable as **tree / table (spreadsheet) / raw JSON**. Media (audio, video, later 3D) is `file(inputTypes)` or a Document row — **not** new TypeExpr kinds. A **view binding** (builtin player or project visualizer) decides how inference, logging, and share render a value. Data vs view is the same split as TypeExpr vs SQL DDL (`docs/media_and_custom_views_plan.md`).

---

## 8. Pipeline (functions)

A function is a **left-to-right spine of labeled steps**. The canvas shows a box per step: icon, kind, description, input type, output type. Step labels are **unique** across the pipeline. Accumulated state is a Pydantic/Zod object keyed by those labels. Custom code and webhooks receive `{ input, state }`.

The graph is **series-parallel**, not an arbitrary mesh:

- The root is linear.
- **Fork** introduces nested linear lanes and a join (product / assemble / merge).
- **If/Else** and **Case** are exclusive; without a **Join**, each taken arm is a sink and the spine stops.
- **Parallel LLM** is a legacy fixed-branch helper; new graphs should Fork.
- Extra files after the first input come through **Combine**, not a second root Input (except inside constraints the factory already encodes).

Arrows should follow **derived dependencies** (which labels a step reads). Unused or disconnected islands are errors. A visualisation option shows **execution order that maximises parallelism**.

There is **no user-facing RAG step**.

### 8.1 User-addable step kinds

| Kind | What it does |
| --- | --- |
| **Input** | Ingest any **subset** of input types (not just one). Optional default document. Filename filters (e.g. must contain `legal_regulations`). Optional LLM **input-description** check before the rest of the run. JSON-native types parse directly; non-JSON types get an auto **Convert to text** / structure-parse step. The input type cannot be changed away from Document unless the slot is JSON — do not silently load a PDF into an arbitrary JSON model. |
| **LLM Call** | One structured response against an output schema. |
| **Batch LLM** | List in → one structured call per item (bounded concurrency) → typed list out, input order preserved. `structureOut` is the **item** type. |
| **Example select** | Filter a candidate list with a cheap per-item LLM (`is_relevant` + chain-of-thought). Not embeddings. Optional pre-filter cap. Prompt-cache region preview in the builder. `{example}` may be a SQL VIEW / field list; passthrough is the full row + `selection_reason`. |
| **Custom code** | TypeScript or Python with an **ordered fallback list**. Default max runtime **60s**; overrun returns a time profile and the last line executing. TS runs in the browser and submits results to the server (efficiency + sandbox). Compile errors invalidate the pipeline. Failures are stored, hashed (whitespace-insensitive), and similar code can be matched via keyword + git diff. |
| **Transform** | Deterministic reshape (unwrap/wrap lists). Optional custom reshape code. |
| **Combine inputs** | Merge a **new upload** with accumulated state into one structure. After the first input, further files use Combine — implicit combine with prior labels is otherwise enough. |
| **Assemble** | Zip the current spine with named prior labels into one flat structure (no LLM; not Combine). |
| **Chunk** | Split document text into sized/overlapping chunks as a list. |
| **Merge** | Recursive structural merge with per-path `MergePolicy` (`*` / `**` globs). See §18. |
| **Assert** | Code or golden checks over `state["Label"]`. Passthrough on success. This is **not** the same class of error as input-compatibility (paired-file MATCH/MISMATCH). |
| **Human review** | Pause the run for approve/reject. Passthrough on approval. |
| **Webhook** | Server-side HTTP POST/PUT/PATCH. Body is spine `{ input, state }` (wrap) or raw typed JSON. Secrets via env. Optional poll + media ingest. Not a vendor catalog. |
| **SQL** | SELECT/UPDATE/INSERT/DELETE against hosted `app_sql_rows` for the website or project. **Never cached** — a cache would freeze shared numbers after the first write. |
| **Transform piece (n8n)** | Typed local transform (Set, Filter, CSV, Hash). JavaScript on the spine. Does not call Slack/Gmail. |
| **Connect app** | Live Slack / Gmail / Sheets via OAuth (Nango). Hidden in Vibe. Typed in/out. |
| **Chatbot** | Pause for prompted chat. Input locked to `ChatbotPrompt`, output `ChatbotResult`. Single exchange or until Exit. |
| **Output** | Named snapshot of a structure **anywhere** on the spine. Multiple outputs are allowed. Inference’s finished view emphasises these. |
| **Fork / If-Else / Case / Join** | Control-flow as described above. Notes are required. |

### 8.2 Auto-managed (locked) steps

Inserted by the system when needed; the user does not add them by hand:

| Kind | When |
| --- | --- |
| **Convert to text / structure parse** | Non-JSON inputs must become `Document.content` or a typed model. Built-in parser or DeepSeek OCR (`is_use_ocr` on PDF and Image). Cached per document. |
| **Link quotes** | Output schemas include quote fields. Deterministic match of verbatim strings → byte offsets. Zero LLM cost. Walks the **structure** to find quote fields; does not brute-force the whole dict. |

JSON vs not-JSON for inputs (the user should never have to think about this; the canvas visualises the locked convert step):

| Type | JSON-native? |
| --- | --- |
| Excel, JSON | Yes — parse to a structure inside the step |
| PDF, Word, Text, Markdown, LaTeX, Web, Image, Audio, Video | No — locked convert / OCR first |

### 8.3 LLM-step behaviour

- Default models are **cheap** (DeepSeek-class via OpenRouter unless a custom provider is selected).
- Optional **first free-text response** before JSON (think without formatting; [arXiv:2604.03616](https://arxiv.org/pdf/2604.03616)). Auto-enable on a step that failed validation and is retrying.
- Per-step **cache toggle**.
- Per-step **cost limit**, default **$1**.
- Optional **output-description** check: a cheap long-context model judges whether the output matches a prose description; mismatch raises. Toggle per step (expensive). Settings can make input descriptions **mandatory**. These checks are billed separately as **Description Validation cost** under logging’s mean-cost graphs.
- All LLM inputs and outputs are **stored and cached**. This is training-data / valuation inventory. **On-prem / private deployments** must be able to keep this data on-site.
- Prompt text is stored as **structured components** and flattened only when sending to the model. Do not persist 1,000 copies of a denormalised document inside prompts.

### 8.4 Custom-code fallbacks

Either a list of `(language, source)` pairs or:

```json
{
  "fallbackList": [
    { "typescript": "(input) => JSON.parse(input.body)" },
    { "language": "python", "code": "import json\nreturn json.loads(input['body'])" },
    { "language": "typescript", "code": "(input) => input" }
  ]
}
```

Languages tried in order until one compiles and returns a value that validates.

### 8.5 Validity, warnings, and the canvas

- Adjacent I/O mismatch → **invalid** (red connection). Buttons on the edge: coerce `x→y` on step *n*, or `y→x` on step *n+1*.
- Duplicate / empty labels → invalid.
- Uncompiled custom code → invalid.
- Output step with no model selected → invalid.
- Using the same structure many times as in or out → **warning**.
- Choosing JSON as an input type instead of a structure → **warning**.
- Isolated / unused steps → error once dependencies are derived.
- Input and output struct names on a node are **clickable** and jump to Structures focused on that model.
- A dedicated control on Input steps jumps back to the bound **document**.
- **Generate summary** produces a prose summary of the current pipeline and its issues.
- Pipeline AI sidebar sees validity errors and **requires approval** before applying edits.
- If types are broken, **pipeline editing is disabled**. Disabled tabs are red. Fix billing → pipeline → inference in that order.

### 8.6 Input pairing / early compatibility

Filename filters are not enough. A “marking guide” and a “homework sheet” can both match `*guide*` / `*homework*` and still be the wrong pair (grade 10 vs grade 3, different question sets).

After **both** files are uploaded (never block upload A on upload B):

- Compare extracted keys: JSON paths, regex captures, question-id sets, dynamic schemas.
- Show **MATCH / MISMATCH / MISSING** per variable in the UI (`MATCH assignment names, MISMATCH assignment questions, MISMATCH assignment year`).
- This is a different error class from Assert; it is shown to the user as compatibility, not as a failed code assertion.

Name parsing (`marking_guide_SPLIT_grade10.txt`) is allowed but janky; prefer metadata and derived structure fields.

### 8.7 Export and “view as code”

The whole pipeline exports as a self-contained bundle:

- TypeScript, Python, Rust, Go, BAML, Swift, Kotlin (supported export set; Swift/Kotlin may lag).
- Connector servers (HTTP and gRPC).
- Inference UI, setup guide, env template, project documents.
- Hosted-site files when a website is in play.
- **No secret env keys** embedded. Generated code is **linted** before download.

The export dialog has per-language download buttons and a zip of the full bundle. A valid pipeline must produce **zero lint errors** in every language. CI asserts this before prod. In prod, any lint error on export is recorded in Supabase to be fixed.

There is always a **view whole pipeline as code** mode. Copy actions:

- Pipeline JSON only.
- Pipeline JSON + all exported sources + their lints.

OpenRouter (or the active provider) is exported as the default client, with syntax-highlighted examples in every language. Custom providers export too.

### 8.8 Authoring: JSON IR vs TypeScript workflows as code

The OpenFlow-shaped node/edge dialect has no pretraining prior; typed TypeScript does. Structured decoding does not fix semantic mistakes. Vibe therefore asks the model for ordinary async TypeScript, not a modules JSON array:

1. **Workflows as code (default).** `export const main = workflow(async (files) => { await task(fn)(file) })` plus `generateObject({ schema, prompt })`. Tracing lowers `for` → llm-batch, `Promise.all` → fork, two args → combine/assemble, `step()`/`flatMap` → custom-code. `input()` / `llmBatch()` inside `workflow()` still compile (IR constructor).
2. **JSON IR.** Portable compile target. UI, exports, OpenFlow. `SPINE_VIBE_AUTHORING=json` still lets the model emit the modules array (A/B opt-out). There is no JSON fallback when TS authoring is on.
3. **Lower-level `pipeline()` DSL.** Still compiles. Not what the LLM is asked to write.

Pass is compile + I/O + semantic checks (two distinct test docs; no empty/passthrough pipeline). Schema-valid is not done. The React/Lovable step sees `run()` types from `contract.d.ts` / OpenAPI (`pipeline-client-contract`), never the graph.

Flags: default TS; `SPINE_VIBE_AUTHORING=json`; `SPINE_VIBE_HARNESS=1` (write/`run_tests` loop on `pipeline.ts`).

**Reward hacking is forbidden.** Matching the user task string to few-shot Example 1–5 and pasting that payload is not a test. Retrieve 1–3 nearest TypeScript examples in the prompt. Live OpenRouter is the coding-performance comparison. Details: `docs/json_vs_library_product_spec.md`.

---

## 9. Testing

The Testing tab is for **pinpointing which step is wrong** before Inference (Inference is the demo/run surface). As much checking as possible should already happen in design: “does this type flow into the next step?” is cheaper than a full test file.

### 9.1 Test files

- Named `*_testing.json`, checkbox icon.
- Validated against the **current** pipeline shape; when the pipeline changes, tests must be visibly adaptable (not silently stale).
- AI can author one test or a suite.
- Tests need **not** cover every step. Expected values on 3 of 8 steps is valid. Ten tests on one step and none on the others is valid.
- Every bundled example should ship step-by-step tests.
- Editing is a **UI generated from the Pydantic/Zod model**, not loose JSON.

A test may specify:

- Input document assignments (including Combine uploads).
- Per-step expected outputs (partial).
- **Expected errors** — specific (e.g. “wrong homework → fail input validation; nothing else runs”). No catch-all “this test fails”.

### 9.2 Comparison

- **Deterministic** fields: exact compare.
- **Tolerance** fields: numeric `±` from the field, not from the test.
- **Probabilistic** fields: LLM judge, or skip.
- Whole-document LLM overview of actual vs expected JSON, in addition to per-field checks.
- Key order inside objects must not create false diffs.
- **Confusion matrices** / group-by on fields for mapped values.
- Expected vs actual: if line counts match, scroll **together** and paint mismatch lines red **behind** the check-type highlight (deterministic / tolerance / LLM). If counts differ, git-style diff. Diff colours: `+` green, `-` red. On 1:1 line mismatches, append `// not "{actual}"` so copied text carries the difference.

### 9.3 Alignment with the live pipeline

A view lines each test step up with the **current** pipeline and marks **orphaned** steps. Because every step is typed, remapping test data onto a renamed/reordered spine should be a visual reorganise, not a rewrite.

### 9.4 Run, persist, history

- Run one test, or **run all**.
- Results write to Logging with a **test** tag and the same UI plus error visualisations.
- Sidebar shows last pass/fail per test.
- Pass/fail **cannot live only in the UI**. Persist in Supabase a hash of (pipeline + test). Change-and-revert restores the known result. No “disable because we think it is stale” sync logic. Copies expire in ~**7 days** unless git-history integration keeps them longer.
- Each test has a **run history** (list of logs) that ignores later edits to the test or pipeline when you open a historical entry.
- Last-run pass/fail on the test selector resets when the hash changes.

---

## 10. Inference

Inference is the run surface for humans (and the observe pane for Vibe).

### 10.1 Setups (not a single default)

There is **no single default setup**. Named setups (`*_inference.json`) reuse the same backend as test input assignment. Examples: homework grader “10th grade” vs “pre-school”; “university (LaTeX)” vs “1st grade”. The tab also offers presets loaded from tests.

### 10.2 Choosing inputs

- Documents already live in the Documents tab (no repeat upload on every run).
- Slots are filtered by input type, filename rules, and JSON structure.
- **JSON + typed `structureOut` (not Document)** has three modes: **From file** (store pick), **Branch off** (copy values into a form; source file untouched), **Create empty** (schema defaults). Apply writes a **new** file and assigns it — never looks like in-place edit of the store file.
- After paired uploads, **Input compatibility** (§8.6) shows MATCH / MISMATCH / MISSING **before** Run.
- Agents always write input descriptions so the run can fail on bad data instead of bad code.

### 10.3 Run

- Shared **Run with stop** control: play icon → loading + stop. Stop is one code path everywhere (Inference, tests, shared links).
- Invalid pipeline → Run disabled (go fix Pipeline / Structures).
- Insufficient credits → CTA to Billing.
- **Run fingerprinting:** identical pipeline + inputs offer “open the prior log” instead of re-executing. Toggle to allow or collapse duplicates (denormalise, visualise how many were caught).
- Live server log, **broken down by step**.
- Run notes (why this run) — editable later in Logging, searchable.
- When finished (or cache-hit), a button goes to Logging.
- Custom-code preview in the run view: syntax highlighting, language chip, ideally line-by-line / last-line profile when stuck.

### 10.4 After the run

- **Minimise everything except Output-step artifacts.** Intermediate logs stay in the step trace, collapsed.
- Final output: JSON, spreadsheet, and custom views (video, plots, project visualizers).
- If a linked test exists, show TestResults here too.
- Previous chats with the Spine agent are listed, date-sorted, month separators.

---

## 11. Share, marketplace, and websites

### 11.1 Three ways to share a function

| Mode | Receiver gets | Ownership | Monetisation |
| --- | --- | --- | --- |
| **Code** | Export / clone they can edit | Moves to receiver (`sender → @receiver@`) | Not metered |
| **Link** | Inference UI on this pipeline | Stays with sender (`@sender@ → receiver`) | Markup and/or flat fee |
| **API** | Hosted HTTP inference | Stays with sender | Markup and/or flat fee |

Link and API can be **direct** or listed on the **marketplace** (searchable, free or priced). Creator can hide or show **viewer uploads** from themselves.

Clone-for-edit (“share the pipeline with all details so someone can copy it like the examples”) does **not** mutate the sender’s copy.

### 11.2 Who pays

Diagram, always visible:

- `$ sender $ → receiver` — You pay, sign-in required **or** You pay, no sign-in.
- `sender → $ receiver $` — Receiver pays (sign-in required).

Some deployments are **assets** (earn), some are **liabilities** (you fund them). After create, the creator can edit **credit / spend limits** on liabilities. Billing rows **survive** deployment delete.

### 11.3 Hosting and activity

- Live deployments: power toggle (temp disable) and trash.
- Scalable hosted API in a few clicks; monitor usage; take down.
- **Deployment activity:** filterable feed of who ran which link/API, what they uploaded, spend.
- Separate page/list of runs: who was signed in, files, pipeline.

Earnings from links/APIs land in **Earnings**, not the creator’s usage credits (until they withdraw).

### 11.4 Websites

A **website** is not a pipeline. It is a hosted page (`site_` link, `/site/{id}`) with brand, auth, HTML or React runtime, and **bindings** to functions:

- `{{run}}` / `{{run:alias}}` and React `<RunPipeline alias="…" />`.
- `{{sql:table}}` and `{{action:alias}}` for hosted SQL.
- Page assistant may edit HTML/CSS/brand, **not** the bound pipelines.
- Lovable-shaped studio (Vibe/Code, desktop/mobile preview) lives on the **website**, not as the only Share home of a pipeline (`docs/pipelines_and_websites_plan.md`, `docs/lovable_parity_plan.md`).

**Lovable connect:** a button copies a prompt that tells Lovable (or similar) how to call the hosted API.

### 11.5 Consumer “Shared with me”

Paste or pick a link → Shared run panel (same input slots, human review, step trace, outputs as Inference). Marketplace browse clones or runs templates.

---

## 12. Agent (Vibe) and MCP

The agent is connected to **MCP** and **OpenRouter** (or custom providers) on frontier models.

- Cursor-style **UI picker** / highlighter: select a region of the app as context (use an existing library).
- Pastes become **chips**, not raw dumped text.
- Highlighting a span of the agent chat adds it as context without copy-paste.
- `@` mentions: files, UI regions, steps, structs.
- Team members can see chats on a shared project.
- **Project assistant** is a streaming dock for whole-project proposals (structures, pipeline, docs). **Approval before apply.**
- Vibe observe tabs (Inference / Schedule / Share / Logging) are **observe-only**. Chat owns edits.
- Starting from a single prompt, then iterating, is the intended builder-developer loop.

CLI and `mcp_tool/` are first-class clients of the same session snapshot as the React app.

---

## 13. Logging

Logging is the **canonical in-app trace**. Langfuse is optional secondary export.

### 13.1 Run list and detail

- Each run is green or red (pass/fail).
- Search by editable run description.
- Selecting a run shows an **immutable copy of the pipeline** as it was (editing the live graph does not rewrite history).
- Per step: input, output, model link, cost, latency, server logs (hidden by default; setting). Logs are **attributed to steps**, not one blob.
- Syntax-highlighted JSON; collapsible tree; **Excel popup** for non-technical viewing. Setting chooses default display (excel / json / other).
- Each input links back to the original document.
- Quotes: source documents colour-separated; click a quote → viewer scrolls to the highlighted span.
- Automatic JSON extractor inside prompts/responses: split JSON out and highlight it even if the model did not label it.
- Prompt display: each **component** highlighted and profiled for context-length contribution; files outlined and linked to Documents.
- **Example-select verdicts:** per-candidate kept/excluded + reasoning.
- **Retry grid:** `n_prompts × (max_retries + 1)` (column 0 is the first attempt).
- End-of-run graphs: cost and latency **across steps** (who dominates); LLM-call distributions (prompt chars, completion chars, latency).
- One button copies the **entire** run (failures included, pipeline snapshot included).
- **Diagnosis agents** auto-spawn on failed runs and can be launched manually to debug an isolated error.

### 13.2 Langfuse export

- Opt-in per project (`Project.langfuseExport` in Library → Settings). Off by default.
- Credentials only on the server: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, optional `LANGFUSE_BASE_URL`. Never in the browser or export zip.
- Fire-and-forget; SDK errors never fail a run.
- `traceId` = `createTraceId(runId)` so resumes correlate.
- Successful export stores `langfuseTraceId` / `langfuseTraceUrl`; Logging shows “Open in Langfuse”.
- Mapping: `PipelineRun` → root chain; `RunStep` → span; each `LlmCallRecord` → generation; description-check calls prefixed `input-desc:`.
- Prompt/output truncated (~24k chars) for export; full text stays in Spine.
- Langfuse does **not** replace Testing diffs, the builder, cache, billing, marketplace, or prompt A/B.

---

## 14. Documents

Content-addressed store: **hash = id**, dedupe on collision.

- List all documents with size; open in the unified viewer.
- PDF / Word / image: (1) raw derived markdown, (2) formatted markdown, (3) original, (4) OCR with bounding boxes (DeepSeek-class).
- CSV / Excel / JSON: original, JSON, or spreadsheet. Schema-guided **Edit (immutable)** — source file is never overwritten; save requires a new name and creates a new hash row.
- Flag and **block** uploads containing `confidential` until the user explicitly approves.
- Upload matching: show which existing structs match; offer to add new ones (§7.4).
- Documents default to the project they were uploaded to; an availability list can share them across projects.
- Any JSON view (anywhere in the app) has a **download** button.
- “Previous runs” artifacts (step I/O, timestamped inputs) live here with a static structure attached.

---

## 15. Cache

Browse cached step inputs and outputs across runs. Search. Inspect with the same JSON / spreadsheet viewers as Logging. LLM steps honour a per-step cache toggle. SQL steps never cache.

Prompt-cache **preview** in the builder shows cached vs per-run vs per-candidate regions for LLM and example-select steps.

---

## 16. Docs (project documentation)

Project markdown: rules and context for assistants. Preview renders an **auto-derived mermaid** of the current pipeline (not hand-drawn). This graph is the same derivation used in export and landing traces.

---

## 17. Billing, earnings, and settings

### 17.1 Account billing

- Current credit; top up or subscribe; refresh.
- Spend breakdown **by model**, sorted by spend; cache savings called out.
- Time series of total and per-model spend.
- If a run cannot start for funds, Inference shows a Billing button.
- **Profit-per-user** (virtual or concrete table). Main cost is LLM. Block the account if value goes below **−$10**. Guard against arbitrage of mispriced models.
- Markup is a **dated %** (`applies_from`–`applies_to`) so every call need not store a snapshot; a virtual table denormalises it.
- Model **potential loss** as if every user spent their remaining free credit tomorrow — a buffer, not “we look green until they dump the grant.”

### 17.2 Project billing

Per-project usage chart. Description-validation cost is a separate series under mean cost in Logging.

### 17.3 Earnings

Creator balance from shared links and hosted APIs. Withdraw to account billing credit. Confirm withdraw.

### 17.4 Settings

**Account**

- JSON syntax highlighting: **App** (green strings, blue keys, orange numbers) vs **Editor** (peach strings, cyan keys).
- Default JSON reader: **Tree** / **Table** / **JSON**.
- Logging: hide server logs by default (on).
- Pipeline / inference toggles (duplicate-request collapse, mandatory input descriptions, …).
- Colour scheme, privacy, teams.
- **LLM providers** page: OpenRouter is a **locked example**. Add a provider as custom code with a required function signature; persist a client; support batched responses when the vendor has them. Historical errors hashed like custom-code steps. Provider and model are separate enums. Needed for on-prem / firm-internal LLMs (e.g. KPMG).
- Secrets (library).
- Teams: shared projects, invites, membership; **team owner billing**; read-only team viewing. Team chats visible to members (§12).

**Project**

- Langfuse export toggle (§13.2).
- Other project prefs.

---

## 18. Merge strategies

Per-path `MergePolicy` with `*` / `**` globs. Dict `deep` recurses; `shallow` does not. Keyed list strategies (union / intersect / concat_dedupe) and `zip` recursively merge matching elements so nested policies apply at every layer (e.g. `dict[str, list[dict[…]]]`).

```ts
enum MergeListStrategy {
  Concat
  ConcatDedupe
  ConcatAssertNoDuplicates
  Union            // by itemKey — deep-merge matches
  UnionAssert
  Intersect        // by itemKey — deep-merge matches
  IntersectAssert
  Replace
  ReplaceAssert
  Prepend
  PrependAssert
  Zip              // deep-merge by index
}
```

Optional custom merge code on the Merge step.

---

## 19. A/B strategy benchmarking

Compare execution strategies on the same task:

| Strategy | Meaning |
| --- | --- |
| Single LLM | One direct structured call |
| Agent (frontier) | Full coding-agent instance |
| Agent (cheap) | Agent loop on a low-cost open model |

Logs keep syntax-highlighted code. An **LLM judge** picks a winner (accuracy, schema pass-rate, latency, cost). Component exists (`AbTesting`); wiring to a tab is still open.

---

## 20. History, branching, CLI

**History.** Git-like branching, commits, and merges for collaboration — the product analogue of Onshape / Fusion version control, implemented with real git (not a bespoke CRDT). Used also to keep test/pipeline hashes longer than seven days.

**CLI.** Same session and mutations as the React app, rendered with [Ink](https://github.com/vadimdemedes/ink).

**MCP.** `mcp_tool/` is a schema-first connector for Claude Code / Cursor. It does not require the rest of the monorepo beyond auth.

---

## 21. Landing page

A marketing site that is also a **live demo**, not a graveyard of dead tabs.

1. **Task box + Enter.** Builds a full pipeline, then **runs it on example files** immediately. The run trace is **full expanded HTML in the page flow** (not an iframe scroller, not nested inside the landing scroller). It must look like in-app Logging. The pipeline canvas is also in the page flow. LLM output sits **above** the live preview. Tokens **stream**. The session is recorded with [rrweb](https://www.rrweb.com/).
2. **App preview iframe** with **run buttons disabled**.
3. **Try now** → sign in.
4. **Book a demo** via [cal.com](https://cal.com/).

Rate limits; cheap model; billed to a **landing-page budget** in Supabase; every call listed. Landing and app share `LANDING_DEMO_PROXY_SECRET` in production.

---

## 22. Ops dashboard

Internal, localhost-oriented (`:5050`). Goal: reliability, money, and early-user pain — **minimal code** (prefer outsourcing chrome). Must be covered in the privacy policy.

The dashboard shows:

- Full **timelines** of usage: clicks, typing, errors, LLM calls, step create/delete/edit, log views.
- **rrweb replay** for all users, sortable by click count and by which component was clicked; filter by page (landing vs app) and searchable user list.
- **Heatmaps** of time-on-control.
- **Errors** in maximum detail, tied to a replay; error graph over time with production-change markers.
- Member list → one person → usage, retention, **all their AI prompts, projects, and files**.
- Money: starting grant, top-ups, LLM cost, markup %, free-credit **liability buffer**, green/red if everyone spent their grant now.
- Landing: emails, demo pipelines built, rrweb of those demos.
- Marketplace, API hosting, share tracking.
- Database size: rows per table, GB per table.
- User feedback.
- Overall activity: landing vs app per day.

---

## 23. Cross-cutting product rules

**Deletion UX.** Delete controls show a loading state; when the database confirms, the row fades or collapses — not an instant local vanish.

**Duplicate requests.** Detect identical in-flight inference. Toggle: reject, or collect and denormalise. Visualise how many were collapsed.

**Teams.** See §17.4.

**Custom LLM APIs.** See §17.4. OpenRouter is one wrapped provider.

**Connect into frontend tools.** Copy-prompt for Lovable (and peers) to wire the hosted API.

**Supported languages** for export / codegen: TypeScript, Python, Rust, BAML, Go, Swift, Kotlin.

**UI chrome.** ResizableSplit everywhere lists meet canvases. Shared Run-with-stop. Prefer existing shadcn / Prompt Kit / assistant-ui kits over a third chat snowflake (`chadcn_components.md`). Navigation must not stack four identical “sidebars”; entity rails, section tabs, inspector drawers, and a Build stepper are the target (`combined_full_stack_specification.md` § Codebase UI hierarchy).

---

## 24. Implementation map (where it lives)

This spec is product, not a file tree. The running dump’s component map remains authoritative for chrome:

- Shell: `AppShellLayout` → `ConsumerShellLayout` | `BuilderShellLayout`
- Tabs: `StructureBuilder`, `PipelineBuilder`, `Testing`, `Inference`, `SharePage`, `Earnings`, `Logging`, Cache, `Documents`, `Documentation`, `ProjectBilling`, `ProjectSettings`
- Overlays: project agent dock, diagnosis hub, running jobs, `LazyDocViewer`
- Types: `combined_full_stack/lib/server/types.ts`, `pipeline-module-union.ts`, `type_expr.ts`
- Run: `lib/server/run_engine/`
- Authoring: `lib/spine-js`, `lib/server/pipeline-authoring-schema.ts`
- Session: `lib/core/types.ts` (React, CLI, MCP share one snapshot)

Roadmaps live next to the code (`*-roadmap.ts`) and in `docs/*_plan.md`. Mark `DONE` there when a slice ships; do not fork a second checklist.

---

## 25. What this spec is not

- Not a competitor teardown (`docs/competitors.md`).
- Not the Base44 paste prompt (`docs/base44_rebuild_spine_prompt.md`) — that is a distillation for another builder.
- Not the raw voice dump (`combined_full_stack_specification.md`) — keep that file; do not “clean” it into this one.
- Not the JSON-vs-library experiment log (`docs/json_vs_library_product_spec.md`) — that file keeps the A/B table and reward-hacking rule.

---

## 26. Success for this document

An engineer (or another model) can implement or regress-check a feature **from this file** without reconstructing intent from chat. If a prompt adds a feature, append it here in the same voice and add the raw prompt to `docs/prompts.md`.

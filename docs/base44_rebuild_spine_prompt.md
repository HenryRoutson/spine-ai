COPY EVERYTHING BELOW THIS LINE INTO BASE44.
Do not summarize. The worked examples are the spec.

---

# Build Spine — a typed AI-engineering pipeline studio

Build a working web app called **Spine**. Spine is not a chatbot, not a generic n8n clone, and not a website builder. It is a studio where a user (technical or not) describes a document-in / structured-data-out job, and the product builds a **typed pipeline**: a left-to-right chain of steps whose inputs and outputs are always a named Structure. Every hop is schema-validated. Every step is visible. Intermediate results are cached. The default deliverable is a spreadsheet (or a JSON tree that can become a spreadsheet), not a paragraph of prose.

**One-line pitch:** Lovable for *backend AI engineering*. Non-technical users vibe-code; technical users edit types, steps, and custom code. Websites, if any, *bind* to those functions — they do not replace them.

**Default LLM:** a cheap OpenRouter model (DeepSeek-class). Do not default to a giant agent harness. A structured JSON call against a Zod schema is the unit of work.

If you only have time for one vertical slice, build this and stop: **Structures spreadsheet → Pipeline canvas with typed I/O → auto PDF-to-text → one LLM step → auto quote-link → Run tab that shows a table of results and lets you click a quote to jump into the source PDF.** Seed it with the Company Legal Evaluation example at the bottom. That slice *is* the product.

---

## 0. What Spine is, and what it is not

### It is

A **project** is a group of **functions** (pipelines) that share one set of **structures** (types = SQL tables = Zod objects) and one row store. A **website** is a separate object that binds to those functions.

```
Project (shared types + storage)
├── Structures     one definition → Zod schema, Pydantic class, CREATE TABLE
├── Functions[]    each function is a linear pipeline of steps
├── Rows           JSON rows keyed by structure (later: real SQL)
└── Websites *──n  hosted pages bind any functions (many-to-many)
```

The user builds **functions**, not chats. A function looks like:

```
[PDF upload] → [auto OCR / extract text] → [LLM: split into AtomicRule[]]
    → [auto Link Quotes] → [PDF upload: company docs] → [combine]
    → [LLM-batch: one call per rule] → [output spreadsheet]
```

Every box shows its **input type** and **output type** on the canvas without clicking. If the types don’t match, the edge is red and Run is disabled.

### It is not

- A single-page “ask the AI and stream an answer” product.
- LangChain / LangGraph with a pretty graph. There is no hidden agent loop. There is a spine of typed steps.
- Vector RAG. Retrieval is **quotes** (source-linked spans) and **example-select** (cheap per-item LLM relevance with a reason). Never embeddings as the default.
- A second schema. Do **not** add a “Database” tab that duplicates Structures. The structure *is* the table.
- A website builder that happens to call an LLM. Pages are optional skins over functions.

### Three audiences, one app (graduated complexity)

| Audience | What they see first | What they never see |
|---------|---------------------|---------------------|
| **Consumer** | Run a shared link / marketplace. Upload files, hit Run, see a table. | Structures, Pipeline editor, custom code |
| **Builder (non-technical)** | **Vibe**: a chat on the left that *proposes* structures + steps; an observe pane on the right (Run / Schedule / Share / Logs). Approve before apply. | Raw Zod, SQL, Monaco |
| **Builder (developer)** | Full Build flow: Structures spreadsheet → Pipeline canvas → Testing → Inference. Code preview (Zod / SQL / Python). Custom-code steps. | — |

Start the UI in **Vibe** for new users. Put Building editors behind a “Developer tools” toggle, but implement the underlying model as if developers exist — Vibe writes the same JSON the canvas edits.

---

## 1. The type system (the heart of the product)

This is the idea you must not dilute.

**A Structure is one thing.** It is simultaneously:

1. A Zod object (runtime validation of every step I/O)
2. A Pydantic / TypeScript / SQL-facing model (code preview)
3. A `CREATE TABLE` (human/LLM-facing annotation — runtime may still be JSON maps)

There is **no** “link this pydantic model to this SQL table.” There is no parallel `outIsList` boolean. Cardinality lives in the type: `AtomicRule` vs `list[AtomicRule]`.

### 1.1 Authoring: a spreadsheet, not a JSON schema form

The Structures tab is an **Excel-like grid**, because non-technical users can edit a table and technical users still get types.

Each structure is a sheet (or a named table). Each **field** is a row:

| Field | Type | Optional | Deterministic | Description | Example |
|-------|------|----------|---------------|-------------|---------|
| rule_id | Text | no | yes | Stable id | `"KYC-014"` |
| description | Text | no | no | Atomic obligation in plain language | `"Must verify beneficial owners ≥25%"` |
| source_quote | Quote | no | yes | Verbatim span from the regulation PDF | (linked) |
| severity | Text | no | no | `low` / `medium` / `high` | `"high"` |

Controls per field: rename, change type, description, delete, optional toggle, deterministic toggle.

**Deterministic** means tests can exact-match this field (a multiple-choice answer, an id, a money amount). Non-deterministic fields (summaries) are judged by an LLM or skipped in exact tests. This flag is **per field**, not per test.

**Quote** is a first-class field type: the LLM emits a string; a locked **Link Quotes** step turns it into `{ text, quote: { doc_id, start, end } }`. See §4.3.

**Document** is a first-class type: `{ id, filename, mime, content, blob }`. `content` is extracted text (null until OCR/parse). `blob` is the original PDF bytes. Do not invent a parallel `File` universe.

Plain-language type labels in the grid (never show `z.string()` to a non-technical user):

| Internal | Label in the grid |
|----------|-------------------|
| text | Text |
| int | Whole number |
| float | Decimal number |
| bool | Yes / No |
| datetime | Date or time |
| document | Document |
| list[document] | List of documents |
| json | Flexible data |
| list[text] | List of text |
| quote | Quote (source-linked) |
| model | Nested record (pick another structure) |
| list[model] | List of records |

Allow nested types a Python user would write: `list[list[int]]`, `dict[str, str]`, `optional[Vendor]`. If the user picks another structure as a field type, show a cycle error when a loop of required (non-optional) refs forms.

Each structure can have **multiple positive examples and negative examples**. Examples must **validate** against the structure — you cannot paste random text into a number field. Open examples in a JSON popup editor, not a single spreadsheet cell (commas break CSV thinking).

**AI summarise** button per structure: a cheap model writes a one-line “what this is.” Not a replacement for the human description — it exists to catch bugs like `document_summary: int`.

If a structure is **auto-generated** (e.g. from an Excel upload, or an assemble step’s product type), **lock** it. Clicking a locked field shows a clear error: *this struct is locked because it was generated from Combine/Assemble / from file X.xlsx*.

Code preview (read-only tabs next to the grid): **Zod**, **SQL**, **Python (Pydantic)**. Syntax-highlighted. This is how you prove “one type, three skins.”

### 1.2 TypeExpr (the IR you actually store)

Do not store `outIsList: true`. Store an explicit type on every spine edge:

```ts
type TypeExpr =
  | { kind: "prim"; name: "text" | "int" | "float" | "bool" | "datetime" | "json" | "markdown" | "latex" }
  | { kind: "document" }
  | { kind: "quote" }          // linked span
  | { kind: "text_quote" }     // LLM wire string before linking
  | { kind: "list"; item: TypeExpr }
  | { kind: "ref"; modelId: string }          // another Structure
  | { kind: "file"; inputTypes: InputType[] } // pdf/image/… at the input boundary
  | { kind: "optional"; inner: TypeExpr }
  | { kind: "unknown" }
```

Every pipeline step has `inType` and `outType` (TypeExpr). Adjacent steps must be **compatible**:

- Exact match
- Custom-code / coded transform may **reshape** (list → object is allowed *there*)
- Bare transform may auto-wrap a `list[Section]` into `DocumentStructure` if that structure has a field `sections: list[Section]`
- Output / assert / human-review / quote-link **passthrough** the incoming type

If incompatible: red edge on the canvas, error on the step, **Run disabled**. Offer two fix buttons: “change this step’s inType to match upstream” or “change upstream outType to match this step.”

**Worked mismatch (this is a real bug the type system exists to catch):**

- Step “Extract Subsections” is `llm-batch`, so it **always** emits `list[HierarchicalSection]`
- Step “Build Hierarchy” is a transform that expects `HierarchicalSection` (singular)
- UI: red connection. Valid fixes:
  1. custom-code `main(input) { return { sections: input } }`
  2. bare transform into `DocumentStructure` where `sections: list[HierarchicalSection]` (auto-wrap)
  3. set `inType` explicitly to `list[HierarchicalSection]`

### 1.3 SQL is the human language for the same types

Runtime values can stay JSON. Still **generate `schema.sql`** from structures and show it in the Types/Code tab. SQL is an annotation, not a second database (yet).

Always emit platform tables:

```sql
CREATE TABLE document (
  id TEXT PRIMARY KEY,       -- content hash
  filename TEXT NOT NULL,
  mime TEXT,                 -- pdf / text / json / …
  content TEXT,              -- extracted text; NULL until doc-to-text
  blob BLOB                  -- original bytes
);

CREATE TABLE quote_span (
  doc_id TEXT NOT NULL REFERENCES document(id),
  start INTEGER NOT NULL,
  end INTEGER NOT NULL
);
```

User structures become tables. `JobExample` → `job_example`. Nested `list[model]` with a parent PK becomes a **child table**, not a JSON column:

```sql
CREATE TABLE job_example (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  work_description TEXT NOT NULL
);

CREATE TABLE job_example_billed_items (
  job_example_id TEXT NOT NULL REFERENCES job_example(id),
  work_item_id TEXT NOT NULL REFERENCES work_item(id),
  quantity REAL NOT NULL,
  unit_note TEXT
);
```

Fields may annotate `relation: { kind: "pk" }` or `{ kind: "fk", to: { model, field } }`. Runtime type stays `text`. This is how billed line items stay normalized.

**Prompt VIEW vs spine row (critical example):**

You have past jobs. Each job has `title`, `work_description`, and nested `billed_items` (opaque ids like `WI-00042` + quantity). An example-select step asks a cheap LLM “is this job relevant to the new claim?”

- **Do not** dump `billed_items` into the uncached per-candidate prompt (wastes tokens, no relevance signal).
- **Do not** custom-code a slimmer type (throws away FKs the next step needs).
- **Do not** denormalize the JSON library.

`{example}` in the prompt is a **VIEW**:

```sql
CREATE VIEW select_relevant_jobs_prompt AS
SELECT id, title, work_description FROM job_example;
```

The **spine passthrough** is still the full row + `selection_reason`. Downstream still has `billed_items`. `{passthrough}` is not a template variable.

This is the SQL/types idea in one sentence: **project for the prompt; keep the row for the pipeline.**

### 1.4 Data vs view

Types say *what it is*. Views say *how it looks*. Do not add `TypeExpr.Video`. A video is `document.blob` + mime, wrapped in a small structure `{ doc_id, mime, filename }`. The Run panel then mounts a player.

Every output panel has tabs: **Play / Table / JSON / Download**. JSON is always available. Table is the default for list-shaped data. Play is for pdf/image/audio/video when mime matches.

Custom visualizers (later) are sandboxed HTML iframes with `postMessage`, same contract as the JSON viewer — not React components mounted in the app shell.

---

## 2. The pipeline (validated, user-visible steps)

### 2.1 Shape

A pipeline is a **straight spine** (left-to-right or top-to-bottom). Unique **label** per step. Every later step can read accumulated state as an object keyed by those labels (`state["Extract Rules"]`). Arrows are derived from types and from state-label references. If a subgraph is disconnected, error.

It is *conceptually* linear so non-technical users can follow it. Parallelism is **inside** a step (`llm-batch` fires N structured calls), not a free-form DAG the user must draw. (Fork/if-else exist later; do not start there.)

Schema validation is **not a step**. It is implicit on every hop. If you add a “Validate schema” box, you have misunderstood the product.

### 2.2 Canvas (the thing people screenshot)

A vertical or horizontal chain of **cards**. Each card:

```
┌─────────────────────────────────────────────┐
│  ⚡  Extract Atomic Rules          [LLM]    │
│  Split the statute into testable rules      │
│                                             │
│  in   Document                              │
│  out  list[AtomicRule]                      │  ← always visible, no click
│                                             │
│  last run  1.2s   $0.04   cache hit         │
│  [Run this step]  [cached ✓]                │
└─────────────────────────────────────────────┘
        │  list[AtomicRule]
        ▼
┌─────────────────────────────────────────────┐
│  🔗  Link Quotes                   [AUTO]   │
│  locked · inserted because AtomicRule has   │
│  a Quote field                              │
│  in   list[AtomicRule]                      │
│  out  list[AtomicRule]   (same, linked)     │
└─────────────────────────────────────────────┘
```

- Icon + kind badge + label + one-line note (required on input, combine, llm).
- **in / out types** printed on the card.
- Invalid edge: **red**. Isolated step: warning.
- Click a type chip → jump to that structure in the Structures grid.
- Locked auto-steps have a distinct chrome (muted, lock icon) and an explainer tooltip. User cannot delete them while the condition that created them still holds. They cannot edit the prompt on an auto-step.
- Insert slot between cards: “+ Add step”.
- Right **inspector** (collapsible): the selected step’s fields. Label it “Step inspector” so it does not look like a second main nav.
- Metrics bar: average cost, average latency, cache entry count.

Run button on a step is enabled only if upstream is cached or ready **and** the whole pipeline is type-valid. Invalid pipeline → run buttons go dark.

### 2.3 Step kinds you must implement (v1)

Keep the set small. These are enough to demonstrate Spine:

| Kind | What it does | I/O rule |
|------|----------------|----------|
| **Input** | Binds files. Subset of types (pdf, word, excel, json, text, image, web). Optional filename contains (`legal_regulations`). Optional input-description LLM guard. | `outType` is `Document` or a structure (JSON/excel can parse natively) |
| **doc-to-text** | **AUTO.** Fills `Document.content` from blob. Parser or Vision OCR. Cached per document. | passthrough Document |
| **structure-parse** | **AUTO LLM.** When input is not JSON-native and the target is not Document. | Document → target structure |
| **LLM** | One structured call against `outType`. Prompt with `{input}` and `{state.Label}`. Cheap model default. Optional “think first, then JSON” (free-text then structured) — auto-enable on validation retry. Cost cap default $1. Cache toggle. | `inType` → `outType` |
| **LLM-batch** | List in → one structured call **per item** (parallel, bounded) → typed list out, **input order**. This is how you don’t stuff 200 rules into one prompt. | always `list[T]` out |
| **example-select** | Not RAG. For each candidate, cheap LLM returns `{ chain_of_thought, is_relevant }`. Kept rows gain `selection_reason`. Prompt has a **cached prefix** (`{description}`) and an uncached `{example}` that may be a SQL VIEW projection. Store kept **and excluded** verdicts for the log. | list in → filtered list out (full rows + reason) |
| **Transform** | Deterministic reshape. Optional custom code. Auto-wrap list into a parent object when the output structure has a matching `list[model]` field. | declared in/out |
| **Custom code** | TypeScript `(input, state) => output`. Output still validated. Compile error = pipeline error. Default max runtime 60s. | may reshape |
| **Combine** | Second **Input** lands here: merge a newly uploaded document (or structure) with accumulated state into one object. Example keys: `{ "Company data": Document, "Company legal requirements": list[AtomicRule] }`. | product type (auto, locked) |
| **Assemble** | Zip spine + `state["Label"]` (or dotted paths) into a flat object. Prefer this over custom-code when you are only picking fields. | auto out model |
| **Output** | Named snapshot. Multiple allowed. This is what the Run tab highlights; other steps collapse when the run finishes. | passthrough |
| **Link quotes** | **AUTO.** When `outType` (or nested fields) includes Quote. LLM strings → spans. | same model in and out |

JSON-native input types: **Excel, JSON**. Everything else (PDF, Word, Text, Web, Image) is **not JSON**. The user must never think “if this isn’t JSON I need an LLM.” The product inserts the convert steps and **visualises** them.

### 2.4 Auto-managed steps (do not make the user add these)

These are locked, system-inserted, and they have explainer copy. Failures must be attributed to *this* card, not to Input.

**A. Document to text** — when Input accepts PDF, Word, image, or web.

> Auto-inserted when this input accepts PDF, Word, image, or web files. Input only binds the file; this step fills Document.content (parser or Vision OCR) and is cached per document. If it is slow or fails, the problem is here — not on Input.

Toggle on the input (or on this auto-step): **Use OCR**. Off = built-in PDF text extract (fast, fails on scans). On = vision model via OpenRouter (handwriting, scans). Cache OCR separately from parser so flipping the toggle does not reuse the wrong bytes.

Documents viewer must show, for a PDF/image:

1. Original PDF / image
2. Raw extracted text
3. Formatted markdown
4. (If OCR) overlay / labelled regions if the vision API returns boxes; otherwise skip boxes rather than fake them

**B. Structure parse** — when Input’s target is a Structure and the file is not JSON-native.

> Auto-inserted when this input’s I/O model is not Document. Convert-to-text (if any) runs first so this LLM sees instantiated content. Excel and JSON-only inputs parse directly in the input step — no LLM needed.

Visualise this LLM card after Input (and after combine, if the new side-input needs conversion).

**C. Link quotes** — when any LLM output structure contains quote fields.

> Auto-inserted when an LLM output includes quote fields. Same model in and out (e.g. AtomicRule): the LLM returns verbatim strings; this step links them to document spans. If rules look wrong, inspect the LLM step; if quotes won’t click, inspect this step.

Implementation of linking (§4.3): exact substring on whitespace-normalised text; else sliding-window token overlap; store `{ doc_id, start, end }`. Walk the structure to find quote fields — do **not** brute-force every string in the JSON.

### 2.5 Input files: compatibility, not just type

Filename contains helps (`marking_guide` vs `homework`) but does not stop a grade-10 guide being paired with a grade-1 sheet.

After **both** slots have files, extract keys (JSON paths, question-id sets, regex) and show:

```
MATCH  assignment name
MISMATCH  questions
MISMATCH  year
```

This is a different error from Assert. It is shown **before** Run, in the Inference form. Do not block uploading file A before file B; check after both exist.

JSON-structure inputs (not Document): three modes, never silent-edit the store file:

- **From file** — pick a stored JSON that already matches the structure
- **Branch off** — copy values into a form; save as a **new** file
- **Create empty** — schema defaults, save as a new file

### 2.6 Caching, fingerprinting, cost

- Cache **per step** (toggle on LLM steps, default on). Same input bytes + step config → reuse output. Show cache hits on the card and in the log.
- **Run fingerprint:** identical pipeline + inputs → offer “open prior run” instead of re-billing.
- Per-LLM-step **cost limit**, default $1.
- Store every LLM prompt and response (inputs and outputs). This is product data, not a debug leftover.
- Prompts are stored as **components** (template + document ids + field picks) and flattened only when sending. Do not persist 1000 copies of the same PDF text inside prompts.

### 2.7 Custom code

```ts
export default function main(input: HierarchicalSection[], state: PipelineState): DocumentStructure {
  return { sections: input }
}
```

Typed against generated structures. Compile failure blocks the pipeline. Ordered fallbacks allowed (`typescript` then `python`). Do **not** execute untrusted HTML. Client-side TS that posts the result back is acceptable for the demo if the server still validates the JSON against Zod before continuing.

---

## 3. Excel / table / JSON views (complex data must be a spreadsheet)

Non-technical users will not read nested JSON. Every structured value in the app — structure examples, step I/O, final output, documents that are json/csv/xlsx — opens in **one shared viewer** with three human views:

| View | When | What |
|------|------|------|
| **Table** | list of objects, or a single object as one row | Spreadsheet: columns = fields, nested lists as expandable rows or a child sheet |
| **Tree** | deep nesting | Indented outline, expand in place |
| **JSON** | developers, copy/paste | Foldable, syntax-highlighted. Two themes: App (green strings, blue keys, orange numbers) and Editor (peach / cyan) |

Always a **Download** button: JSON, CSV, XLSX. Nested `list[model]` becomes extra sheets in the xlsx (`job_example` + `job_example_billed_items`), matching the SQL child-table rule.

The **Structures editor itself** is this spreadsheet metaphor applied to *types* (field rows), not only to *values*.

When a user **uploads** an Excel/CSV/JSON:

1. Infer structures (one per sheet; combined workbook type with sheet-prefixed fields).
2. Match against existing structures (same `Node` reused; new `CyclicGraph` added).
3. Offer “add these structures to the project” with a clickable link back to the source document.
4. Never overwrite the uploaded file when editing — save as a new content-hashed document.

Legal-evaluation output is the poster child: **one row per atomic rule**, columns `rule`, `quote`, `compliant` (yes/no), `evidence quote`, `consequences`. That is an `.xlsx` a lawyer can email. The JSON is the source of truth; the spreadsheet is the default human view.

---

## 4. Quotes (validated text — click to source)

This is the “validated text” feature. If an LLM extracted a phrase, the user clicks it and jumps to the PDF.

### Wire types

- LLM is asked to emit a **verbatim string** (`text_quote`). Prompt says: copy a contiguous span from the source, do not paraphrase.
- Link Quotes walks the output structure, finds quote fields, and writes:

```ts
{
  text: "keep the premises insured",
  quote: { doc_id: "sha_ab12…", start: 4412, end: 4440 }
}
```

SQL view of the same fact: `INSERT INTO quote_span (doc_id, start, end)`. Quotes are FKs, not a parallel type universe.

### Matching algorithm (langextract-style)

1. Normalise whitespace, ASCII-fold case, keep length stable so offsets map 1:1.
2. Exact substring on the normalised source → denormalise offsets back to the original.
3. Else slide a window of the quote’s token length; score = fraction of **quote** tokens covered (not the window — scoring by window length falsely 1.0-scores the tail of the document).
4. Store `exact: boolean` and `score`. In the UI, inexact matches get a warning chip.

Do not scan the whole JSON for strings that “look like quotes.” Use the structure to know where quote fields are, including nested `list[model]` and refs.

### UI

In any JSON/table view, quote values are **links**. Click → document overlay:

- PDF (or text) scrolled to the span
- Highlight the region
- Side list of all quotes from that run, colour-coded vs the source

The source document is outlined in a distinct colour wherever it is referenced (prompt, log, output).

---

## 5. Documents

Content-addressed store: **hash = id**, dedupe on collision. Labels: `inference` | `training` | `testing`. Tied to a project by default; a document can be made available to several projects.

Upload: drag-drop. Flag and require confirm if the file contains `confidential`. Cap can be ~25 MB for the demo.

List: name, size, type, which structures it matched. Click → viewer (PDF / text / markdown / table / JSON as appropriate). **Edit JSON/tabular only as branch-off** (new filename, new hash).

Selecting inputs on the Run tab **picks from this store** (filtered by type and filename contains). Do not re-upload on every run.

---

## 6. Run, Testing, Logging (operate the function)

### 6.1 Inference / Run tab

Left: named **setups** (not a single default). Homework grader example: setups “1st grade” and “university (LaTeX)”, each with specific files. Same backend as testing fixtures.

Main pane:

- One slot per Input step (filtered document picker)
- Compatibility panel (MATCH / MISMATCH)
- Description of why this run exists (searchable later)
- Shared **Run / Stop** control (play icon → spinner + stop)
- Live log **broken down by step**
- While running: expanded step trace
- When finished: **collapse everything except Output steps**; trace remains but minimised
- Final output: Table / JSON / Play viewer (§3)
- If fingerprint matches a prior run: button to open that log instead of charging
- If billing would fail: button to Billing (can stub billing)

After a run, quotes in the output are clickable (§4).

### 6.2 Testing tab

`*_testing.json` documents, checkbox icon. Partial tests are first-class: expected values for 3 of 8 steps is fine; 10 tests on one step and none on others is fine.

- Editor is **generated from the structure**, not a free JSON textarea.
- Deterministic fields: exact match (key order in objects must not matter). Optional numeric tolerance (`±2`).
- Non-deterministic fields: LLM judge, or skip.
- Expected **errors** are specific (“fail validation at Input because marking schema does not match this homework”), never “this whole test fails.”
- Results: pass/fail in the test list (persisted, hashed against pipeline+test so revert restores the badge). Git-diff view for expected vs actual: green `+`, red `-`; when line counts match, red background on differing lines plus `// not "{actual}"` comments so copied text shows the delta. Scroll expected and actual together when lengths match.
- Run all / run one. History per test. Orphaned steps when the pipeline changed: show alignment UI so tests retarget by type instead of forcing a rewrite.
- Logging gets a `testing` flag on those runs.

As much checking as possible should happen **in the pipeline design** (red I/O edges). Tests are for demoing and regressions, not for discovering that `list[T]` was wired to `T`.

### 6.3 Logging

Every run: green/red. Search by the run description. Selecting a run shows:

- Frozen copy of the pipeline at that time
- Per-step input/output in the shared viewer, with the structure name linked
- Cost and latency per step; charts of which steps dominate
- LLM call distribution (prompt/response chars, latency)
- Retry grid: `n_prompts × (max_retries + 1)`
- Example-select **verdicts** (kept vs excluded + reasoning)
- Server logs attributed to steps (hidden by default)
- Quote highlights + jump-to-doc
- Copy-entire-log button

Cache tab: browse cached step I/O with the same viewer.

---

## 7. Frontend vs backend modularity

**Backend = functions (pipelines) + structures + documents + run engine.**  
**Frontend = hosted pages that slot those functions in.**

They are independent lists with a many-to-many bind. Do not nest the page studio inside a pipeline as if the website *were* the pipeline.

### Hosted page slots (the frontend you actually ship)

A website is HTML (vibe-editable) with tokens the host replaces:

| Slot | Meaning |
|------|---------|
| `{{run}}` / `{{run:alias}}` | Render the upload form + run UI for a bound function |
| `{{table:Model}}` | Live rows for that structure (spreadsheet) |
| `{{output}}` | Last run’s DataView (table/json/play) |
| `{{docs}}` | Document viewer |
| `{{auth}}` | Sign-in |
| `{{pay}}` | Checkout / who-pays |
| `{{chatbot}}` | Vibe chat (cannot edit pipelines from a public site unless you intend that) |

**Rule:** if a slot exists, use it. Do not rewrite a Run form in ad-hoc React on the page.

Example page (guest builder, 4 routes — this is also how Spine-in-Spine thinks):

```
/            nav + {{chatbot}} + {{run}} + {{output}} + {{docs}}
/structures  nav + {{table:StructureModel}} + {{table:ModelField}}
/functions   nav + pipeline canvas + {{table:PipelineStep}} + {{table:PipelineRun}}
/account     nav + {{auth}} + {{pay}}
```

A marketing site for a *user* pipeline might be a single page: hero, `{{run}}`, `{{output}}` as a table of compliance rows.

Vibe for pages edits **HTML/CSS/brand only**. It cannot change step types. Vibe for pipelines edits **structures and steps**. Two assistants, two permissions.

Export (later): zip of TS/Python runner + `inference_ui.html` + hosted HTML. For the Base44 build, a “Share link” that opens a consumer Run page is enough.

---

## 8. Layout and visual design

### 8.1 Principles

- **Canvas is the hero.** Lists of structs/runs/tests are narrow **entity rails** (~200px, muted background, section title “Structs in this project”), not a second primary nav.
- Do **not** stack four identical vertical menus. That is the current Spine app’s own self-criticism — do not reproduce it.
- shadcn/ui (or equivalent): Button, Input, Select, Switch, Badge, Tabs, Dialog, Sheet, Scroll Area, Resizable panes, Tooltip. Distinct patterns: entity rail, section tabs, inspector drawer, stepper.
- Agent chat is a **sheet/drawer**, not a full-height third column that looks like nav.
- Document viewer is a **modal / overlay**, not a tab that replaces the canvas.
- Numbered Build stepper for developers: `01 Structures → 02 Pipeline → 03 Testing → 04 Run`. Non-technical Vibe hides 01–03 behind chat.

### 8.2 Chrome

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Logo  Spine    [ Project ▾ Legal eval ]     jobs  agent  account  [Run]  │
├──────────────────────────────────────────────────────────────────────────┤
│  Build     Deploy     Observe     Library                         Account│
├──────────────────────────────────────────────────────────────────────────┤
│  01 Structures ── 02 Pipeline ── 03 Testing ── 04 Run                    │
├────────────┬─────────────────────────────────────────────┬───────────────┤
│ Entity     │                                             │ Inspector     │
│ rail       │           L3 Canvas (largest)               │ (pipeline     │
│ muted      │                                             │  only,        │
│ ~200px     │                                             │  collapsible) │
└────────────┴─────────────────────────────────────────────┴───────────────┘
```

**L0 header:** logo, project selector (always visible in builder), running-jobs, agent toggle, account. Primary sections: **Run | Build | Billing | Settings** (consumer) or **Build | Deploy | Observe | Library | Account** (builder).

**L1:** area. **Build** shows the stepper. **Deploy** = Share / Earnings. **Observe** = Logging / Cache. **Library** = Documents / Docs markdown. **Account** = billing + settings (hides workspace tabs).

**Consumer (no project):**

```
Header: “Run shared pipelines”
L1: [ Shared with me ]  [ Marketplace ]
L3: full-width Run panel (slots, progress, table output)
```

No left app sidebar.

**Vibe (non-technical builder):**

```
┌────────────────────┬─────────────────────────────────────┐
│ Chat               │ Observe: tabs                       │
│ (propose + approve)│  Run | Schedule | Share | Logs      │
│ chips for @files   │  spreadsheet chrome, not the DAG    │
│ and UI selections  │                                     │
└────────────────────┴─────────────────────────────────────┘
```

Chat **proposes** a patch to structures/modules; user Approves. Chat sees current validation errors. Observe is read-only execution.

**Project picker** (`/projects`): gallery of your projects (last opened, created date, rename/clone/delete), bundled examples, blank project, “just want to run?”. **Do not** keep an “active project” while in picker mode — selecting is what opens the builder. On builder load, restore the **last opened** project.

Waterfall disable: invalid Structures → Pipeline tab red/disabled → Testing/Run disabled. Fix types first. Invalid pipeline → Run disabled. Empty billing → Run shows “go to billing”.

### 8.3 Visual language

- Light, dense, product-tool (Linear / Retool), not a marketing landing page inside the app.
- Mono for type chips (`list[AtomicRule]`), labels, ids.
- Kind colours: Input slate, LLM violet, batch LLM violet-outline, auto-steps amber/lock, output green, invalid red.
- Cards, not giant flow nodes. Prefer a **chain** over a free-form graph editor.
- Resizable splits with a visible drag handle.

---

## 9. Vibe agent (how pipelines get written)

The agent does **not** answer the user’s task by running an LLM on the PDFs. It **builds the pipeline** that will.

It emits (or edits) a JSON IR of modules + structures. Restrictions you must enforce in that JSON (fail closed):

- Every step has a unique `label` and a `note`
- `llm-batch` input is a **list**; do not write `structureIn: list[Document]` as if the per-item schema were a list
- Non-JSON inputs stay `Document` until an explicit convert; never “load this PDF into InvoiceRow” without the auto parse step
- Fork (if you implement it) needs ≥ 2 lanes
- Quote fields imply a following Link Quotes auto-step
- PDF/image inputs imply doc-to-text

Default authoring path: **structured JSON** with up to two validation retries. (A JS library compile-to-JSON is a research option; do not start there.)

Few-shot **reward hacking is forbidden**: do not detect “KYC” and paste a canned pipeline from this prompt’s examples without generating. The examples teach *shape*, not a lookup table.

Show validation errors in the chat whenever `invalidCount > 0`.

---

## 10. Share (minimum)

- **Share link:** consumer Run UI for this function. Optional default files.
- Who pays: you (signed-in or not) vs receiver (signed-in). Draw `sender → receiver` with `$` on the paying side.
- Later: API, marketplace, billing multiple, spend limits. Stub is OK if the link runs.

---

## 11. Worked example A — Company Legal Evaluation (SEED THIS)

This is the default project. If the user opens the app with no prompt, they should see this already built and runnable.

### Structures

**AtomicRule**

| field | type | deterministic | notes |
|-------|------|---------------|--------|
| rule_id | text | yes | |
| description | text | no | one obligation, atomic |
| source_quote | quote | yes | span in the regulation PDF |
| severity | text | no | low/medium/high |

**RuleAssessment**

| field | type | deterministic | notes |
|-------|------|---------------|--------|
| rule_id | text | yes | fk to AtomicRule.rule_id |
| compliant | bool | yes | |
| evidence_quote | quote | yes | span in the company PDF |
| gap | text | no | what’s missing if not compliant |
| consequences | text | no | likely liability / penalty |

**AssessmentWorkbook** (output wrap)

| field | type | notes |
|-------|------|--------|
| assessments | list[RuleAssessment] | the spreadsheet |

### Pipeline

1. **Input** `Regulation` — PDF (and Word). Filename contains optional `regulation` / `kyc`. Note: “Legal requirements to break into atomic rules.”
2. **AUTO doc-to-text** (OCR toggle available)
3. **LLM** `Extract Atomic Rules` — `Document` → `list[AtomicRule]`. Prompt: *Extract every testable obligation as its own rule. source_quote MUST be a verbatim contiguous span. Do not merge two duties into one rule.*
4. **AUTO Link Quotes** on `list[AtomicRule]`
5. **Input** `Company evidence` — PDF. Note: “What the company claims it does.”
6. **AUTO doc-to-text**
7. **Combine** into `{ regulation_rules: list[AtomicRule], company: Document }` (locked product type)
8. **LLM-batch** `Assess each rule` — for each AtomicRule, structured `RuleAssessment`. Prompt uses the **one rule** plus company text. This is the parallel pattern: 40 rules = 40 cheap calls, not one 200k-token soup.
9. **Transform / custom-code** wrap into `AssessmentWorkbook` `{ assessments: input }` (auto-wrap allowed)
10. **Output** `Compliance workbook` — Table view default; Download xlsx

### Bundled demo files (create realistic short stubs)

- `kyc_requirements.md` / PDF text: 8–12 atomic-ish duties (beneficial owners, ID docs, sanctions screening, record retention, …)
- `acme_kyc_implementation.md`: mixed — some duties clearly met, some missing
- Inference setup “Acme KYC”
- Testing: at least Extract Rules is a list of length ≥ 5; Assess has deterministic `compliant` on 2–3 easy rules

**Run UX:** user picks the two files, hits Run, watches batch cards fill in parallel, gets a table. Clicks `source_quote` → regulation text highlights. Clicks `evidence_quote` → company text highlights.

---

## 12. Worked example B — Example select (not RAG)

Problem: a new insurance damage description, and a library of past scopes of work. Embeddings return a hinge-replacement job for a bathroom leak with no explanation.

Pipeline:

1. Input `Damage case` (text Document)
2. Input `Example library` (JSON `list[ScopeExample]`: title, body, id)
3. **example-select** — context = damage case `content`; `{example}` = each library row (or a VIEW of `id, title, body`); output = kept rows + `selection_reason`
4. Assemble `{ description, selected_examples }`
5. LLM `Draft scope` using the selected examples and their reasons
6. Output

Logging must show **excluded** candidates and their `chain_of_thought` (“fence repair — no water ingress — not relevant”).

A harder cousin (only if the seed above works): **two-pass** billed-work catalog. Pass 1 filters past **jobs** with a prompt VIEW that **omits** nested `billed_items`. Spine keeps those FKs. Pass 2 filters the **work-item catalog** (~100 rows, one cheap call each, cached prefix). Final LLM drafts line items with quantities. Do not flatten the catalog JSON.

---

## 13. Worked example C — Tiny receipts (sanity)

```
input(list of PDF receipts, OCR on)
  → llm-batch(ReceiptRow { date, vendor, amount })
  → output table
```

Use this as the “hello world” in Vibe few-shot so the model sees `llm-batch` over files. Filename contains unused. Quotes unused. Proves: auto OCR, batch, spreadsheet output.

---

## 14. Backend / frontend modularity in *your* code (Base44 implementation)

Mirror Spine’s split even inside one Base44 app:

| Layer | Owns | Does not own |
|-------|------|----------------|
| **`lib/types`** | StructureModel, TypeExpr, PipelineModule, ModuleKind | React |
| **`lib/zodFromModel`** | Canonical Zod from a structure; `validate(value, model)` used on every hop | Ad-hoc `z.object` in components |
| **`lib/sqlFromModels`** | `schema.sql` string | A live SQLite unless you want it |
| **`lib/quotes`** | findQuote, resolveQuotesInRecord walking the structure | DOM |
| **`lib/runEngine`** | Execute the spine, cache, fingerprint, insert auto-steps | Tailwind |
| **`lib/validity`** | inType/outType compatibility, unique labels, disconnected graph | — |
| **`components/*`** | Canvas, spreadsheet editor, viewers, run form | Re-implementing validation |

Frontend is presentation. If a rule exists (red edge, disabled Run, auto-insert OCR), it lives in `lib/` and the UI only renders it. That is how CLI / future export / tests stay honest.

Auto-step insertion is a **pure function** `syncModules(modules, structures) → modules`. Call it on every edit. Do not make the user add OCR.

Persist: users, projects (json blob is fine: `{ structures, modules, docs, runs, cache }`), files (hash-addressed). Supabase or Base44’s built-in DB. Documents table: id hash, filename, mime, text content, storage path for bytes.

Auth: email magic link or whatever Base44 gives you. Header sign in / out.

---

## 15. Layout of the Structures and Pipeline pages (concrete)

### Structures

```
[Window header: Structures · “+ New structure” · Code preview toggle · Ask AI]

┌─ Entity rail ─────────┐  ┌─ Canvas ──────────────────────────────────────┐
│ STRUCTS               │  │ StructureExcelEditor                          │
│  • AtomicRule      ←  │  │  name, description, AI summarise              │
│  • RuleAssessment     │  │  spreadsheet of fields                        │
│  • AssessmentWorkbook │  │  type picker (plain language)                 │
│ TYPES                 │  │  examples / negative examples (dialog)        │
│  • Severity           │  │                                               │
│                       │  │  if Code on: tabs Zod | SQL | Python          │
└───────────────────────┘  └───────────────────────────────────────────────┘
```

### Pipeline

```
[Window header: Pipeline · avg $ · avg ms · Export stub · Summarise issues]

┌─ Canvas (chain) ────────────────────────┬─ Inspector ─────────┐
│  [+ add]                                │ Step inspector      │
│  Input  Regulation                      │ label, note         │
│  AUTO   PDF → text  (OCR toggle)        │ inType / outType    │
│  LLM    Extract Atomic Rules            │ prompt textarea     │
│  AUTO   Link Quotes                     │ model select        │
│  Input  Company evidence                │ cache, $ cap        │
│  Combine                                │ filename contains   │
│  LLM-batch  Assess each rule            │                     │
│  Output Compliance workbook             │ [jump to structure] │
│                                         │                     │
│  red edge + “fix inType / outType” if   │                     │
│  something doesn’t connect              │                     │
└─────────────────────────────────────────┴─────────────────────┘
```

### Run

```
┌─ Setups rail ──┐  ┌─ Run panel ──────────────────────────────────────────┐
│ Acme KYC    ←  │  │ Regulation:  [ kyc_requirements.pdf          ]       │
│ Blank          │  │ Company:     [ acme_kyc_implementation.pdf   ]       │
│                │  │ MATCH keys …                                         │
│                │  │ Why this run: [________________]  [ ▶ Run ] [ Stop ] │
│                │  │ ───────────────────────────────────────────────────  │
│                │  │ Output · Compliance workbook          [Table|JSON]   │
│                │  │  spreadsheet of assessments; quotes are links        │
│                │  │ ▸ Step trace (collapsed)                             │
└────────────────┘  └──────────────────────────────────────────────────────┘
```

---

## 16. What to skip (so the core stays sharp)

Do **not** build in v1 (mention as coming soon in Settings if you want):

- Marketplace, earnings, Stripe, Langfuse, teams, CLI, MCP, Rust/Go/BAML export
- Fork / if-else / case / webhooks / n8n / Higgsfield video / 3D
- Pixel-exact recreation of 12 flat tabs
- Vector database
- A Data tab
- Executing user HTML in the parent page
- Putting PDF bytes in `outputJson`
- An agent that “just reads the PDFs and answers” without a pipeline

Do **not** reward-hack by special-casing the words “legal” or “KYC” to skip the engine.

---

## 17. Success criteria (your definition of done)

A reviewer can:

1. Open the seeded **Company Legal Evaluation** project.
2. See Structures as a spreadsheet, switch to **SQL** and **Zod** previews of the same AtomicRule.
3. See the Pipeline canvas with auto OCR and auto Link Quotes locked in, types printed on every card.
4. Break a type on purpose (point Assess at `AtomicRule` instead of `list[AtomicRule]`) and watch the edge go red and Run disable.
5. Run the Acme setup. Get a **table** of assessments. Click a quote, land on the highlighted source span.
6. Upload a scanned-looking image with OCR on and see `Document.content` fill on the auto-step (cache the result).
7. Download the output as xlsx.
8. In Vibe, type: *“add a severity sort custom-code step before combine”* → proposal with Approve → canvas updates → still valid.
9. Open a share link as a signed-out consumer and run the same files (or the defaults) without seeing the pipeline editor.

If those nine work, you built Spine. Extra tabs are optional chrome.

---

## 18. Copy and empty states

- Empty structures: “Structures are the shapes every step must speak. Add a record, or let Vibe propose them from your prompt.”
- Empty pipeline: “A pipeline is a checklist the model cannot skip. Add Input, or open Vibe.”
- Invalid Run: “Fix the red connections on Pipeline. Schema checks are automatic; there is no validate step to add.”
- Locked auto-step click: use the explainer sentences in §2.4 verbatim.
- Quote inexact: “Closest match in the source (not an exact span). Inspect Link Quotes.”

Default page title: **Spine**. Favicon: a simple vertical spine / stacked nodes mark.

---

## 19. Tech notes for Base44

- React + Tailwind + a component library.
- Zod on the server for every step output. Never trust the client for validation or pricing.
- Store files privately; signed URLs for PDF iframe.
- OpenRouter for LLM and vision OCR. One module: `getStructuredResponse(schema, prompt)` and `getStringResponse(prompt)`. Persist the client. Model is `provider:model` (e.g. `openrouter:deepseek-chat`).
- `llm-batch`: concurrency 4–8, preserve order, isolate failures per item (item error shouldn’t kill the whole list without a trace).
- Hash documents with SHA-256 of bytes.
- Idempotent auto-step ids: `mod_ocr_<inputId>`, `mod_quote_<llmId>` so re-sync doesn’t duplicate.

Build the seed project on first boot so the app is never an empty shell.

---

End of prompt. Implement the legal-evaluation slice first, then generalise.

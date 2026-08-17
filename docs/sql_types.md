# SQL annotation (first slice)

SQL in this repo is a **type annotation**, not a database. Runtime values are still JSON maps. There is no SQLite / sql.js / Postgres instance per run.

Source of truth for the printer: `combined_full_stack/lib/sql-schema.ts`. Types tab / `typecheck_project.ts` emit `schema.sql` next to `models.py`.

## Why

Billed Work Catalog Select → **Select Relevant Jobs** used to stringify the full `JobExample` into `{example}`. Nested `billed_items` (`WI-xxxxx` + quantity) are uncached per-candidate tokens with no pass-1 relevance signal.

Downstream still needs those FKs on the spine (`SelectedJobExample`, pass 2, draft). So:

- Do **not** drop `billed_items` from the model.
- Do **not** custom-code a slimmer spine type.
- Do **not** denormalize `job_example_library.json`.

`{example}` is a **VIEW** (projection). Spine passthrough is the full table row + `selection_reason`. `{passthrough}` is not a template variable. `{input_to_prompt}` aliases `{example}`. Pass 2 **Select Relevant Work Items** `{example}` stays a full catalog row.

## Two layers

| Layer | What it is | What it is not |
| --- | --- | --- |
| `schema.sql` | Human/LLM-facing DDL from `StructureModel` + example-select views | A live database |
| Runtime projection | Pick keys from each candidate JSON before filling `{example}` | A SQL engine / JOIN |

TypeExpr stays the IR. DDL is the form people and models read.

```
job_example (full row, spine)
    │
    ├─ VIEW select_relevant_jobs_prompt
    │     SELECT id, title, work_description
    │     → stringify into {example} / {input_to_prompt}
    │
    └─ INSERT selected_*  = full row + selection_reason
          billed_items still on the object
```

## Persisted annotations

On `ModelField` (`relation` is metadata; runtime type stays `text`):

```ts
type FieldRelation =
  | { kind: "pk" }
  | { kind: "fk"; to: { modelId: StructureModelId; field: string } }
```

If no field has `kind: "pk"` and a field is named `id`, that field is treated as PRIMARY KEY.

On `PipelineModule`:

- `examplePromptView?: string` — `SELECT …` or `CREATE VIEW … AS SELECT …`
- `examplePromptFields?: string[]` — fallback column list if the view is unset

View wins if both are set. Empty view = stringify the full item.

Seeded on Billed Work Catalog Select:

- `WorkItem.id` / `JobExample.id` → `{ kind: "pk" }`
- `BilledLineRef.work_item_id` → `{ kind: "fk", to: { modelId: "m_work_item", field: "id" } }`
- Select Relevant Jobs: `examplePromptView: "SELECT id, title, work_description FROM job_example"`

## `schema.sql` generation (`allModelsToSql`)

Client-safe string building only (same idea as `lib/pydantic.ts`).

Emit order:

1. Header: `-- generated schema.sql — annotation only; runtime is still JSON maps`
2. Platform tables (always, even if the project has no documents):

```sql
CREATE TABLE document (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime TEXT,
  content TEXT,
  blob BLOB
);

CREATE TABLE quote_span (
  doc_id TEXT NOT NULL REFERENCES document(id),
  start INTEGER NOT NULL,
  end INTEGER NOT NULL
);
```

3. User models (`stripSharedModels` then `modelsForPydanticExport` — same set as `models.py`). Do not emit a second `document` / `quote_span` from builtins.
4. Child tables for `list[model]` when the parent has a PK.
5. Example-select views.

### Columns

| TypeExpr / field | SQL |
| --- | --- |
| text / markdown / latex / json / datetime | `TEXT` |
| int / bool | `INTEGER` |
| float | `REAL` |
| document | `TEXT REFERENCES document(id)` |
| quote / text_quote | `TEXT` |
| ref (embedded object) | `TEXT -- JSON` |
| list of prim/document | `TEXT -- JSON array` |
| required | `NOT NULL` (PK columns skip extra NOT NULL) |
| `relation.kind === "pk"` or inferred `id` | `PRIMARY KEY` (first wins) |
| `relation.kind === "fk"` | `REFERENCES {table}({field})` |

Identifiers: `sqlIdent` = `rustFieldIdent(modelExportIdentifier(name)).ident` (snake_case). `JobExample` → `job_example`.

### Nested `list[model]`

If the parent has a PK, do **not** put a JSON array on the parent. Emit a child table:

```
{parent_table}_{field}
```

Columns: `{parent}_id` FK to the parent PK, then each child model field. Nested `list[model]` on the child stays JSON TEXT (no infinite recurse).

If the parent has no PK: parent column `TEXT -- nested list, no parent pk`.

Billed-work example:

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

CREATE VIEW select_relevant_jobs_prompt AS
SELECT id, title, work_description FROM job_example;
```

`billed_items` is not a column on `job_example` and is not in the view.

### Prompt views

`exampleSelectViewSql`:

- Already `CREATE VIEW …` → trimmed + semicolon
- `SELECT …` → `CREATE VIEW {sqlIdent(label)}_prompt AS` + that SELECT
- Only `examplePromptFields` → synthesize `SELECT {fields} FROM {inStructure table}`

This slice parses **SELECT columns FROM table** only. JOIN / WHERE / GROUP BY / UNION / subqueries are a validity error: *prompt view in this slice is SELECT columns FROM table only (no JOIN)*. `SELECT *` means no projection (full item).

Where it shows up: Structure Code SQL tab (Monaco language `sql`, not a pipeline-export tab), `GeneratedPipelineTypes.schemaSql`, `scripts/typecheck_project.ts` → `schema.sql`.

## Runtime projection

`examplePromptColumns(m)`:

1. Parse `examplePromptView` → column names (`job_example.title` → `title`). Parse error / JOIN / `SELECT *` → no projection (validity flags the SQL).
2. Else `examplePromptFields` (trimmed, drop empties).
3. Else `undefined` → stringify the full item.

`projectExampleForPrompt(item, columns)` copies only keys that exist on the object. Missing keys are omitted (no `billed_items: null`).

Host (`run_engine/steps/example_select.ts`): project **before** `fillExampleSelectPrompt`. Prompt / preview / LLM batch see the view row. `buildExampleSelectVerdicts` still spreads the original candidate + `selection_reason`.

`fillExampleSelectPrompt` replaces `{example}` and `{input_to_prompt}` with the same projected JSON.

Export zips copy `pipeline_runtime.{ts,py,go,rs}` standalone — they duplicate a tiny project helper and take `promptColumns` / `prompt_columns`. Dispatch passes columns from `examplePromptColumns(m)` only when the view yields a real column list.

Validity: each selected column must be a field name on `inStructureId`. JOIN → structure-field invalid. Both view and fields set is allowed (view wins).

## Authoring

Pipeline field **Prompt view** (example-select): SQL SELECT for uncached `{example}`. Empty = all fields. Spine unchanged.

Placeholder:

```sql
SELECT id, title, work_description FROM job_example
```

## Not in this slice

SQLite per run, `.sqlite` input, Postgres connector, JOIN views, lookup-embed, `Pick` / `Omit` TypeExpr, rewriting Quote / Document as live SQL, `SelectedJobExample = JobExample & { selection_reason }`.

Grep leftovers: `TODO (example-select-view)`, `TODO (type-join)`. Plan: `docs/new_type_system_plan.md` Phase 6–7.

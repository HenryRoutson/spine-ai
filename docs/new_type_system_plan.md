# Generic pipeline type system plan

## Problem

The current spine typing model splits **what** flows between steps from **how many**:

| Today | Example |
|-------|---------|
| `inStructureId` / `outStructureId` | `HierarchicalSection` |
| `outIsList` boolean on the emitting step | `true` → spine carries `list[HierarchicalSection]` |

This works for the common `list[Model]` case but does not scale:

- **Nested containers** — `TreeNode[Section]`, `Optional[Section]`, `Set[ChunkId]` cannot be expressed.
- **Multi-field outputs** — a step that emits `{ sections: Section[], metadata: Meta }` is not a spine type; only a single structure id + list flag is stored.
- **Duplicate semantics** — `llm-batch` implies `outIsList: true`; quote steps inherit list-ness from upstream; validation special-cases each kind.
- **Cardinatlity mismatches** — e.g. upstream emits `list[HierarchicalSection]` but step `inStructureId` is `HierarchicalSection` (fixed for custom-code and bare transform auto-wrap, but the type system still stores the scalar id).
- **No real type-check on user code** — generated stubs use `unknown`; `outIsList` is not reflected in TypeScript/Python signatures for custom steps.

There is no `inIsList` field today; list-ness on inputs is inferred from step kind (`llm-batch` → expects list). That inference should become explicit on the type, not on the step kind.

---

## Goal

One **TypeExpr** intermediate representation (IR) for every spine edge and every structure field, with:

1. Full expressiveness (generics, unions, optional, recursive types).
2. Static pipeline validation derived from TypeExpr equality / subtyping — no parallel `outIsList` flags.
3. Generated **viewable, lintable** TypeScript and Python files per project.
4. User custom-code typed against generated step signatures.

Foundation already exists in `combined_full_stack/lib/server/type_expr.ts` (`TypeExpr`, `formatTypeExpr`, `typeExprToTs`, `typeExprToPy`, `typeExprToZod`).

---

## TypeExpr IR (extended)

Current variants:

```ts
type TypeExpr =
  | { kind: "prim"; name: PrimName }
  | { kind: "document" } | { kind: "quote" } | { kind: "text_quote" }
  | { kind: "list"; item: TypeExpr }
  | { kind: "ref"; modelId: StructureModelId }
  | { kind: "file"; inputTypes: InputType[] }
  | { kind: "unknown" };
```

### Add

| Variant | Meaning | TS | Python |
|---------|---------|-----|--------|
| `{ kind: "optional"; inner: TypeExpr }` | May be absent | `T \| undefined` | `Optional[T]` |
| `{ kind: "set"; item: TypeExpr }` | Unique collection | `Set<T>` | `set[T]` |
| `{ kind: "map"; key: TypeExpr; value: TypeExpr }` | Keyed map | `Record<K,V>` | `dict[K,V]` |
| `{ kind: "union"; variants: TypeExpr[] }` | One of | `A \| B` | `Union[A,B]` |
| `{ kind: "generic"; name: string; args: TypeExpr[] }` | Parameterized type | `TreeNode<T>` | `TreeNode[T]` |

### Generics on structure models

Add optional generic parameters to `StructureModel`:

```ts
type StructureModel = {
  id: StructureModelId;
  name: string;                    // e.g. "TreeNode"
  typeParams?: string[];           // e.g. ["T"]
  fields: ModelField[];
  ...
};

type ModelField = {
  ...
  type: FieldType;                 // extended: "generic_param" for T in TreeNode<T>
  ref?: StructureModelId;
  typeArgs?: TypeExpr[];           // e.g. list[model] ref TreeNode, typeArgs: [{ kind: "ref", modelId: Section }]
};
```

**TreeNode example**

```json
{
  "name": "TreeNode",
  "typeParams": ["T"],
  "fields": [
    { "name": "value", "type": "generic_param", "genericParam": "T" },
    { "name": "children", "type": "list[model]", "ref": "TreeNode", "typeArgs": ["T"] }
  ]
}
```

Generated TS:

```ts
export type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
};
```

**Set example** — field `seen: set[text]` → `{ kind: "set", item: { kind: "prim", name: "text" } }`.

**Spine example** — llm-batch over sections:

| Today | Future |
|-------|--------|
| `outStructureId: Section`, `outIsList: true` | `outType: { kind: "list", item: { kind: "ref", modelId: Section } }` |

---

## Step I/O: replace `outIsList` with `inType` / `outType`

```ts
type PipelineModule = {
  ...
  // deprecated → derived during migration
  inStructureId?: StructureModelId;
  outStructureId?: StructureModelId;
  outIsList?: boolean;

  // target shape
  inType?: TypeExpr;   // full spine input type
  outType?: TypeExpr;  // full spine output type
};
```

### Derivation rules (single source of truth)

| Step kind | `outType` |
|-----------|-----------|
| `input` | `{ kind: "ref", modelId: outStructureId }` or list thereof for multi-doc |
| `llm` | `outIsList ? list[ref] : ref` → becomes explicit `outType` |
| `llm-batch` | always `list[ref]` |
| `transform` (no code) | `ref` or `list[ref]`; list→object when output has matching list field |
| `custom-code` / coded `transform` | declared `outType`; may differ from `inType` (reshape allowed) |
| `output` / `assert` / `human-review` | passthrough `inType` |

Validation becomes: `step[i].inType` must be **compatible** with `step[i-1].outType` (exact match, or allowed reshape rules).

Compatibility rules (already partially implemented in `validity.ts`):

- Exact `typeExprEqual`
- Cardinality reshape: custom-code, coded transform
- Auto-wrap: bare transform + output structure with matching `list[model]` field (`canAutoWrapListIntoOutputStructure`)
- Passthrough: output, assert, quote, human-review

---

## Static type-checking pipeline

### 1. Generate typed artifacts (exists, needs upgrade)

Script: `npm run typecheck-project -- seeds/foo.json --tsc --pyright`

Outputs to `.typecheck/generated/` (or project-scoped path):

| File | Purpose |
|------|---------|
| `models.d.ts` / `models.py` | Structure models with real field types (not `unknown`) |
| `pipeline_types.d.ts` / `pipeline_types.py` | Per-step function signatures + `PipelineState` |
| `tsconfig.json` / `pyrightconfig.json` | Strict checking |

Upgrade `lib/server/type_codegen.ts`:

- Emit recursive/generic types correctly.
- Use full `outType`/`inType` on step signatures:
  `step_build_hierarchy(input: HierarchicalSection[], state: PipelineState): DocumentStructure`

### 2. Embed user custom-code in generated stubs

For each custom-code / transform-with-code step, emit a **typed shell** the user edits:

```ts
// pipeline_types.d.ts (generated)
export declare function step_build_hierarchy(
  input: HierarchicalSection[],
  state: PipelineState,
): DocumentStructure;

// user_code/build_hierarchy.ts (linked, typechecked)
import type { HierarchicalSection, DocumentStructure, PipelineState } from "../.typecheck/generated/models";

export default function step_build_hierarchy(
  input: HierarchicalSection[],
  _state: PipelineState,
): DocumentStructure {
  return { sections: input };
}
```

Run `tsc --noEmit` on merge of generated + user files in CI and on save in the UI.

### 3. Validate example payloads

Extend `scripts/typecheck_project.ts`:

- For each inference doc labeled `inference`, parse JSON and assert it matches the declared output type (Zod from TypeExpr).
- Flag mismatches before run (catches assistant proposal errors like wrong nesting in `HierarchicalSection.subsections`).

---

## UI: view typed files

Add a **Types** tab (or panel under Pipeline → Settings):

1. **Generate on demand** — call API route `POST /api/projects/:id/generate-types` → runs `generatePipelineTypes` server-side, returns file contents.
2. **Monaco read-only tabs** — `models.d.ts`, `pipeline_types.d.ts`, `models.py`, `pipeline_types.py` (already have Monaco in project).
3. **Diagnostics strip** — show output of last `tsc` / `pyright` run (pass/fail + first N errors).
4. **Link from invalid step** — io-mismatch inspector links to the generated signature for that step.

No need for users to run CLI locally; the UI mirrors what CI runs.

---

## Linter-first validation (target architecture)

**Principle:** `TypeExpr` is the IR for *codegen only*. Correctness comes from **generated Python or Rust** + an external type linter — not parallel logic in `validity.ts`, `typeExprToZod`, or `cardinalityMismatch`.

| Concern | Today (interim) | Target |
|---------|-----------------|--------|
| Spine IO compat | `computeInvalid` / `stepAcceptsSpineType` in TS | Typed orchestrator in `pipeline_types.py` or `.rs`; **pyright** / **cargo check** |
| Structure fields | `zodFromModel` / `typeExprToZod` | **pydantic** / **serde** types from `type_codegen` |
| Custom code | `tryCompileCustomCodeEntry` (TS syntax) | User fn inlined in export; **pyright** / **cargo** on full file |
| set / map / union | TS approximations (`z.array`, `z.record`) | Native `set[T]`, `dict[K,V]`, `enum` in generated Py/Rust only |
| CI / UI | `lintPipelineExportTs` + optional `computeInvalid` | **`lintPipelineExportPy`** + **`lintPipelineExportRust`** primary; view `.py`/`.rs` in Types tab |

**Pick one primary language for lint:** Python (pyright + pydantic, already partially wired in `scripts/typecheck_project.ts`) *or* Rust (cargo check, stronger set/map). Do not maintain three parallel checkers long-term.

Code markers: `AI : TODO (linter-first)` in repo.

---

## Migration plan

### Phase 1 — IR on spine (non-breaking)

- [x] `TypeExpr` + `stepSpineInType` / `stepSpineOutType` derive from `inStructureId` + `outIsList` (done).
- [x] Fix bare transform auto-wrap validation (`canAutoWrapListIntoOutputStructure`).
- [x] Persist optional `inType` / `outType` on modules — auto-populated on load via `migrateModulesSpineTypes`.
- [x] Extended `TypeExpr` IR: `optional`, `set`, `map`, `union`, `generic`.
- [x] Remove `outIsList` from `PipelineModule`; list-ness is `outType: list[ref]`.
- [ ] All spine validation reads TypeExpr only — **then delete TS spine rules once pyright/cargo passes**.

### Phase 2 — Remove `outIsList` from UI and assistant

- [x] Pipeline builder: `outType` via `patchSpineOutList` (Emit list output toggle).
- [x] Assistant prompt: `structureOut: list[Foo]` via `parseStructureHint`.
- [x] Seeds: explicit `outType` on list-emitting steps.

### Phase 3 — Field-level generics

- [ ] Extend `FieldType` with `set[text]`, `optional[model]`, `generic_param`.
- [ ] Structure editor: generic params UI on model header.
- [ ] Fix `HierarchicalSection`-style trees: allow self-ref with same type args for nested subsections.

### Phase 4 — Full codegen + linter (Python **or** Rust)

- [x] Upgrade `type_codegen.ts` to emit strict TS model types (`models.d.ts`).
- [x] API + Types tab in UI (`GET /api/projects/:id/types`, sidebar **Types** tab).
- [ ] `generatePipelineTypesRust` → `models.rs` + `pipeline_types.rs`
- [ ] `lintPipelineExportPy` (pyright) + `lintPipelineExportRust` (cargo check) — seed CI like TS lint today
- [ ] `typecheck_project.ts`: pyright/cargo default; deprioritize tsc
- [ ] Wire custom-code editor to import generated types (Monaco extra libs / pyright in browser N/A — server lint on save)
- [ ] CI: pyright + cargo on all seeds; drop redundant `computeInvalid` when coverage matches

### Phase 5 — Remove legacy custom validation

- [ ] Delete `stepAcceptsSpineType`, `cardinalityMismatch`, `bareTransformCanAutoWrapList`
- [ ] Delete `typeExprToZod` spine path; runtime validation via pydantic/serde only
- [ ] Drop duplicate TS export lint or keep as secondary smoke test only

### Phase 6 — Views, FKs, lookup-embed (SQL joins in the type system)

Do **not** add a `Join` TypeExpr that runs SQL. Annotate keys; derive views; keep step `inType`/`outType` stable unless a join *step* emits expanded rows.

- [ ] **Prompt view on example-select** (`examplePromptFields`) — dual of `exampleContextField`. `{example}` / `{input_to_prompt}` is a Pick of the item; spine passthrough stays the full row + `selection_reason`. `{passthrough}` is not a template var.
  - billed_work **Select Relevant Jobs**: prompt `title` + `work_description` only. Do not dump `billed_items` into the uncached suffix.
  - Do not reshape via custom-code (throws away FKs). Python only as an optional string formatter.
- [ ] **Field relations** — `ModelField.relation?: { kind: "pk" } | { kind: "fk"; to: { modelId; field } }`. Runtime type stays `text`. `BilledLineRef.work_item_id` → `WorkItem.id`.
- [ ] **Type operators** — `Pick[Model, fields]`, `Omit[Model, fields]`, `A & { field: T }`. `SelectedJobExample` → `JobExample & { selection_reason: text }` instead of a cloned model.
- [ ] **Lookup-embed engine** (generic, once): `{ leftPath, leftKey, right: state[label], rightKey, embedAs, how }`. Derived type: walk left at `leftPath`, intersect item with `{ embedAs: Right }`. Nested documents, not 3NF flatten. Assemble/combine stay product-zip.
- [ ] **View vs spine** — attach join spec as consumer config (example-select / LLM context) so filtering can get more complex without changing step I/O types. Join *step* only when downstream must consume expanded values.
- [ ] billed_work pass 2 cached prefix / draft: optional expand of selected jobs’ `billed_items`. Pass 2 `{example}` stays a catalog row. Do not denormalize `job_example_library.json`.

### Phase 7 — SQL DDL as the unified type annotation (no engine required at first)

Keep Phase 6. Add SQL as the **language** structures are shown and authored in. A SQLite instance is optional later.

**Unify documents, quotes, blobs, and catalogs in one schema:**

```sql
CREATE TABLE document (
  id TEXT PRIMARY KEY,          -- content hash (DocId)
  filename TEXT NOT NULL,
  mime TEXT,                    -- pdf / text / json / … (InputType)
  content TEXT,                 -- extracted text; NULL until doc-to-text
  blob BLOB                     -- original bytes (PDF wrapper)
);

CREATE TABLE quote_span (
  doc_id TEXT NOT NULL REFERENCES document(id),
  start INTEGER NOT NULL,
  end INTEGER NOT NULL
);
```

- [ ] **Types tab emits `schema.sql`** from StructureModel (CREATE TABLE / VIEW) next to models.py — even while runtime is still JSON maps.
- [ ] **Quotes are FKs** — `quote_string_t` is LLM wire TEXT; Link Quotes INSERTs `quote_span`. Not a parallel type universe.
- [ ] **PDFs/files are blob columns** on `document`, not TypeExpr `file` forever. doc-originals storage is the blob backend.
- [ ] **Nested list[model]** — child table (FK) or JSON column; declare which. Recursive trees may stay JSON.
- [ ] **Prompt views are SQL** — `CREATE VIEW job_example_prompt AS SELECT id, title, work_description FROM job_example`. Same inType/outType as Phase 6.
- [ ] **Optional later:** in-memory SQLite per run, `.sqlite` input/export, live Postgres connector. Not required for the annotation to be useful.
- [ ] Do not delete TypeExpr; it remains the IR. DDL is the human/LLM-facing form.

---

## Concrete fix for the markdown parser pipeline

The reported error:

```
input expects HierarchicalSection, upstream emits list[HierarchicalSection]
```

on **Build Hierarchy** after **Extract Subsections** (`llm-batch`).

Valid fixes (any one):

1. **custom-code** with `function main(input) { return { sections: input }; }` — already valid; cardinality mismatch allowed for custom-code.
2. **bare transform** `HierarchicalSection` → `DocumentStructure` where `DocumentStructure.sections: list[model] ref HierarchicalSection` — now valid after auto-wrap rule (preferred when no custom logic needed).
3. Future: explicit `inType: list[HierarchicalSection]`, `outType: DocumentStructure` — no ambiguity.

Also fix model design for deep numbering (`2.6.3.6`): `HierarchicalSection.subsections` should ref **HierarchicalSection** (recursive), not flat `Section`, if nested `subsections` arrays are required in output.

---

## Files to touch (reference)

| Area | Files |
|------|-------|
| IR | `lib/server/type_expr.ts` |
| Validation | `lib/server/validity.ts`, `lib/server/structure.ts` |
| Codegen | `lib/server/type_codegen.ts`, `lib/server/pydantic.ts`, `scripts/typecheck_project.ts` |
| Persistence | `lib/server/types.ts`, `lib/server/seed.ts`, Supabase JSON |
| UI | `components/pipeline-fields/*`, new `components/pipeline-types-panel.tsx` |
| Assistant | `lib/server/assistant-prompt.ts`, `lib/server/pipeline_assistant.ts` |
| API | `app/api/projects/[id]/generate-types/route.ts` (new) |

---

## Success criteria

1. No `outIsList` (or `inIsList`) in module JSON — cardinality lives in `TypeExpr` only.
2. `TreeNode[T]`, `set[T]`, `optional[T]` expressible in structure editor and codegen.
3. Every project can open **Types** tab and see generated TS/Python with strict types.
4. `npm run typecheck-project -- <seed> --tsc --pyright` passes for all seeds.
5. Pipeline assistant proposals surface validation errors in chat (`validationErrors` non-null whenever `invalidCount > 0`) — already wired; cardinality fixes reduce silent UI-only mismatches.

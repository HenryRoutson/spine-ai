// AI : Typed SQL-style row IDs — grep "TODO (sql-id-ref)" / "DONE (sql-id-ref)".
//
// Shipped: ModelField.relation pk|fk persists (seeds + API). allModelsToSql prints
//   REFERENCES. Nested field.ref is composition (embed / child table), not a row id.
//   Runtime values stay JSON maps. No SQLite engine. See docs/sql_types.md.
//
// Goal: branded id types (work_item_id_string), load files into that schema, one
//   list per id type so missing / extra / wrong values are visible — GUI + MCP.
//
// Two refs — do not merge:
//   field.ref + model|list[model]  → nested record (StructureFieldRefPicker)
//   field.relation fk              → typed id, runtime still text/int
//
// Layers:
//   schema  — StructureModel + relation (exists) + UI authoring (missing)
//   catalog — JSON/Excel/run state flattened to virtual tables
//   index   — one bucket per branded id type; every pk/fk occurrence
//
// Id type name: {sqlIdent(model)}_{sqlIdent(pkField)}_string.
//   WorkItem.id → work_item_id_string. FK fields reuse the target brand.
//
// Integrity: missing-pk (fk with no row), duplicate-pk, unused-pk (warning),
//   wrong-id (prefix / near-match, warning). Schema issues always; instance
//   issues only when a catalog is loaded.
//
// Do not: flatten billed_items off JobExample; auto-repair dangling fks;
//   new TypeExpr kind; scrape schema.sql in MCP. type-join (lookup-embed) and
//   example-select-view stay separate greps.

export {}

// AI : DONE (sql-id-ref) — slice A schema UI: Key column on structure spreadsheet
// AI :   (— / PK / FK → Model.field). Nested record picker stays field.ref.
// AI : DONE (sql-id-ref) — slice A validity: dangling fk target, fk type ≠ pk type,
// AI :   multiple pk. computeStructureIssues; do not auto-rewrite.
// AI : DONE (sql-id-ref) — slice A branded codegen: lib/sql-id-types.ts; models.d.ts +
// AI :   pydantic aliases work_item_id_string; LLM json schema stays string + FK description.
// AI : DONE (sql-id-ref) — slice A MCP/CLI review: mcpModelReview prints fk→; export_pydantic
// AI :   top-level schemaSql + idTypes; structure.set-relation (workspace_edits + session_action).
// AI : DONE (sql-id-ref) — slice A infer-on-author: suggest pk on id, fk on {other}_id when
// AI :   Model Other has a pk — confirm in UI/MCP, never silent persist (source_job_id).
// AI : DONE (sql-id-ref) — slice B catalog: JSON/Excel/sourceDocId → virtual tables; flatten
// AI :   list[model] like allModelsToSql child tables. lib/sql-catalog.ts. Bind via shape match.
// AI : DONE (sql-id-ref) — slice B index: lib/sql-id-index.ts one list per id type; missing /
// AI :   duplicate / unused. GUI id-inspector + Documents chips. MCP inspect_ids; CLI session ids.
// AI : TODO (sql-id-ref) — slice C runs: include pipeline state / run JSON as tables;
// AI :   optional allowed-id list in llmSchema when catalog small; near-match wrong-id;
// AI :   validate_step_output checkRefs.
// AI : TODO (sql-id-ref) — later: sql.js / .sqlite input, lookup-embed (type-join), JOIN views.
// AI :   SQL tab jump REFERENCES → model. Do not block A–C.

// ---------------------------------------------------------------------------
// Example — billed_work_catalog_select (already has relation in the seed).
//   WorkItem.id PK, JobExample.id PK, BilledLineRef.work_item_id FK → WorkItem.id
//   Catalog: work_item.json + job_example_library.json
//   Index work_item_id_string: each WI-* with pk row + every billed_items.work_item_id
//   Missing: billed WI-999 with no WorkItem. Unused: catalog item never billed.
// ---------------------------------------------------------------------------

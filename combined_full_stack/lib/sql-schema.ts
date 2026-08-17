// AI : TODO (sql-schema) — IMPLEMENT THIS FILE. Client-safe string building only (like lib/pydantic.ts).
// AI :   No better-sqlite3 / sql.js / postgres in this slice. Runtime values stay JSON maps.
// AI :   Delete `export {}` when real exports exist. Re-export nothing from lib/pydantic.ts.
// AI :
// AI : =============================================================================
// AI : PROBLEM
// AI : =============================================================================
// AI : Billed Work Catalog Select → Select Relevant Jobs fills {example} with JSON.stringify(full JobExample).
// AI : billed_items is [{ work_item_id: "WI-00100", quantity: 1 }, …] — uncached per-candidate tokens, no
// AI : pass-1 signal. Spine must KEEP billed_items (pass 2 + draft). Pass 2 {example} is a WorkItem row — leave it.
// AI : Do not custom-code a slimmer JobExample. Do not denormalize job_example_library.json.
// AI :
// AI : =============================================================================
// AI : EXPORTS TO ADD
// AI : =============================================================================
// AI : export type ParsedSqlSelect = {
// AI :   columns: string[]        // empty array means SELECT * (no projection)
// AI :   from?: string            // table/view name if present
// AI :   hasJoin: boolean
// AI :   error?: string           // set instead of throwing for validity
// AI : }
// AI : export function parseSqlSelect(sql: string): ParsedSqlSelect
// AI : export function sqlIdent(name: string): string
// AI :   // rustFieldIdent(modelExportIdentifier(name)).ident — snake_case, SQL-safe
// AI : export function sqlTableName(modelName: string): string  // alias of sqlIdent
// AI : export function examplePromptColumns(m: PipelineModule): string[] | undefined
// AI :   // 1. if examplePromptView trim: parseSqlSelect; if error or hasJoin → undefined (validity flags it)
// AI :   //    if columns.length === 0 (SELECT *) → undefined (no projection)
// AI :   //    else return columns (strip table. prefixes: job_example.title → title)
// AI :   // 2. else if examplePromptFields?.length → those names trimmed, drop empties
// AI :   // 3. else undefined (stringify full item)
// AI : export function projectExampleForPrompt(item: unknown, columns?: string[]): unknown
// AI :   // if !columns?.length return item
// AI :   // if item not a plain object, return item
// AI :   // return Object.fromEntries(columns.filter(c => c in item).map(c => [c, item[c]]))
// AI :   // missing keys omitted (do not insert null) — LLM should not see billed_items: undefined
// AI : export function allModelsToSql(models: StructureModel[], modules?: PipelineModule[]): string
// AI : export function exampleSelectViewSql(m: PipelineModule): string | undefined
// AI :   // if view is already CREATE VIEW … → return trimmed + semicolon
// AI :   // if view is SELECT … → `CREATE VIEW ${sqlIdent(m.label)}_prompt AS\n${select};`
// AI :   // if only examplePromptFields → synthesize SELECT {fields} FROM {sqlTableName of inStructure}
// AI :
// AI : =============================================================================
// AI : parseSqlSelect RULES
// AI : =============================================================================
// AI : Strip comments -- … and /* … */. Collapse whitespace. Case-insensitive keywords.
// AI : Accept:
// AI :   SELECT a, b FROM t
// AI :   SELECT t.a, t.b FROM t
// AI :   CREATE VIEW name AS SELECT a, b FROM t
// AI :   CREATE VIEW name AS SELECT a, b FROM t;   (trailing semicolon ok)
// AI : Quoted ids: "work_description" or `work_description` → work_description
// AI : SELECT * → columns: []
// AI : Reject / set hasJoin+error (do not parse columns for runtime) if the SQL contains JOIN, LEFT, RIGHT,
// AI :   INNER, OUTER, CROSS, UNION, INTERSECT, EXCEPT, GROUP BY, HAVING, LIMIT, WHERE, WITH, subquery `(SELECT`.
// AI :   Prefer a single error string: "prompt view in this slice is SELECT columns FROM table only (no JOIN)"
// AI : Unparseable → { columns: [], hasJoin: false, error: "could not parse SELECT …" }
// AI : Empty/whitespace sql → treat as unset (caller should not call parse).
// AI :
// AI : =============================================================================
// AI : allModelsToSql ALGORITHM
// AI : =============================================================================
// AI : Header comment:
// AI :   -- generated schema.sql — annotation only; runtime is still JSON maps
// AI : Always emit platform tables first (even if project has no documents):
// AI :   CREATE TABLE document (
// AI :     id TEXT PRIMARY KEY,
// AI :     filename TEXT NOT NULL,
// AI :     mime TEXT,
// AI :     content TEXT,
// AI :     blob BLOB
// AI :   );
// AI :   CREATE TABLE quote_span (
// AI :     doc_id TEXT NOT NULL REFERENCES document(id),
// AI :     start INTEGER NOT NULL,
// AI :     end INTEGER NOT NULL
// AI :   );
// AI : User models = stripSharedModels(models) then modelsForPydanticExport (same set as models.py).
// AI : Do NOT emit a second document/quote_span from builtins.
// AI : Per user model, collect:
// AI :   pkField = fields.find(relation.kind==="pk") ?? fields.find(name==="id")
// AI :   For each named field:
// AI :     expr = fieldToTypeExpr(f)
// AI :     if expr.kind==="list" && expr.item.kind==="ref":
// AI :       if pkField: childTables.push({ parent, field, childModelId: expr.item.modelId })
// AI :       else: parent column JSON TEXT  -- comment: -- nested list, no parent pk
// AI :       continue (do not also emit JSON if child table)
// AI :     else: parent column from sqlColumnType(expr, f)
// AI : sqlColumnType:
// AI :   prim text/markdown/latex/json → TEXT
// AI :   prim int → INTEGER; float → REAL; bool → INTEGER; datetime → TEXT
// AI :   document → TEXT REFERENCES document(id)
// AI :   quote | text_quote → TEXT
// AI :   ref (embedded object) → TEXT  -- JSON
// AI :   list of prim/document → TEXT  -- JSON array
// AI :   optional or f.optional → no NOT NULL; else NOT NULL
// AI :   relation.kind pk OR (inferred id pk) → PRIMARY KEY (only one; if several pk flags, first wins, comment the rest)
// AI :   relation.kind fk → REFERENCES {sqlTableName(targetModel.name)}({to.field})
// AI :     resolve to.modelId via models.find; if missing model, still emit REFERENCES unknown_{id}(field) + comment
// AI : Child table name: `${sqlTableName(parent.name)}_${sqlIdent(field.name)}`
// AI : Child columns:
// AI :   ${sqlTableName(parent.name)}_id <parent pk sql type> NOT NULL REFERENCES parent(pkName)
// AI :   then each child model field (same rules; nested list[model] on child → JSON TEXT, do not recurse infinitely)
// AI : Emit order: all parent CREATE TABLE, then all child CREATE TABLE, then views.
// AI : Views: for modules with kind example-select, exampleSelectViewSql if defined, separated by blank line.
// AI : Pretty-print: 2-space indent, trailing comma on last column optional (SQLite allows none — omit last comma).
// AI :
// AI : =============================================================================
// AI : TYPES / SEED / API (not this file, but required for DDL + views to persist)
// AI : =============================================================================
// AI : types.ts ModelField:
// AI :   export type FieldRelation =
// AI :     | { kind: "pk" }
// AI :     | { kind: "fk"; to: { modelId: StructureModelId; field: string } }
// AI :   relation?: FieldRelation
// AI :   Add "relation" to StructureFieldDef Pick.
// AI : types.ts PipelineModule:
// AI :   examplePromptView?: string
// AI :   examplePromptFields?: string[]
// AI : seed.ts field object: relation: z.discriminatedUnion("kind", [
// AI :   z.object({ kind: z.literal("pk") }),
// AI :   z.object({ kind: z.literal("fk"), to: z.object({ modelId: z.string(), field: z.string() }) }),
// AI : ]).optional()
// AI : seed.ts module: examplePromptView: z.string().optional(), examplePromptFields: z.array(z.string()).optional()
// AI : api_schemas modulePatch: examplePromptView max MAX_MODULE_STRING_CHARS; examplePromptFields max 64 × 200
// AI : api_schemas structureFieldPatchSchema: relation same union
// AI :
// AI : =============================================================================
// AI : HOST RUNTIME
// AI : =============================================================================
// AI : example-select.ts: add examplePromptColumns + projectExampleForPrompt (import from this file).
// AI : run_engine/steps/example_select.ts exampleSelectPrompt:
// AI :   fillExampleSelectPrompt(template, description, projectExampleForPrompt(example, examplePromptColumns(m)))
// AI :   Must close over `m` — change signature to (m, template, description, example).
// AI :   promptFor / llmBatchStructured / preview all use the projected prompt; verdicts/kept use original items.
// AI : example-select-relevance.ts fillExampleSelectPrompt:
// AI :   .replace(/\{example\}/g, exampleText).replace(/\{input_to_prompt\}/g, exampleText)
// AI : example-select-prompt-preview.ts: split {input_to_prompt} as per_candidate too.
// AI : example-select-fields.tsx: PipelineField "Prompt view" textarea, font-mono, placeholder
// AI :   SELECT id, title, work_description FROM job_example
// AI :   hint: uncached {example} columns — spine still the full row. Empty = all fields.
// AI :   onUpdate({ examplePromptView: e.target.value || undefined })
// AI :
// AI : =============================================================================
// AI : EXPORT RUNTIMES (copied standalone — duplicate a 10-line projectExampleForPrompt, do not import this file)
// AI : =============================================================================
// AI : ts selectRelevant(items, description, template, reasonField?, promptColumns?: string[])
// AI :   stringify projectExampleForPrompt(item, promptColumns); kept rows still full item
// AI :   also replace {input_to_prompt}
// AI : py select_relevant(..., reason_field="selection_reason", prompt_columns: list[str] | None = None)
// AI : go selectRelevant(..., promptColumns ...string)  // empty variadic = no projection
// AI : rs select_relevant(..., prompt_columns: &[String])  // empty slice = no projection
// AI : pipeline_export_dispatch emitExampleSelect all langs: pass columns from examplePromptColumns(ctx.m)
// AI :   TS: if cols: selectRelevant(items, description, template, reason, colsLiteral)
// AI :       else keep current 3- or 4-arg form
// AI : pipeline_export_lint.test.ts: billed_work TS export contains title/work_description promptColumns
// AI :   and does not pass billed_items in that array
// AI :
// AI : =============================================================================
// AI : VALIDITY
// AI : =============================================================================
// AI : computeExampleSelectInvalid(modules, models):
// AI :   if examplePromptView trim:
// AI :     parsed = parseSqlSelect(view)
// AI :     if parsed.error || parsed.hasJoin → StructureField with parsed.error
// AI :     else for each column, must match a field.name on models.find(inStructureId)
// AI :   if examplePromptFields: same field-name check
// AI :   if both set, view wins (fields ignored) — do not invalid for having both
// AI :
// AI : =============================================================================
// AI : UI schema.sql TAB
// AI : =============================================================================
// AI : code-viewer.tsx: CodeViewerLanguage |= "sql"; CODE_LANG_LABEL.sql = "SQL"; CODE_LANG_LINT_HINT.sql = "annotation"
// AI :   Do NOT add "sql" to CODE_VIEWER_LANGUAGES array (pipeline export dialog iterates that).
// AI : structure-code-view: allModelsToSql(models, modules); defaultLanguage can stay python; sql tab first or last is fine.
// AI : structure-builder.tsx: <StructureCodeView models={…} typeAliases={…} modules={project?.modules} />
// AI : type_codegen GeneratedPipelineTypes.schemaSql; generatePipelineTypes fills it
// AI : scripts/typecheck_project.ts writeFileSync(join(outDir, "schema.sql"), generated.schemaSql)
// AI :
// AI : =============================================================================
// AI : SEED billed_work_catalog_select.json
// AI : =============================================================================
// AI : WorkItem.id: "relation": { "kind": "pk" }
// AI : JobExample.id: "relation": { "kind": "pk" }
// AI : BilledLineRef.work_item_id: "relation": { "kind": "fk", "to": { "modelId": "m_work_item", "field": "id" } }
// AI :   (confirm WorkItem model id in the seed — grep "m_work_item")
// AI : mod_select_jobs: "examplePromptView": "SELECT id, title, work_description FROM job_example"
// AI : Do not set examplePromptView on Select Relevant Work Items.
// AI : Expected child table in schema.sql: job_example_billed_items (job_example_id FK, work_item_id FK, quantity, unit_note)
// AI :
// AI : =============================================================================
// AI : TESTS (lib/sql-schema.test.ts + maybe example-select-relevance / a small projection test)
// AI : =============================================================================
// AI : parseSqlSelect("SELECT id, title, work_description FROM job_example")
// AI :   columns [id,title,work_description], from job_example, hasJoin false
// AI : parseSqlSelect("CREATE VIEW job_example_prompt AS SELECT id, title FROM job_example")
// AI : parseSqlSelect("SELECT * FROM job_example") → columns []
// AI : parseSqlSelect("SELECT a FROM t JOIN u ON t.id = u.id") → hasJoin true, error set
// AI : projectExampleForPrompt({id,title,work_description,billed_items:[…]}, ["title","work_description"])
// AI :   has no billed_items key
// AI : allModelsToSql(load billed_work seed models) contains CREATE TABLE work_item, job_example,
// AI :   job_example_billed_items, REFERENCES work_item(id), CREATE VIEW … title, work_description
// AI :   and the view SQL does not select billed_items
// AI :
// AI : =============================================================================
// AI : LATER (do not implement)
// AI : =============================================================================
// AI : SQLite per run, .sqlite input, Postgres connector, JOIN views, lookup-embed, Pick/Omit TypeExpr,
// AI : SelectedJobExample = JobExample & { selection_reason }. Keep (example-select-view) and (type-join) TODOs.
// AI :
// AI : User rules: // AI : comments; StrReplace on large combined_full_stack files; python3; no extra markdown.

export {}

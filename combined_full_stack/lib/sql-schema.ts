// AI : SQL DDL annotation — client-safe string building only (like lib/pydantic.ts).
// AI :   No better-sqlite3 / sql.js / postgres in this slice. Runtime values stay JSON maps.
// AI : parametric structs / trees stay JSON columns — no GENERIC TABLE.
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
// AI : EXPORTS
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
// AI : structure-code-view: allModelsToSql(models, modules); defaultLanguage sql so View SQL opens the table DDL.
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
// AI : LATER (do not implement in this file)
// AI : =============================================================================
// AI : SQLite per run, .sqlite input, Postgres connector, JOIN views, Pick/Omit TypeExpr,
// AI : SelectedJobExample = JobExample & { selection_reason }. Keep (example-select-view) TODOs.
// AI : DONE (type-join) — host example-select {description} auto-spreads context FKs → candidate catalog (lib/lookup-embed.ts).
// AI : DONE (sql-id-ref) — A–B live in lib/sql-id-*.ts; this file stays the DDL printer.
// AI :
// AI : User rules: // AI : comments; StrReplace on large combined_full_stack files; python3; no extra markdown.

import { stripSharedModels } from "@/lib/server/builtin_models"
import { fieldToTypeExpr, PrimName, TypeExprKind, type TypeExpr } from "@/lib/server/type_expr"
import { pkFieldOf, sqlIdent, sqlTableName } from "@/lib/sql-id-types"
import { modelsForPydanticExport } from "@/lib/structure-shape"
import { ModuleKind, type ModelField, type PipelineModule, type StructureModel } from "@/lib/types"

export { pkFieldOf, sqlIdent, sqlTableName } from "@/lib/sql-id-types"

const JOIN_SLICE_ERROR =
  "prompt view in this slice is SELECT columns FROM table only (no JOIN)"

const FORBIDDEN_SQL =
  /\b(?:JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|UNION|INTERSECT|EXCEPT|HAVING|LIMIT|WHERE|WITH)\b|\bGROUP\s+BY\b|\(\s*SELECT\b/i

export type ParsedSqlSelect = {
  columns: string[]
  from?: string
  hasJoin: boolean
  error?: string
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ")
}

function unquoteSqlIdent(raw: string): string {
  const t = raw.trim()
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("`") && t.endsWith("`")))) {
    return t.slice(1, -1)
  }
  return t
}

function columnName(raw: string): string {
  const parts = raw.trim().split(".")
  return unquoteSqlIdent(parts[parts.length - 1] ?? "")
}

export function parseSqlSelect(sql: string): ParsedSqlSelect {
  const collapsed = stripSqlComments(sql).replace(/\s+/g, " ").trim().replace(/;+\s*$/, "")
  if (!collapsed) return { columns: [], hasJoin: false, error: "could not parse SELECT …" }
  if (FORBIDDEN_SQL.test(collapsed)) {
    return { columns: [], hasJoin: true, error: JOIN_SLICE_ERROR }
  }
  const selectSql = collapsed.replace(/^CREATE\s+VIEW\s+\S+\s+AS\s+/i, "")
  const selectMatch = /^SELECT\s+(.+)$/i.exec(selectSql)
  if (!selectMatch) return { columns: [], hasJoin: false, error: "could not parse SELECT …" }
  const body = selectMatch[1]!.trim()
  const fromMatch = /^(.*?)\s+FROM\s+(\S+)$/i.exec(body)
  const colSql = (fromMatch ? fromMatch[1] : body).trim()
  const from = fromMatch ? unquoteSqlIdent(fromMatch[2] ?? "") : undefined
  if (colSql === "*") return { columns: [], from, hasJoin: false }
  const columns = colSql.split(",").map(columnName).filter(Boolean)
  if (!columns.length) return { columns: [], from, hasJoin: false, error: "could not parse SELECT …" }
  return { columns, from, hasJoin: false }
}

export function examplePromptColumns(m: PipelineModule): string[] | undefined {
  const view = m.examplePromptView?.trim()
  if (view) {
    const parsed = parseSqlSelect(view)
    if (parsed.error || parsed.hasJoin || parsed.columns.length === 0) return undefined
    return parsed.columns
  }
  const fields = m.examplePromptFields?.map((f) => f.trim()).filter(Boolean)
  return fields?.length ? fields : undefined
}

export function projectExampleForPrompt(item: unknown, columns?: string[]): unknown {
  if (!columns?.length) return item
  if (item == null || typeof item !== "object" || Array.isArray(item)) return item
  const rec = item as Record<string, unknown>
  return Object.fromEntries(columns.filter((c) => c in rec).map((c) => [c, rec[c]]))
}

function withSemicolon(sql: string): string {
  const t = sql.trim().replace(/;+\s*$/, "")
  return t ? `${t};` : t
}

export function exampleSelectViewSql(m: PipelineModule, models?: StructureModel[]): string | undefined {
  const view = m.examplePromptView?.trim()
  if (view) {
    if (/^CREATE\s+VIEW\b/i.test(view)) return withSemicolon(view)
    if (/^SELECT\b/i.test(view)) {
      return `CREATE VIEW ${sqlIdent(m.label)}_prompt AS\n${view.replace(/;+\s*$/, "")};`
    }
    return undefined
  }
  const fields = m.examplePromptFields?.map((f) => f.trim()).filter(Boolean)
  if (!fields?.length) return undefined
  const inModel = models?.find((x) => x.id === m.inStructureId)
  const from = sqlTableName(inModel?.name ?? "example")
  return `CREATE VIEW ${sqlIdent(m.label)}_prompt AS\nSELECT ${fields.map(sqlIdent).join(", ")} FROM ${from};`
}

type Unwrapped = { inner: TypeExpr; optional: boolean }

function unwrapOptional(expr: TypeExpr): Unwrapped {
  if (expr.kind === TypeExprKind.Optional) {
    const u = unwrapOptional(expr.inner)
    return { inner: u.inner, optional: true }
  }
  return { inner: expr, optional: false }
}

function sqlBaseType(expr: TypeExpr): string {
  switch (expr.kind) {
    case TypeExprKind.Prim:
      if (expr.name === PrimName.Int || expr.name === PrimName.Bool) return "INTEGER"
      if (expr.name === PrimName.Float) return "REAL"
      return "TEXT"
    case TypeExprKind.Document:
      return "TEXT"
    default:
      return "TEXT"
  }
}

type ChildTable = {
  parent: StructureModel
  field: ModelField
  childModelId: string
  pkField: ModelField
}

type ColumnEmit = { line: string; childModelId?: string }

function isPkColumn(f: ModelField, pkField: ModelField | undefined): boolean {
  return !!pkField && f === pkField
}

function fkClause(f: ModelField, models: StructureModel[]): { sql: string; comment?: string } | undefined {
  const rel = f.relation
  if (rel?.kind !== "fk") return undefined
  const target = models.find((m) => m.id === rel.to.modelId)
  if (!target) {
    return {
      sql: ` REFERENCES unknown_${rel.to.modelId}(${sqlIdent(rel.to.field)})`,
      comment: `unresolved fk ${rel.to.modelId}`,
    }
  }
  return { sql: ` REFERENCES ${sqlTableName(target.name)}(${sqlIdent(rel.to.field)})` }
}

function emitColumnLine(
  f: ModelField,
  models: StructureModel[],
  pkField: ModelField | undefined,
  pkEmitted: { value: boolean },
  nestedListAsJson: boolean,
): ColumnEmit | undefined {
  if (!f.name.trim()) return undefined
  const unwrapped = unwrapOptional(fieldToTypeExpr(f))
  const optional = unwrapped.optional || f.optional
  const expr = unwrapped.inner

  if (expr.kind === TypeExprKind.List && expr.item.kind === TypeExprKind.Ref) {
    if (!nestedListAsJson && pkField) {
      return { line: "", childModelId: expr.item.modelId }
    }
    const nullSql = optional ? "" : " NOT NULL"
    return { line: `  ${sqlIdent(f.name)} TEXT${nullSql} -- nested list, no parent pk` }
  }

  let typeSql = "TEXT"
  let extra = ""
  let comment: string | undefined
  switch (expr.kind) {
    case TypeExprKind.Prim:
      typeSql = sqlBaseType(expr)
      break
    case TypeExprKind.Document:
      typeSql = "TEXT"
      extra = " REFERENCES document(id)"
      break
    case TypeExprKind.Quote:
    case TypeExprKind.TextQuote:
      typeSql = "TEXT"
      break
    case TypeExprKind.Ref:
      typeSql = "TEXT"
      comment = "JSON"
      break
    case TypeExprKind.List:
      typeSql = "TEXT"
      comment = "JSON array"
      break
    default:
      typeSql = "TEXT"
  }

  const thisPk = isPkColumn(f, pkField) && !pkEmitted.value
  if (thisPk) pkEmitted.value = true
  else if (f.relation?.kind === "pk") comment = comment ?? "extra pk"

  const fk = fkClause(f, models)
  if (fk) {
    extra += fk.sql
    if (fk.comment) comment = comment ? `${comment}; ${fk.comment}` : fk.comment
  }

  const pkSql = thisPk ? " PRIMARY KEY" : ""
  const nullSql = thisPk || optional ? "" : " NOT NULL"
  const commentSql = comment ? ` -- ${comment}` : ""
  return { line: `  ${sqlIdent(f.name)} ${typeSql}${pkSql}${nullSql}${extra}${commentSql}` }
}

function emitCreateTable(name: string, lines: string[]): string {
  const body = lines
    .map((line, i) => {
      const comma = i < lines.length - 1 ? "," : ""
      const commentAt = line.indexOf(" -- ")
      if (commentAt === -1) return `${line}${comma}`
      return `${line.slice(0, commentAt)}${comma}${line.slice(commentAt)}`
    })
    .join("\n")
  return `CREATE TABLE ${name} (\n${body}\n);`
}

function childTableName(parent: StructureModel, field: ModelField): string {
  return `${sqlTableName(parent.name)}_${sqlIdent(field.name)}`
}

export function allModelsToSql(models: StructureModel[], modules?: PipelineModule[]): string {
  const lookup = stripSharedModels(models)
  const exported = modelsForPydanticExport(lookup)
  const chunks: string[] = [
    "-- generated schema.sql — annotation only; runtime is still JSON maps",
    "",
    emitCreateTable("document", [
      "  id TEXT PRIMARY KEY",
      "  filename TEXT NOT NULL",
      "  mime TEXT",
      "  content TEXT",
      "  blob BLOB",
    ]),
    "",
    emitCreateTable("quote_span", [
      "  doc_id TEXT NOT NULL REFERENCES document(id)",
      "  start INTEGER NOT NULL",
      "  end INTEGER NOT NULL",
      // AI : TODO (media-view-E-timequote) — t_start REAL, t_end REAL nullable (seconds on audio/video docs).
    ]),
  ]

  const childTables: ChildTable[] = []
  for (const model of exported) {
    const pkField = pkFieldOf(model)
    const pkEmitted = { value: false }
    const colLines: string[] = []
    for (const f of model.fields) {
      const emitted = emitColumnLine(f, lookup, pkField, pkEmitted, false)
      if (!emitted) continue
      if (emitted.childModelId && pkField) {
        childTables.push({ parent: model, field: f, childModelId: emitted.childModelId, pkField })
        continue
      }
      colLines.push(emitted.line)
    }
    chunks.push("", emitCreateTable(sqlTableName(model.name), colLines.length ? colLines : ["  -- no columns"]))
  }

  for (const child of childTables) {
    const childModel = lookup.find((m) => m.id === child.childModelId)
    const parentPkType = sqlBaseType(unwrapOptional(fieldToTypeExpr(child.pkField)).inner)
    const parentTable = sqlTableName(child.parent.name)
    const parentPkName = sqlIdent(child.pkField.name)
    const pkEmitted = { value: false }
    const childPk = childModel ? pkFieldOf(childModel) : undefined
    const colLines: string[] = [
      `  ${parentTable}_id ${parentPkType} NOT NULL REFERENCES ${parentTable}(${parentPkName})`,
    ]
    for (const f of childModel?.fields ?? []) {
      const emitted = emitColumnLine(f, lookup, childPk, pkEmitted, true)
      if (!emitted || emitted.childModelId) continue
      colLines.push(emitted.line)
    }
    chunks.push("", emitCreateTable(childTableName(child.parent, child.field), colLines))
  }

  if (modules) {
    for (const m of modules) {
      if (m.kind !== ModuleKind.ExampleSelect) continue
      const view = exampleSelectViewSql(m, lookup)
      if (view) chunks.push("", view)
    }
  }

  return chunks.join("\n") + "\n"
}

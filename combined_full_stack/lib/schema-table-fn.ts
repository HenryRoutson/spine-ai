// AI : Python table helpers from the same StructureModel that prints schema.sql / models.py.
import { stripSharedModels } from "@/lib/server/builtin_models"
import { fieldToTypeExpr, TypeExprKind } from "@/lib/server/type_expr"
import { pkFieldOf, sqlIdent, sqlTableName } from "@/lib/sql-id-types"
import { modelExportIdentifier, modelsForPydanticExport } from "@/lib/structure-shape"
import { uid } from "@/lib/id"
import type { ModelField, StructureModel } from "@/lib/types"

function pyIdent(name: string): string | null {
  const ident = name.replace(/[^A-Za-z0-9_]/g, "_")
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) return null
  return ident
}

function isChildTableField(f: ModelField): boolean {
  const expr = fieldToTypeExpr(f)
  return expr.kind === TypeExprKind.List && expr.item.kind === TypeExprKind.Ref
}

export function tableColumnsForModel(model: StructureModel): string[] {
  return model.fields
    .filter((f) => f.name.trim() && !isChildTableField(f))
    .map((f) => sqlIdent(f.name))
    .filter(Boolean)
}

function modelTableClass(model: StructureModel): string {
  const table = sqlTableName(model.name)
  const cls = `${modelExportIdentifier(model.name)}Table`
  const cols = tableColumnsForModel(model)
  const pyCols = cols.map((c) => pyIdent(c)).filter((c): c is string => !!c)
  const colTuple = pyCols.map((c) => `"${c}"`).join(", ")
  const kwargs = pyCols.join(", ")
  const lits = pyCols.map((c) => `_sql_lit(${c})`).join(", ")
  const insert =
    pyCols.length === 0
      ? `    @staticmethod
    def insert() -> str:
        return "INSERT INTO ${table} DEFAULT VALUES"`
      : `    @staticmethod
    def insert(*, ${kwargs}) -> str:
        return (
            "INSERT INTO ${table} (${pyCols.join(", ")}) VALUES ("
            + ", ".join([${lits}])
            + ")"
        )`
  return `class ${cls}:
    name = "${table}"
    columns = (${colTuple}${pyCols.length === 1 ? "," : ""})

    @staticmethod
    def select() -> str:
        return "SELECT * FROM ${table}"

${insert}
`
}

export function defaultSelectSqlForModel(model: StructureModel): string {
  return `SELECT * FROM ${sqlTableName(model.name)}`
}

export function defaultSelectSqlForModule(
  m: { outStructureId?: string },
  models: StructureModel[],
): string | null {
  const out = models.find((x) => x.id === m.outStructureId)
  if (!out?.name.trim()) return null
  return defaultSelectSqlForModel(out)
}

const SQL_INSERT_PREV_KINDS = new Set([
  "llm",
  "llm-batch",
  "quote",
  "parallel",
  "custom-code",
  "transform",
])

export function shouldDeriveInsertSql(
  prev: { kind: string; outStructureId?: string } | undefined,
  sqlModule: { outStructureId?: string },
): boolean {
  if (!prev || !sqlModule.outStructureId) return false
  if (prev.outStructureId !== sqlModule.outStructureId) return false
  return SQL_INSERT_PREV_KINDS.has(prev.kind)
}

function isSqlRow(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

// AI : quote fields are { text, quote } on the spine — SQL stores the copied text.
export function sqlCellText(value: unknown): string {
  if (typeof value === "string") return value
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "text" in value &&
    typeof (value as { text: unknown }).text === "string"
  ) {
    return (value as { text: string }).text
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function sqlLit(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return `'${sqlCellText(value).replace(/'/g, "''")}'`
}

function rowValueForColumn(row: Record<string, unknown>, col: string): unknown {
  if (col in row) return row[col]
  const key = Object.keys(row).find((k) => sqlIdent(k) === col)
  return key ? row[key] : undefined
}

export function defaultInsertSqlForModel(
  model: StructureModel,
  row: Record<string, unknown>,
  rowId?: string,
): string {
  const cols = tableColumnsForModel(model)
  const pkName = pkFieldOf(model)?.name ?? "id"
  const pkCol = sqlIdent(pkName)
  const existing = rowValueForColumn(row, pkCol)
  const id =
    (typeof existing === "string" || typeof existing === "number" ? String(existing).trim() : "") ||
    rowId?.trim() ||
    `row_${uid()}`
  const names = cols.includes(pkCol) ? cols : [pkCol, ...cols]
  const values = names.map((col) => (col === pkCol ? sqlLit(id) : sqlLit(rowValueForColumn(row, col) ?? null)))
  return `INSERT INTO ${sqlTableName(model.name)} (${names.join(", ")}) VALUES (${values.join(", ")})`
}

export function derivedInsertSqls(model: StructureModel, prevValue: unknown): string[] {
  const rows = (Array.isArray(prevValue) ? prevValue : [prevValue]).filter(isSqlRow)
  return rows.map((row) => defaultInsertSqlForModel(model, row))
}

export function allModelsToTableFns(models: StructureModel[]): string {
  const exportModels = modelsForPydanticExport(stripSharedModels(models)).filter((m) =>
    m.fields.some((f) => f.name.trim()),
  )
  const header = [
    "# generated table helpers — same structures as models.py / schema.sql",
    "# Paste the SQL into a sql step, or omit sql after an extract of the same structure to INSERT.",
    "",
    "def _sql_lit(value):",
    "    if value is None:",
    '        return "NULL"',
    "    if isinstance(value, bool):",
    '        return "TRUE" if value else "FALSE"',
    "    if isinstance(value, (int, float)) and not isinstance(value, bool):",
    "        return str(value)",
    '    return "\'" + str(value).replace("\'", "\'\'") + "\'"',
    "",
    "",
  ].join("\n")
  if (!exportModels.length) return `${header}# (no user structures)\n`
  return `${header}${exportModels.map(modelTableClass).join("\n")}`
}

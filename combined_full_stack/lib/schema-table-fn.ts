// AI : Python table helpers from the same StructureModel that prints schema.sql / models.py.
import { stripSharedModels } from "@/lib/server/builtin_models"
import { fieldToTypeExpr, TypeExprKind } from "@/lib/server/type_expr"
import { sqlIdent, sqlTableName } from "@/lib/sql-id-types"
import { modelExportIdentifier, modelsForPydanticExport } from "@/lib/structure-shape"
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

export function allModelsToTableFns(models: StructureModel[]): string {
  const exportModels = modelsForPydanticExport(stripSharedModels(models)).filter((m) =>
    m.fields.some((f) => f.name.trim()),
  )
  const header = [
    "# generated table helpers — same structures as models.py / schema.sql",
    "# Paste the SQL into a sql step, or call from Python custom-code.",
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

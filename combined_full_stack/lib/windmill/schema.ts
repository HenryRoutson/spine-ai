// AI : StructureModel → JSON Schema via Zod (same IR as Pydantic + SQL). Windmill forms/resource types consume this.
import { z } from "zod"
import { stripSharedModels } from "@/lib/server/builtin_models"
import { FieldType, type ModelField, type StructureModel, type TypeAlias } from "@/lib/types"
import { modelsForPydanticExport } from "@/lib/structure-shape"
import { sqlTableName } from "@/lib/sql-id-types"
import { zodFromModel } from "@/lib/server/type_expr"

export type json_schema = Record<string, unknown>

function isQuoteField(f: ModelField): boolean {
  return (
    f.type === FieldType.TupleTextQuote ||
    f.type === FieldType.ListTupleTextQuote
  )
}

function stampSpineExtras(
  schema: json_schema,
  model: StructureModel,
): json_schema {
  const properties = (schema.properties ?? {}) as Record<string, json_schema>
  const nextProps: Record<string, json_schema> = { ...properties }
  for (const f of model.fields) {
    const prev = nextProps[f.name] ?? {}
    nextProps[f.name] = {
      ...prev,
      "x-spine-deterministic": f.deterministic !== false,
      ...(isQuoteField(f) ? { "x-spine-quote": true } : {}),
    }
  }
  return {
    ...schema,
    title: model.name,
    "x-spine-sql-table": sqlTableName(model.name),
    properties: nextProps,
  }
}

export function modelToJsonSchema(
  model: StructureModel,
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
): json_schema {
  const raw = z.toJSONSchema(zodFromModel(model, models.length ? models : [model], false, typeAliases)) as json_schema
  return stampSpineExtras(raw, model)
}

export function allModelsToJsonSchema(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): json_schema {
  const exportModels = modelsForPydanticExport(stripSharedModels(models))
  const defs: Record<string, json_schema> = {}
  for (const m of exportModels) {
    defs[m.name] = modelToJsonSchema(m, models, typeAliases)
  }
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "spine_structures",
    description:
      "Project structures — one JSON Schema per model. Same IR as Zod (runtime), Pydantic (models.py), and SQL (schema.sql).",
    $defs: defs,
  }
}

export function allModelsToJsonSchemaText(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string {
  return `${JSON.stringify(allModelsToJsonSchema(models, typeAliases), null, 2)}\n`
}

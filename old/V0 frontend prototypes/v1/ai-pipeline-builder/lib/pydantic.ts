import type { FieldType, ModelField, StructureModel } from "@/lib/types"

const PY_TYPE: Record<FieldType, string> = {
  str: "str",
  int: "int",
  float: "float",
  bool: "bool",
  "list[str]": "list[str]",
  datetime: "datetime",
  model: "BaseModel",
}

function fieldToPy(field: ModelField, models: StructureModel[]): string {
  let t: string
  if (field.type === "model") {
    const ref = models.find((m) => m.id === field.ref)
    t = ref ? ref.name : "BaseModel"
  } else {
    t = PY_TYPE[field.type]
  }
  if (field.optional) t = `Optional[${t}]`
  const fieldArgs: string[] = []
  if (field.optional) fieldArgs.push("default=None")
  if (field.description) fieldArgs.push(`description=${JSON.stringify(field.description)}`)
  const rhs = fieldArgs.length ? ` = Field(${fieldArgs.join(", ")})` : ""
  return `    ${field.name}: ${t}${rhs}`
}

export function modelToPydantic(
  model: StructureModel,
  models: StructureModel[],
): string {
  const header = `class ${model.name}(BaseModel):`
  const doc = model.description ? `    """${model.description}"""` : null
  const body =
    model.fields.length > 0
      ? model.fields.map((f) => fieldToPy(f, models)).join("\n")
      : "    pass"
  return [header, doc, body].filter(Boolean).join("\n")
}

export function allModelsToPydantic(models: StructureModel[]): string {
  const imports = [
    "from __future__ import annotations",
    "from datetime import datetime",
    "from typing import Optional",
    "from pydantic import BaseModel, Field",
    "",
  ].join("\n")
  const classes = models
    .map((m) => modelToPydantic(m, models))
    .join("\n\n\n")
  return `${imports}\n\n${classes}\n`
}

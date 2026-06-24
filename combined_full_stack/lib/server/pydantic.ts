import type { FieldType, ModelField, StructureModel } from "./types";

// AI : ported from the frontend stub so the `models.py` code view stays identical post-merge.
// AI : TODO bug — tuple[text,quote] renders as `tuple[str, Quote]` but the runtime/zod shape
// AI : (and the structure attached to cached artifacts) is the OBJECT {text: str, quote: Quote},
// AI : so the pydantic code view doesn't match the JSON shown next to it.
const PY_TYPE: Record<FieldType, string> = {
  text: "str",
  int: "int",
  float: "float",
  bool: "bool",
  datetime: "datetime",
  document: "Document",
  "list[text]": "list[str]",
  "tuple[text,quote]": "tuple[str, Quote]",
  "list[tuple[text,quote]]": "list[tuple[str, Quote]]",
  model: "BaseModel",
  "list[model]": "list[BaseModel]",
};

function fieldToPy(field: ModelField, models: StructureModel[]): string {
  let t: string;
  if (field.type === "model" || field.type === "list[model]") {
    const ref = models.find((m) => m.id === field.ref);
    const name = ref ? ref.name : "BaseModel";
    t = field.type === "list[model]" ? `list[${name}]` : name;
  } else {
    t = PY_TYPE[field.type];
  }
  if (field.optional) t = `Optional[${t}]`;
  const fieldArgs: string[] = [];
  if (field.optional) fieldArgs.push("default=None");
  if (field.description) fieldArgs.push(`description=${JSON.stringify(field.description)}`);
  const ex = field.example?.trim();
  if (ex) fieldArgs.push(`examples=[${JSON.stringify(ex)}]`);
  const rhs = fieldArgs.length ? ` = Field(${fieldArgs.join(", ")})` : "";
  return `    ${field.name}: ${t}${rhs}`;
}

export function modelToPydantic(model: StructureModel, models: StructureModel[]): string {
  const header = `class ${model.name}(BaseModel):`;
  const doc = model.description ? `    """${model.description}"""` : null;
  const body =
    model.fields.length > 0
      ? model.fields.map((f) => fieldToPy(f, models)).join("\n")
      : "    pass";
  return [header, doc, body].filter(Boolean).join("\n");
}

export function allModelsToPydantic(models: StructureModel[]): string {
  const imports = [
    "from __future__ import annotations",
    "from datetime import datetime",
    "from typing import Optional",
    "from pydantic import BaseModel, Field",
    "",
    "# `text` is an alias for str — kept readable for non-technical reviewers.",
    "# Quote links extracted text back to its source span (see langextract).",
    "class Quote(BaseModel):",
    '    doc_id: str = Field(description="Source document hash")',
    '    start: int = Field(description="Start offset in the source")',
    '    end: int = Field(description="End offset in the source")',
    "",
    "class Document(BaseModel):",
    "    doc_id: str",
    "    purpose: str",
    "    body: str",
    "",
  ].join("\n");
  const classes = models.map((m) => modelToPydantic(m, models)).join("\n\n\n");
  return `${imports}\n\n${classes}\n`;
}

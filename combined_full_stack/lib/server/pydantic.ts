import { fieldToPy } from "./type_expr";
import { stripSharedModels } from "./builtin_models";
import type { StructureModel } from "./types";

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
    "from typing import Any, Optional",
    "from pydantic import BaseModel, Field",
    "",
    "# `text` is an alias for str — kept readable for non-technical reviewers.",
    "# Quote links extracted text back to its source span (see langextract).",
    "class Quote(BaseModel):",
    '    doc_id: str = Field(description="Source document hash")',
    '    start: int = Field(description="Start offset in the source")',
    '    end: int = Field(description="End offset in the source")',
    "",
    "class TextQuote(BaseModel):",
    '    text: str',
    "    quote: Quote",
    "",
    "class Document(BaseModel):",
    '    content: str = Field(description="Full extracted text of the file")',
    '    filename: str = Field(description="Original upload filename")',
    "",
    "class FileInput(BaseModel):",
    "    content: str",
    "    filename: str",
    "",
  ].join("\n");
  const classes = stripSharedModels(models).map((m) => modelToPydantic(m, models)).join("\n\n\n");
  return `${imports}\n\n${classes}\n`;
}

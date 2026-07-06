import { fieldToPy, fieldToTypeExpr, typeExprToPy, typeExprToTs } from "./type_expr";
import { stripSharedModels } from "./builtin_models";
import { modelExportIdentifier, modelsForPydanticExport } from "../structure-shape";
import type { StructureModel, TypeAlias } from "./types";

function typeAliasExportName(name: string): string {
  return modelExportIdentifier(name);
}

export function typeAliasToPydantic(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportName(alias.name);
  const body = typeExprToPy(alias.expr, models);
  const note = alias.description?.trim();
  return note ? `type ${id} = ${body}  # ${note}` : `type ${id} = ${body}`;
}

export function typeAliasesToPydantic(aliases: TypeAlias[], models: StructureModel[]): string {
  if (!aliases.length) return "";
  const header = "# --- project type aliases ---";
  const body = aliases.map((a) => typeAliasToPydantic(a, models)).join("\n");
  return `${header}\n${body}\n`;
}

export function typeAliasToDts(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportName(alias.name);
  const body = typeExprToTs(alias.expr, models);
  const note = alias.description?.trim();
  return note ? `/** ${note} */\nexport type ${id} = ${body};` : `export type ${id} = ${body};`;
}

export function typeAliasesToDts(aliases: TypeAlias[], models: StructureModel[]): string {
  if (!aliases.length) return "";
  return `${aliases.map((a) => typeAliasToDts(a, models)).join("\n\n")}\n`;
}

export function modelToPydantic(model: StructureModel, models: StructureModel[]): string {
  const header = `class ${modelExportIdentifier(model.name)}(BaseModel):`;
  const doc = model.description ? `    """${model.description}"""` : null;
  const body =
    model.fields.length > 0
      ? model.fields.map((f) => fieldToPy(f, models)).join("\n")
      : "    pass";
  return [header, doc, body].filter(Boolean).join("\n");
}

export function allModelsToPydantic(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string {
  const imports = [
    "from __future__ import annotations",
    "from datetime import datetime",
    "from typing import Any, Optional, Union",
    "from pydantic import BaseModel, Field",
    "",
    "# `text` is an alias for str — kept readable for non-technical reviewers.",
    "# Quote links extracted text back to its source span (see langextract).",
    "# quote_string_t → str at LLM time; quote_span_t / QuoteSpan after Link Quotes.",
    "class QuoteSpan(BaseModel):",
    '    doc_id: str = Field(description="Source document hash")',
    '    start: int = Field(description="Start offset in the source")',
    '    end: int = Field(description="End offset in the source")',
    "",
    "Quote = QuoteSpan",
    "",
    "class TextQuote(BaseModel):",
    '    text: str',
    "    quote: QuoteSpan",
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
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const aliasesBlock = typeAliasesToPydantic(typeAliases, exportModels);
  const classes = exportModels.map((m) => modelToPydantic(m, exportModels)).join("\n\n\n");
  const aliasGap = aliasesBlock ? `\n\n${aliasesBlock}` : "";
  return `${imports}${aliasGap}\n\n${classes}\n`;
}

function modelToDts(model: StructureModel, models: StructureModel[]): string {
  const lines = model.fields
    .filter((f) => f.name.trim())
    .map((f) => {
      let t = typeExprToTs(fieldToTypeExpr(f), models);
      if (f.optional) t = `${t} | undefined`;
      return `  ${f.name}: ${t};`;
    });
  return `export type ${modelExportIdentifier(model.name)} = {\n${lines.join("\n")}\n};`;
}

export function allModelsToDts(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string {
  const header = [
    "export type QuoteSpan = { doc_id: string; start: number; end: number };",
    "export type Quote = QuoteSpan;",
    "export type TextQuote = { text: string; quote: QuoteSpan };",
    "export type Document = { content: string; filename: string };",
    "export type FileInput = Document;",
    "",
  ].join("\n");
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const aliasesBlock = typeAliasesToDts(typeAliases, exportModels);
  const aliasGap = aliasesBlock ? `${aliasesBlock}\n` : "";
  const user = exportModels.map((m) => modelToDts(m, exportModels)).join("\n\n");
  return `${header}${aliasGap}${user}\n`;
}

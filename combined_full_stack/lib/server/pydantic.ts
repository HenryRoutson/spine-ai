import { fieldToPy, fieldToTypeExpr, typeExprToPy, typeExprToRust, typeExprToTs } from "./type_expr";
import { stripBuiltinTypeAliases } from "./builtin_types";
import { stripSharedModels } from "./builtin_models";
import type { TypeExpr } from "./types";
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

// AI : alias bodies must not self-reference quote/text_quote names — those resolve to concrete TS types.
function typeExprToAliasDefinitionTs(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case "quote":
      return "string";
    case "text_quote":
      return "{ text: string; quote: string }";
    default:
      return typeExprToTs(expr, models);
  }
}

export function typeAliasToDts(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportName(alias.name);
  const body = typeExprToAliasDefinitionTs(alias.expr, models);
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
    "export type quote_string_t = string;",
    "export type quote_span_t = QuoteSpan;",
    "export type text_quote_t = { text: string; quote: string };",
    "",
  ].join("\n");
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const aliasesBlock = typeAliasesToDts(stripBuiltinTypeAliases(typeAliases), exportModels);
  const aliasGap = aliasesBlock ? `${aliasesBlock}\n` : "";
  const user = exportModels.map((m) => modelToDts(m, exportModels)).join("\n\n");
  return `${header}${aliasGap}${user}\n`;
}

function typeExprToAliasDefinitionRust(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case "quote":
      return "String";
    case "text_quote":
      return "TextQuoteLoose";
    default:
      return typeExprToRust(expr, models);
  }
}

export function typeAliasToRust(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportName(alias.name);
  const body = typeExprToAliasDefinitionRust(alias.expr, models);
  const note = alias.description?.trim();
  return note ? `/// ${note}\npub type ${id} = ${body};` : `pub type ${id} = ${body};`;
}

function fieldToRust(field: { name: string; optional: boolean; description?: string }, models: StructureModel[], expr: TypeExpr): string {
  let t = typeExprToRust(expr, models);
  if (field.optional && expr.kind !== "optional") t = `Option<${t}>`;
  const lines: string[] = [];
  if (field.description?.trim()) lines.push(`    /// ${field.description.trim()}`);
  // AI : serde rename keeps JSON field names when Rust id differs (rare for valid identifiers).
  lines.push(`    pub ${field.name}: ${t},`);
  return lines.join("\n");
}

function modelToRust(model: StructureModel, models: StructureModel[]): string {
  const id = modelExportIdentifier(model.name);
  const doc = model.description?.trim() ? `/// ${model.description.trim()}\n` : "";
  const fields = model.fields
    .filter((f) => f.name.trim())
    .map((f) => fieldToRust(f, models, fieldToTypeExpr(f)));
  const body = fields.length ? fields.join("\n") : "    // empty";
  return [
    doc + "#[derive(Debug, Clone, Serialize, Deserialize)]",
    `pub struct ${id} {`,
    body,
    "}",
  ].join("\n");
}

// AI : single-file Rust structs for pipeline export — serde JSON round-trip.
export function allModelsToRust(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string {
  const header = [
    "use serde::{Deserialize, Serialize};",
    "use serde_json::{json, Value};",
    "use std::collections::{HashMap, HashSet};",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct QuoteSpan {",
    "    pub doc_id: String,",
    "    pub start: i64,",
    "    pub end: i64,",
    "}",
    "",
    "pub type Quote = QuoteSpan;",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct TextQuote {",
    "    pub text: String,",
    "    pub quote: QuoteSpan,",
    "}",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct Document {",
    "    pub content: String,",
    "    pub filename: String,",
    "}",
    "",
    "pub type FileInput = Document;",
    "pub type quote_string_t = String;",
    "pub type quote_span_t = QuoteSpan;",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct TextQuoteLoose {",
    "    pub text: String,",
    "    pub quote: String,",
    "}",
    "",
    "pub type text_quote_t = TextQuoteLoose;",
    "",
  ].join("\n");
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const aliases = stripBuiltinTypeAliases(typeAliases);
  const aliasesBlock = aliases.length
    ? `\n// --- project type aliases ---\n${aliases.map((a) => typeAliasToRust(a, exportModels)).join("\n")}\n`
    : "";
  const user = exportModels.map((m) => modelToRust(m, exportModels)).join("\n\n");
  return `${header}${aliasesBlock}\n${user}\n`;
}

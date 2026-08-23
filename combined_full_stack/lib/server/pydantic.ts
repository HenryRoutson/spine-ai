import {
  fieldToPy,
  fieldToTypeExpr,
  typeExprToBaml,
  typeExprToGo,
  typeExprToPy,
  typeExprToRust,
  typeExprToTs,
  TypeExprKind,
} from "./type_expr";
// AI : TODO (arch-pydantic-walk) — allModelsTo{Pydantic,Dts,Rust,Go,Baml} share a field walk; language printers only.
import { stripBuiltinTypeAliases } from "./builtin_types";
import { stripSharedModels } from "./builtin_models";
import type { TypeExpr } from "./types";
import { collectSqlIdTypes, fieldSqlIdType, idTypeBrand } from "@/lib/sql-id-types";
import {
  goFieldIdent,
  modelExportIdentifier,
  modelExportIdentifierGo,
  modelExportIdentifierRust,
  modelsForPydanticExport,
  rustFieldIdent,
} from "../structure-shape";
import type { StructureModel, TypeAlias } from "./types";
import { formatParamsGo, formatParamsTs, formatTypeParams } from "../type-params";

function typeAliasExportName(name: string): string {
  return modelExportIdentifier(name);
}

function typeAliasExportNameRust(name: string): string {
  return modelExportIdentifierRust(name);
}

function typeAliasExportNameGo(name: string): string {
  return modelExportIdentifierGo(name);
}

// AI : alias bodies must not self-reference quote/text_quote names — resolve to concrete Py types.
function typeExprToAliasDefinitionPy(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case TypeExprKind.Quote:
      return "str";
    case TypeExprKind.TextQuote:
      return "dict[str, str]";
    default:
      return typeExprToPy(expr, models);
  }
}

export function typeAliasToPydantic(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportName(alias.name);
  const body = typeExprToAliasDefinitionPy(alias.expr, models);
  const note = alias.description?.trim();
  const head = `type ${id}${formatTypeParams(alias.params)}`
  return note ? `${head} = ${body}  # ${note}` : `${head} = ${body}`;
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
    case TypeExprKind.Quote:
      return "string";
    case TypeExprKind.TextQuote:
      return "{ text: string; quote: string }";
    default:
      return typeExprToTs(expr, models);
  }
}

export function typeAliasToDts(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportName(alias.name);
  const body = typeExprToAliasDefinitionTs(alias.expr, models);
  const note = alias.description?.trim();
  const head = `export type ${id}${formatParamsTs(alias.params)}`
  return note ? `/** ${note} */\n${head} = ${body};` : `${head} = ${body};`;
}

export function typeAliasesToDts(aliases: TypeAlias[], models: StructureModel[]): string {
  if (!aliases.length) return "";
  return `${aliases.map((a) => typeAliasToDts(a, models)).join("\n\n")}\n`;
}

export function modelToPydantic(model: StructureModel, models: StructureModel[]): string {
  const header = `class ${modelExportIdentifier(model.name)}${formatTypeParams(model.params)}(BaseModel):`;
  const doc = model.description ? `    """${model.description}"""` : null;
  const body =
    model.fields.length > 0
      ? model.fields.map((f) => fieldToPy(f, models, fieldSqlIdType(model, f, models))).join("\n")
      : "    pass";
  return [header, doc, body].filter(Boolean).join("\n");
}

// AI : shared builtins — concrete aliases so quote_string_t / text_quote_t never self-reference.
function pydanticBuiltinModels(): string {
  return [
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
    "    text: str",
    "    quote: QuoteSpan",
    "",
    "class Document(BaseModel):",
    '    content: str | None = Field(default=None, description="Extracted text — None until Convert to text instantiates it")',
    '    filename: str = Field(description="Original upload filename")',
    "",
    "class VideoClip(BaseModel):",
    '    doc_id: str | None = Field(default=None, description="Hosted document hash when stored as document.blob")',
    '    url: str | None = Field(default=None, description="Remote playable URL")',
    "    filename: str",
    "    mime: str",
    "",
    "class AudioClip(BaseModel):",
    "    doc_id: str | None = None",
    "    url: str | None = None",
    "    filename: str",
    "    mime: str",
    "",
    "class ImageStill(BaseModel):",
    "    doc_id: str | None = None",
    "    url: str | None = None",
    "    filename: str",
    "    mime: str",
    "",
    "class FileInput(BaseModel):",
    "    content: str",
    "    filename: str",
    "",
    "type quote_string_t = str",
    "type quote_span_t = QuoteSpan",
    "type text_quote_t = dict[str, str]",
    "",
  ].join("\n");
}

function sqlIdAliasesPy(models: StructureModel[]): string {
  const types = collectSqlIdTypes(models)
  if (!types.length) return ""
  return `${types.map((t) => `type ${t.name} = str`).join("\n")}\n`
}

function sqlIdAliasesDts(models: StructureModel[]): string {
  const types = collectSqlIdTypes(models)
  if (!types.length) return ""
  return `${types.map((t) => `export type ${t.name} = string & { __brand: ${JSON.stringify(idTypeBrand(t.name))} };`).join("\n")}\n`
}

export function allModelsToPydantic(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
  opts: { includeImports?: boolean } = {},
): string {
  const includeImports = opts.includeImports !== false;
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const needDatetime = exportModels.some((m) =>
    m.fields.some((f) => {
      const t = fieldToTypeExpr(f);
      return t.kind === TypeExprKind.Prim && t.name === "datetime";
    }),
  );
  const imports = includeImports
    ? [
        "from __future__ import annotations",
        "",
        ...(needDatetime ? ["from datetime import datetime"] : []),
        "from typing import Any",
        "from pydantic import BaseModel, Field",
        "",
      ].join("\n")
    : "";
  const aliasesBlock = typeAliasesToPydantic(stripBuiltinTypeAliases(typeAliases), exportModels);
  const idAliases = sqlIdAliasesPy(exportModels);
  const classes = exportModels.map((m) => modelToPydantic(m, exportModels)).join("\n\n\n");
  const aliasGap = aliasesBlock ? `\n${aliasesBlock}` : "";
  const idGap = idAliases ? `\n${idAliases}` : "";
  return `${imports}${pydanticBuiltinModels()}${aliasGap}${idGap}\n${classes}\n`;
}

function modelToDts(model: StructureModel, models: StructureModel[]): string {
  const lines = model.fields
    .filter((f) => f.name.trim())
    .map((f) => {
      const branded = fieldSqlIdType(model, f, models)
      let t = branded ?? typeExprToTs(fieldToTypeExpr(f), models);
      if (f.optional) t = `${t} | undefined`;
      return `  ${f.name}: ${t};`;
    });
  return `export type ${modelExportIdentifier(model.name)}${formatParamsTs(model.params)} = {\n${lines.join("\n")}\n};`;
}

export function allModelsToDts(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string {
  const header = [
    "export type QuoteSpan = { doc_id: string; start: number; end: number };",
    "export type Quote = QuoteSpan;",
    "export type TextQuote = { text: string; quote: QuoteSpan };",
    "export type Document = { content: string | null; filename: string };",
    "export type VideoClip = { doc_id?: string; url?: string; filename: string; mime: string };",
    "export type AudioClip = { doc_id?: string; url?: string; filename: string; mime: string };",
    "export type ImageStill = { doc_id?: string; url?: string; filename: string; mime: string };",
    "export type FileInput = Document;",
    "export type quote_string_t = string;",
    "export type quote_span_t = QuoteSpan;",
    "export type text_quote_t = { text: string; quote: string };",
    "",
  ].join("\n");
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const aliasesBlock = typeAliasesToDts(stripBuiltinTypeAliases(typeAliases), exportModels);
  const idAliases = sqlIdAliasesDts(exportModels);
  const aliasGap = aliasesBlock ? `${aliasesBlock}\n` : "";
  const idGap = idAliases ? `${idAliases}\n` : "";
  const user = exportModels.map((m) => modelToDts(m, exportModels)).join("\n\n");
  return `${header}${aliasGap}${idGap}${user}\n`;
}

function typeExprToAliasDefinitionRust(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case TypeExprKind.Quote:
      return "String";
    case TypeExprKind.TextQuote:
      return "TextQuoteLoose";
    default:
      return typeExprToRust(expr, models);
  }
}

export function typeAliasToRust(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportNameRust(alias.name);
  const body = typeExprToAliasDefinitionRust(alias.expr, models);
  const note = alias.description?.trim();
  const head = `pub type ${id}${formatParamsTs(alias.params)}`
  return note ? `/// ${note}\n${head} = ${body};` : `${head} = ${body};`;
}

function fieldToRust(field: { name: string; optional: boolean; description?: string }, models: StructureModel[], expr: TypeExpr): string {
  let t = typeExprToRust(expr, models);
  if (field.optional && expr.kind !== TypeExprKind.Optional) t = `Option<${t}>`;
  const { ident, rename } = rustFieldIdent(field.name);
  const lines: string[] = [];
  if (field.description?.trim()) lines.push(`    /// ${field.description.trim()}`);
  if (rename) lines.push(`    #[serde(rename = ${JSON.stringify(rename)})]`);
  lines.push(`    pub ${ident}: ${t},`);
  return lines.join("\n");
}

function modelToRust(model: StructureModel, models: StructureModel[]): string {
  const id = modelExportIdentifierRust(model.name);
  const doc = model.description?.trim() ? `/// ${model.description.trim()}\n` : "";
  const fields = model.fields
    .filter((f) => f.name.trim())
    .map((f) => fieldToRust(f, models, fieldToTypeExpr(f)));
  const body = fields.length ? fields.join("\n") : "    // empty";
  return [
    doc + "#[derive(Debug, Clone, Serialize, Deserialize)]",
    `pub struct ${id}${formatParamsTs(model.params)} {`,
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
    "use serde_json::Value;",
    "use std::collections::HashMap;",
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
    "    pub content: Option<String>,",
    "    pub filename: String,",
    "}",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct VideoClip {",
    "    pub doc_id: Option<String>,",
    "    pub url: Option<String>,",
    "    pub filename: String,",
    "    pub mime: String,",
    "}",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct AudioClip {",
    "    pub doc_id: Option<String>,",
    "    pub url: Option<String>,",
    "    pub filename: String,",
    "    pub mime: String,",
    "}",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct ImageStill {",
    "    pub doc_id: Option<String>,",
    "    pub url: Option<String>,",
    "    pub filename: String,",
    "    pub mime: String,",
    "}",
    "",
    "pub type FileInput = Document;",
    // AI : domain names match TS/Python; allow keeps rustc quiet on snake_case aliases.
    "#[allow(non_camel_case_types)]",
    "pub type quote_string_t = String;",
    "#[allow(non_camel_case_types)]",
    "pub type quote_span_t = QuoteSpan;",
    "",
    "#[derive(Debug, Clone, Serialize, Deserialize)]",
    "pub struct TextQuoteLoose {",
    "    pub text: String,",
    "    pub quote: String,",
    "}",
    "",
    "#[allow(non_camel_case_types)]",
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

function typeExprToAliasDefinitionGo(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case TypeExprKind.Quote:
      return "string";
    case TypeExprKind.TextQuote:
      return "TextQuoteLoose";
    default:
      return typeExprToGo(expr, models);
  }
}

export function typeAliasToGo(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportNameGo(alias.name);
  const body = typeExprToAliasDefinitionGo(alias.expr, models);
  const note = alias.description?.trim();
  const head = `type ${id}${formatParamsGo(alias.params)}`
  return note ? `// ${note}\n${head} = ${body}` : `${head} = ${body}`;
}

function fieldToGo(
  field: { name: string; optional: boolean; description?: string },
  models: StructureModel[],
  expr: TypeExpr,
): string {
  let t = typeExprToGo(expr, models);
  if (field.optional && expr.kind !== TypeExprKind.Optional) t = `*${t}`;
  const { ident, jsonTag } = goFieldIdent(field.name);
  const omit = field.optional || expr.kind === TypeExprKind.Optional ? ",omitempty" : "";
  const lines: string[] = [];
  if (field.description?.trim()) lines.push(`\t// ${field.description.trim()}`);
  lines.push(`\t${ident} ${t} \`json:"${jsonTag}${omit}"\``);
  return lines.join("\n");
}

function modelToGo(model: StructureModel, models: StructureModel[]): string {
  const id = modelExportIdentifierGo(model.name);
  const doc = model.description?.trim() ? `// ${model.description.trim()}\n` : "";
  const fields = model.fields
    .filter((f) => f.name.trim())
    .map((f) => fieldToGo(f, models, fieldToTypeExpr(f)));
  const body = fields.length ? fields.join("\n") : "\t// empty";
  return `${doc}type ${id}${formatParamsGo(model.params)} struct {\n${body}\n}`;
}

// AI : single-file Go structs for pipeline export — encoding/json round-trip.
export function allModelsToGo(models: StructureModel[], typeAliases: TypeAlias[] = []): string {
  const header = [
    "type QuoteSpan struct {",
    '\tDocID string `json:"doc_id"`',
    '\tStart int64  `json:"start"`',
    '\tEnd   int64  `json:"end"`',
    "}",
    "",
    "type Quote = QuoteSpan",
    "",
    "type TextQuote struct {",
    '\tText  string    `json:"text"`',
    '\tQuote QuoteSpan `json:"quote"`',
    "}",
    "",
    "type Document struct {",
    '\tContent  *string `json:"content"`',
    '\tFilename string  `json:"filename"`',
    "}",
    "",
    "type VideoClip struct {",
    '\tDocID    *string `json:"doc_id,omitempty"`',
    '\tURL      *string `json:"url,omitempty"`',
    '\tFilename string  `json:"filename"`',
    '\tMIME     string  `json:"mime"`',
    "}",
    "",
    "type AudioClip struct {",
    '\tDocID    *string `json:"doc_id,omitempty"`',
    '\tURL      *string `json:"url,omitempty"`',
    '\tFilename string  `json:"filename"`',
    '\tMIME     string  `json:"mime"`',
    "}",
    "",
    "type ImageStill struct {",
    '\tDocID    *string `json:"doc_id,omitempty"`',
    '\tURL      *string `json:"url,omitempty"`',
    '\tFilename string  `json:"filename"`',
    '\tMIME     string  `json:"mime"`',
    "}",
    "",
    "type FileInput = Document",
    "",
    "type QuoteStringT = string",
    "type QuoteSpanT = QuoteSpan",
    "",
    "type TextQuoteLoose struct {",
    '\tText  string `json:"text"`',
    '\tQuote string `json:"quote"`',
    "}",
    "",
    "type TextQuoteT = TextQuoteLoose",
    "",
  ].join("\n");
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const aliases = stripBuiltinTypeAliases(typeAliases);
  const aliasesBlock = aliases.length
    ? `\n// --- project type aliases ---\n${aliases.map((a) => typeAliasToGo(a, exportModels)).join("\n")}\n`
    : "";
  const user = exportModels.map((m) => modelToGo(m, exportModels)).join("\n\n");
  return `${header}${aliasesBlock}\n${user}\n`;
}

function typeExprToAliasDefinitionBaml(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case TypeExprKind.Quote:
      return "string";
    case TypeExprKind.TextQuote:
      return "TextQuote";
    default:
      return typeExprToBaml(expr, models);
  }
}

export function typeAliasToBaml(alias: TypeAlias, models: StructureModel[]): string {
  const id = typeAliasExportNameRust(alias.name);
  const body = typeExprToAliasDefinitionBaml(alias.expr, models);
  const note = alias.description?.trim();
  return note ? `// ${note}\ntype ${id} = ${body}` : `type ${id} = ${body}`;
}

function bamlFieldIdent(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "field";
  let ident = trimmed.replace(/[^\w]+/g, "_").replace(/^(\d)/, "_$1");
  if (!/^[A-Za-z_]/.test(ident)) ident = `_${ident}`;
  return ident;
}

function bamlNeedsParensForField(expr: TypeExpr): boolean {
  return expr.kind === TypeExprKind.Union || expr.kind === TypeExprKind.Map;
}

function fieldToBaml(
  field: { name: string; optional: boolean; description?: string },
  models: StructureModel[],
  expr: TypeExpr,
): string {
  let t = typeExprToBaml(expr, models);
  if (field.optional && expr.kind !== TypeExprKind.Optional) {
    t = `${bamlNeedsParensForField(expr) ? `(${t})` : t}?`;
  }
  const ident = bamlFieldIdent(field.name);
  const desc = field.description?.trim();
  const attrs = desc ? ` @description(${JSON.stringify(desc)})` : "";
  return `  ${ident} ${t}${attrs}`;
}

function modelToBaml(model: StructureModel, models: StructureModel[]): string {
  const id = modelExportIdentifierRust(model.name);
  const doc = model.description?.trim() ? `// ${model.description.trim()}\n` : "";
  const fields = model.fields
    .filter((f) => f.name.trim())
    .map((f) => fieldToBaml(f, models, fieldToTypeExpr(f)));
  const body = fields.length ? fields.join("\n") : "  // empty";
  return `${doc}class ${id} {\n${body}\n}`;
}

// AI : BAML classes + aliases — https://github.com/boundaryml/baml
export function allModelsToBaml(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): string {
  const header = [
    "// Generated BAML types — https://github.com/boundaryml/baml",
    "// datetime / json / set / tuple map to string or list (BAML limitations).",
    "",
    "class QuoteSpan {",
    '  doc_id string @description("Source document hash")',
    '  start int @description("Start offset in the source")',
    '  end int @description("End offset in the source")',
    "}",
    "",
    "class TextQuote {",
    "  text string",
    "  quote QuoteSpan",
    "}",
    "",
    "class Document {",
    '  content string? @description("Extracted text — None until Convert to text instantiates it")',
    '  filename string @description("Original upload filename")',
    "}",
    "",
    "class FileInput {",
    "  content string",
    "  filename string",
    "}",
    "",
    "type Quote = QuoteSpan",
    "type quote_string_t = string",
    "type quote_span_t = QuoteSpan",
    "type text_quote_t = TextQuote",
    "",
  ].join("\n");
  const userModels = stripSharedModels(models);
  const exportModels = modelsForPydanticExport(userModels);
  const aliases = stripBuiltinTypeAliases(typeAliases);
  const aliasesBlock = aliases.length
    ? `\n// --- project type aliases ---\n${aliases.map((a) => typeAliasToBaml(a, exportModels)).join("\n")}\n`
    : "";
  const user = exportModels.map((m) => modelToBaml(m, exportModels)).join("\n\n");
  return `${header}${aliasesBlock}\n${user}\n`;
}

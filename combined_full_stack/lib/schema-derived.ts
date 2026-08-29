// AI : Zod + LLM field prompts from the same StructureModel that prints schema.sql / models.py.
import { stripSharedModels } from "@/lib/server/builtin_models"
import { modelHasQuoteFields } from "@/lib/server/quote_schema"
import {
  fieldToTypeExpr,
  formatTypeExpr,
  PrimName,
  TypeExprKind,
  type TypeExpr,
} from "@/lib/server/type_expr"
import { modelExportIdentifier, modelsForPydanticExport } from "@/lib/structure-shape"
import type { ModelField, StructureModel } from "@/lib/types"

function fieldExamples(f: ModelField): string[] {
  return (f.examples ?? []).map((e) => e.trim()).filter(Boolean)
}

function fieldNegatives(f: ModelField): string[] {
  return (f.negativeExamples ?? []).map((e) => e.trim()).filter(Boolean)
}

function authoringTypeLabel(f: ModelField, models: StructureModel[]): string {
  const t = formatTypeExpr(fieldToTypeExpr(f), models)
  if (t === "text_quote_t") return "tuple[text,quote]"
  if (t === "list[text_quote_t]") return "list[tuple[text,quote]]"
  return t
}

function modelName(models: StructureModel[], id: string): string | undefined {
  return models.find((m) => m.id === id)?.name
}

function typeExprToZodSrc(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case TypeExprKind.Prim:
      switch (expr.name) {
        case PrimName.Int:
          return "z.number().int()"
        case PrimName.Float:
          return "z.number()"
        case PrimName.Bool:
          return "z.boolean()"
        default:
          return "z.string()"
      }
    case TypeExprKind.Document:
      return "Document"
    case TypeExprKind.Quote:
      return "QuoteSpan"
    case TypeExprKind.TextQuote:
      return "TextQuote"
    case TypeExprKind.List:
      return `z.array(${typeExprToZodSrc(expr.item, models)})`
    case TypeExprKind.Ref: {
      const name = modelName(models, expr.modelId)
      const ident = name ? modelExportIdentifier(name) : "z.unknown()"
      return name ? `z.lazy(() => ${ident})` : ident
    }
    case TypeExprKind.Optional:
      return `${typeExprToZodSrc(expr.inner, models)}.optional()`
    case TypeExprKind.Set:
      return `z.array(${typeExprToZodSrc(expr.item, models)})`
    case TypeExprKind.Map:
      return `z.record(${typeExprToZodSrc(expr.key, models)}, ${typeExprToZodSrc(expr.value, models)})`
    case TypeExprKind.Union: {
      const parts = expr.variants.map((v) => typeExprToZodSrc(v, models))
      return parts.length >= 2 ? `z.union([${parts.join(", ")}])` : (parts[0] ?? "z.unknown()")
    }
    case TypeExprKind.Generic:
      if (expr.name === "tuple") {
        return `z.tuple([${expr.args.map((a) => typeExprToZodSrc(a, models)).join(", ")}])`
      }
      return "z.unknown()"
    case TypeExprKind.Named:
      return modelExportIdentifier(expr.name)
    case TypeExprKind.File:
      return "Document"
    default:
      return "z.unknown()"
  }
}

function fieldZodSrc(f: ModelField, models: StructureModel[]): string {
  let src = typeExprToZodSrc(fieldToTypeExpr(f), models)
  const desc = f.description.trim()
  const examples = fieldExamples(f)
  const negatives = fieldNegatives(f)
  const parts: string[] = []
  if (desc) parts.push(desc)
  if (examples.length) parts.push(`Examples: ${examples.map((e) => JSON.stringify(e)).join(", ")}`)
  if (negatives.length) parts.push(`Do NOT use: ${negatives.map((e) => JSON.stringify(e)).join(", ")}`)
  if (parts.length) src += `.describe(${JSON.stringify(parts.join(" — "))})`
  if (f.optional && fieldToTypeExpr(f).kind !== TypeExprKind.Optional) src += ".optional()"
  return src
}

function modelToZodSrc(model: StructureModel, models: StructureModel[]): string {
  const ident = modelExportIdentifier(model.name)
  const fields = model.fields
    .filter((f) => f.name.trim())
    .map((f) => `  ${JSON.stringify(f.name)}: ${fieldZodSrc(f, models)},`)
  return `export const ${ident} = z.object({\n${fields.join("\n")}\n})`
}

export function allModelsToZodSrc(models: StructureModel[]): string {
  const header = [
    "import { z } from \"zod\"",
    "",
    "// generated from structures — runtime Zod is the same graph (lib/server/type_expr).",
    "export const QuoteSpan = z.object({ doc_id: z.string(), start: z.number().int(), end: z.number().int() })",
    "export const TextQuote = z.object({ text: z.string(), quote: QuoteSpan })",
    "export const Document = z.object({ content: z.string().nullable(), filename: z.string() })",
    "",
  ].join("\n")
  const exportModels = modelsForPydanticExport(stripSharedModels(models)).filter((m) =>
    m.fields.some((f) => f.name.trim()),
  )
  if (!exportModels.length) return `${header}// (no user structures)\n`
  return `${header}${exportModels.map((m) => modelToZodSrc(m, models)).join("\n\n")}\n`
}

export function structureExtractionPrompt(model: StructureModel, models: StructureModel[]): string {
  const lines = model.fields
    .filter((f) => f.name.trim())
    .map((f) => {
      const t = authoringTypeLabel(f, models)
      const opt = f.optional ? "optional" : "required"
      let line = `- ${f.name} (${t}, ${opt})`
      const desc = f.description.trim()
      if (desc) line += `: ${desc}`
      const examples = fieldExamples(f)
      if (examples.length) line += ` Examples: ${examples.map((e) => JSON.stringify(e)).join(", ")}`
      const negatives = fieldNegatives(f)
      if (negatives.length) line += ` Do not use: ${negatives.map((e) => JSON.stringify(e)).join(", ")}`
      return line
    })
  const title = model.description.trim()
    ? `Extract JSON for ${model.name} — ${model.description.trim()}.`
    : `Extract JSON for ${model.name}.`
  const quoteNote = modelHasQuoteFields(model, models)
    ? "\nCopied spans must be tuple[text,quote] so Link Quotes can attach offsets across every uploaded file."
    : ""
  return `${title} Fields:\n${lines.join("\n") || "- (no fields)"}${quoteNote}`
}

export function withStructurePrompt(
  userPrompt: string | undefined,
  model: StructureModel,
  models: StructureModel[],
): string {
  const derived = structureExtractionPrompt(model, models)
  const written = userPrompt?.trim()
  return written ? `${written}\n\n${derived}` : derived
}

export function allModelsToPromptsMd(models: StructureModel[]): string {
  const exportModels = modelsForPydanticExport(stripSharedModels(models)).filter((m) =>
    m.fields.some((f) => f.name.trim()),
  )
  const header = [
    "# Derived LLM prompts",
    "",
    "Generated from structures. Runtime appends these to llm / llm-batch / parallel calls.",
    "Leave step prompts empty unless you need extra task instructions.",
    "",
  ].join("\n")
  if (!exportModels.length) return `${header}(no user structures)\n`
  const blocks = exportModels.map((m) => `## ${m.name}\n\n${structureExtractionPrompt(m, models)}`)
  return `${header}${blocks.join("\n\n")}\n`
}

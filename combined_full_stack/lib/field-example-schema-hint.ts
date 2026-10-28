import { withSharedModels } from "@/lib/server/builtin_models";
import { withBuiltinTypeAliases } from "@/lib/server/builtin_types";
import {
  expandNamedTypeExpr,
  fieldToTypeExpr,
  PrimName,
  TypeExprKind,
  type TypeExpr,
} from "@/lib/server/type_expr";
import { formatTypeExprPy } from "@/lib/type-expr-parse";
import type { ModelField, StructureModel, StructureModelId, TypeAlias } from "@/lib/types";

type HintOpts = {
  models: StructureModel[];
  typeAliases: TypeAlias[];
  seenModels: Set<StructureModelId>;
};

export type FieldExampleSchemaHint = {
  typeStr: string;
  exampleStr: string;
  entryNote: string;
};

export type FieldExampleSchemaContext = {
  expr: TypeExpr;
  templateValue: unknown;
};

function pad(indent: number): string {
  return "  ".repeat(indent);
}

function modelNameFor(modelId: StructureModelId, models: StructureModel[]): string {
  return models.find((m) => m.id === modelId)?.name ?? "Model";
}

function exampleLines(expr: TypeExpr, opts: HintOpts, indent: number): string[] {
  const sp = pad(indent);
  switch (expr.kind) {
    case TypeExprKind.Prim:
      switch (expr.name) {
        case PrimName.Text:
          return [`${sp}"string"`];
        case PrimName.Int:
          return [`${sp}999  // int`];
        case PrimName.Float:
          return [`${sp}9.99  // float`];
        case PrimName.Bool:
          return [`${sp}true  // bool`];
        case PrimName.Datetime:
          return [`${sp}"2024-01-01T00:00:00Z"  // datetime`];
        case PrimName.Json:
          return [`${sp}"{\\"key\\": \\"string\\"}"  // json`];
        default:
          return [`${sp}?`];
      }
    case TypeExprKind.Document:
      return objectLines(
        [
          { name: "content", expr: { kind: TypeExprKind.Prim, name: PrimName.Text } },
          { name: "filename", expr: { kind: TypeExprKind.Prim, name: PrimName.Text } },
        ],
        opts,
        indent,
      );
    case TypeExprKind.Quote:
      return objectLines(
        [
          { name: "doc_id", expr: { kind: TypeExprKind.Prim, name: PrimName.Text } },
          { name: "start", expr: { kind: TypeExprKind.Prim, name: PrimName.Int } },
          { name: "end", expr: { kind: TypeExprKind.Prim, name: PrimName.Int } },
        ],
        opts,
        indent,
      );
    case TypeExprKind.TextQuote:
      return objectLines(
        [
          { name: PrimName.Text, expr: { kind: TypeExprKind.Prim, name: PrimName.Text } },
          { name: "quote", expr: { kind: TypeExprKind.Quote } },
        ],
        opts,
        indent,
      );
    case TypeExprKind.List:
    case TypeExprKind.Set: {
      const itemLines = exampleLines(expr.item, opts, indent + 1);
      return [`${sp}[`, ...itemLines, `${sp}]`];
    }
    case TypeExprKind.Map: {
      const valueLines = exampleLines(expr.value, opts, indent + 1);
      const keySample = expr.key.kind === TypeExprKind.Prim && expr.key.name === PrimName.Text ? "string" : "key";
      if (valueLines.length === 1) {
        return [`${sp}{`, `${pad(indent + 1)}"${keySample}": ${valueLines[0]!.trim()},`, `${sp}}`];
      }
      return [`${sp}{`, `${pad(indent + 1)}"${keySample}": ${valueLines[0]!.trim()}`, ...valueLines.slice(1), `${sp}}`];
    }
    case TypeExprKind.Optional:
      return exampleLines(expr.inner, opts, indent);
    case TypeExprKind.Ref: {
      if (opts.seenModels.has(expr.modelId)) {
        return [`${sp}{ ... }  // ${modelNameFor(expr.modelId, opts.models)}`];
      }
      const model = opts.models.find((m) => m.id === expr.modelId);
      if (!model) return [`${sp}{ ... }`];
      opts.seenModels.add(expr.modelId);
      const fields = model.fields
        .filter((f) => f.name.trim())
        .map((f) => ({ name: f.name, expr: fieldToTypeExpr(f) }));
      return objectLines(fields, opts, indent);
    }
    case TypeExprKind.Union:
      return expr.variants.flatMap((variant, i) => {
        const lines = exampleLines(variant, opts, indent);
        return i === 0 ? lines : [`${sp}// or`, ...lines];
      });
    case TypeExprKind.Generic:
      if (expr.name === "tuple" && expr.args.length >= 2) {
        const parts = expr.args.map((arg) => exampleLines(arg, opts, 0).join(" ").trim());
        return [`${sp}(${parts.join(", ")})`];
      }
      if (expr.args.length === 1) return exampleLines(expr.args[0]!, opts, indent);
      return [`${sp}?`];
    case TypeExprKind.Named:
      return [`${sp}${expr.name}`];
    case TypeExprKind.Unset:
      return [`${sp}?  // complete the field type first`];
    case TypeExprKind.Unknown:
      return [`${sp}?`];
    default:
      return [`${sp}?`];
  }
}

function objectLines(
  fields: { name: string; expr: TypeExpr }[],
  opts: HintOpts,
  indent: number,
): string[] {
  const sp = pad(indent);
  const lines = [`${sp}{`];
  for (const field of fields) {
    const valueLines = exampleLines(field.expr, opts, indent + 1);
    if (valueLines.length === 1) {
      lines.push(`${pad(indent + 1)}"${field.name}": ${valueLines[0]!.trim()},`);
      continue;
    }
    lines.push(`${pad(indent + 1)}"${field.name}": ${valueLines[0]!.trim()}`);
    lines.push(...valueLines.slice(1, -1));
    const last = valueLines[valueLines.length - 1]!;
    lines.push(`${last},`);
  }
  lines.push(`${sp}}`);
  return lines;
}

export function fieldExampleUsesJsonEntry(expr: TypeExpr): boolean {
  switch (expr.kind) {
    case TypeExprKind.List:
    case TypeExprKind.Set:
    case TypeExprKind.Map:
    case TypeExprKind.Ref:
    case TypeExprKind.Document:
    case TypeExprKind.Quote:
    case TypeExprKind.TextQuote:
    case TypeExprKind.Generic:
      return true;
    case TypeExprKind.Optional:
      return fieldExampleUsesJsonEntry(expr.inner);
    case TypeExprKind.Union:
      return expr.variants.some((variant) => fieldExampleUsesJsonEntry(variant));
    default:
      return false;
  }
}

export function exampleTemplateValue(expr: TypeExpr, opts: HintOpts): unknown {
  switch (expr.kind) {
    case TypeExprKind.Prim:
      switch (expr.name) {
        case PrimName.Text:
          return "string";
        case PrimName.Int:
          return 999;
        case PrimName.Float:
          return 9.99;
        case PrimName.Bool:
          return true;
        case PrimName.Datetime:
          return "2024-01-01T00:00:00Z";
        case PrimName.Json:
          return '{"key": "string"}';
        default:
          return null;
      }
    case TypeExprKind.Document:
      return {
        content: "string",
        filename: "string",
      };
    case TypeExprKind.Quote:
      return {
        doc_id: "string",
        start: 999,
        end: 999,
      };
    case TypeExprKind.TextQuote:
      return {
        text: "string",
        quote: exampleTemplateValue({ kind: TypeExprKind.Quote }, opts),
      };
    case TypeExprKind.List:
    case TypeExprKind.Set:
      return [exampleTemplateValue(expr.item, opts)];
    case TypeExprKind.Map: {
      const keySample = expr.key.kind === TypeExprKind.Prim && expr.key.name === PrimName.Text ? "string" : "key";
      return { [keySample]: exampleTemplateValue(expr.value, opts) };
    }
    case TypeExprKind.Optional:
      return exampleTemplateValue(expr.inner, opts);
    case TypeExprKind.Ref: {
      if (opts.seenModels.has(expr.modelId)) {
        return { "…": "…" };
      }
      const model = opts.models.find((m) => m.id === expr.modelId);
      if (!model) return {};
      opts.seenModels.add(expr.modelId);
      const out: Record<string, unknown> = {};
      for (const field of model.fields.filter((f) => f.name.trim())) {
        out[field.name] = exampleTemplateValue(fieldToTypeExpr(field), opts);
      }
      return out;
    }
    case TypeExprKind.Union:
      return exampleTemplateValue(expr.variants[0]!, opts);
    case TypeExprKind.Generic:
      if (expr.name === "tuple" && expr.args.length >= 2) {
        return expr.args.map((arg) => exampleTemplateValue(arg, opts));
      }
      if (expr.args.length === 1) return exampleTemplateValue(expr.args[0]!, opts);
      return null;
    case TypeExprKind.Named:
      return expr.name;
    default:
      return null;
  }
}

function entryNoteFor(expr: TypeExpr): string {
  switch (expr.kind) {
    case TypeExprKind.Prim:
      if (expr.name === PrimName.Json) return "Enter a JSON string — the field stores serialized JSON.";
      if (expr.name === PrimName.Int || expr.name === PrimName.Float || expr.name === PrimName.Bool) {
        return "Enter the literal value shown above.";
      }
      return "Enter the string value shown above.";
    case TypeExprKind.List:
    case TypeExprKind.Set:
    case TypeExprKind.Map:
    case TypeExprKind.Ref:
    case TypeExprKind.Document:
    case TypeExprKind.Quote:
    case TypeExprKind.TextQuote:
    case TypeExprKind.Generic:
      return "Enter JSON matching the shape above.";
    case TypeExprKind.Optional:
      return entryNoteFor(expr.inner);
    case TypeExprKind.Union:
      return "Enter JSON matching one of the shapes above.";
    case TypeExprKind.Unset:
      return "Complete the field type before adding examples.";
    default:
      return "Values must match the field type.";
  }
}

export function fieldExampleSchemaContext(
  field: ModelField,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): FieldExampleSchemaContext {
  const mergedModels = withSharedModels(models);
  const mergedAliases = withBuiltinTypeAliases(typeAliases);
  const expr = expandNamedTypeExpr(fieldToTypeExpr(field), mergedAliases);
  const hintOpts: HintOpts = { models: mergedModels, typeAliases: mergedAliases, seenModels: new Set() };
  return {
    expr,
    templateValue: exampleTemplateValue(expr, hintOpts),
  };
}

export function fieldExampleSchemaHint(
  field: ModelField,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): FieldExampleSchemaHint {
  const mergedModels = withSharedModels(models);
  const mergedAliases = withBuiltinTypeAliases(typeAliases);
  const expr = expandNamedTypeExpr(fieldToTypeExpr(field), mergedAliases);
  const typeStr = formatTypeExprPy(expr, mergedModels);
  const exampleStr = exampleLines(expr, { models: mergedModels, typeAliases: mergedAliases, seenModels: new Set() }, 0).join(
    "\n",
  );
  return {
    typeStr,
    exampleStr,
    entryNote: entryNoteFor(expr),
  };
}

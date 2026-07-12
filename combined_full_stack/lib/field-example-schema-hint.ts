import { withSharedModels } from "@/lib/server/builtin_models";
import { withBuiltinTypeAliases } from "@/lib/server/builtin_types";
import { expandNamedTypeExpr, fieldToTypeExpr, type TypeExpr } from "@/lib/server/type_expr";
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
    case "prim":
      switch (expr.name) {
        case "text":
          return [`${sp}"string"`];
        case "int":
          return [`${sp}999  // int`];
        case "float":
          return [`${sp}9.99  // float`];
        case "bool":
          return [`${sp}true  // bool`];
        case "datetime":
          return [`${sp}"2024-01-01T00:00:00Z"  // datetime`];
        case "json":
          return [`${sp}"{\\"key\\": \\"string\\"}"  // json`];
        default:
          return [`${sp}?`];
      }
    case "document":
      return objectLines(
        [
          { name: "content", expr: { kind: "prim", name: "text" } },
          { name: "filename", expr: { kind: "prim", name: "text" } },
        ],
        opts,
        indent,
      );
    case "quote":
      return objectLines(
        [
          { name: "doc_id", expr: { kind: "prim", name: "text" } },
          { name: "start", expr: { kind: "prim", name: "int" } },
          { name: "end", expr: { kind: "prim", name: "int" } },
        ],
        opts,
        indent,
      );
    case "text_quote":
      return objectLines(
        [
          { name: "text", expr: { kind: "prim", name: "text" } },
          { name: "quote", expr: { kind: "quote" } },
        ],
        opts,
        indent,
      );
    case "list":
    case "set": {
      const itemLines = exampleLines(expr.item, opts, indent + 1);
      return [`${sp}[`, ...itemLines, `${sp}]`];
    }
    case "map": {
      const valueLines = exampleLines(expr.value, opts, indent + 1);
      const keySample = expr.key.kind === "prim" && expr.key.name === "text" ? "string" : "key";
      if (valueLines.length === 1) {
        return [`${sp}{`, `${pad(indent + 1)}"${keySample}": ${valueLines[0]!.trim()},`, `${sp}}`];
      }
      return [`${sp}{`, `${pad(indent + 1)}"${keySample}": ${valueLines[0]!.trim()}`, ...valueLines.slice(1), `${sp}}`];
    }
    case "optional":
      return exampleLines(expr.inner, opts, indent);
    case "ref": {
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
    case "union":
      return expr.variants.flatMap((variant, i) => {
        const lines = exampleLines(variant, opts, indent);
        return i === 0 ? lines : [`${sp}// or`, ...lines];
      });
    case "generic":
      if (expr.name === "tuple" && expr.args.length >= 2) {
        const parts = expr.args.map((arg) => exampleLines(arg, opts, 0).join(" ").trim());
        return [`${sp}(${parts.join(", ")})`];
      }
      if (expr.args.length === 1) return exampleLines(expr.args[0]!, opts, indent);
      return [`${sp}?`];
    case "named":
      return [`${sp}${expr.name}`];
    case "unset":
      return [`${sp}?  // complete the field type first`];
    case "unknown":
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
    case "list":
    case "set":
    case "map":
    case "ref":
    case "document":
    case "quote":
    case "text_quote":
    case "generic":
      return true;
    case "optional":
      return fieldExampleUsesJsonEntry(expr.inner);
    case "union":
      return expr.variants.some((variant) => fieldExampleUsesJsonEntry(variant));
    default:
      return false;
  }
}

export function exampleTemplateValue(expr: TypeExpr, opts: HintOpts): unknown {
  switch (expr.kind) {
    case "prim":
      switch (expr.name) {
        case "text":
          return "string";
        case "int":
          return 999;
        case "float":
          return 9.99;
        case "bool":
          return true;
        case "datetime":
          return "2024-01-01T00:00:00Z";
        case "json":
          return '{"key": "string"}';
        default:
          return null;
      }
    case "document":
      return {
        content: "string",
        filename: "string",
      };
    case "quote":
      return {
        doc_id: "string",
        start: 999,
        end: 999,
      };
    case "text_quote":
      return {
        text: "string",
        quote: exampleTemplateValue({ kind: "quote" }, opts),
      };
    case "list":
    case "set":
      return [exampleTemplateValue(expr.item, opts)];
    case "map": {
      const keySample = expr.key.kind === "prim" && expr.key.name === "text" ? "string" : "key";
      return { [keySample]: exampleTemplateValue(expr.value, opts) };
    }
    case "optional":
      return exampleTemplateValue(expr.inner, opts);
    case "ref": {
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
    case "union":
      return exampleTemplateValue(expr.variants[0]!, opts);
    case "generic":
      if (expr.name === "tuple" && expr.args.length >= 2) {
        return expr.args.map((arg) => exampleTemplateValue(arg, opts));
      }
      if (expr.args.length === 1) return exampleTemplateValue(expr.args[0]!, opts);
      return null;
    case "named":
      return expr.name;
    default:
      return null;
  }
}

function entryNoteFor(expr: TypeExpr): string {
  switch (expr.kind) {
    case "prim":
      if (expr.name === "json") return "Enter a JSON string — the field stores serialized JSON.";
      if (expr.name === "int" || expr.name === "float" || expr.name === "bool") {
        return "Enter the literal value shown above.";
      }
      return "Enter the string value shown above.";
    case "list":
    case "set":
    case "map":
    case "ref":
    case "document":
    case "quote":
    case "text_quote":
    case "generic":
      return "Enter JSON matching the shape above.";
    case "optional":
      return entryNoteFor(expr.inner);
    case "union":
      return "Enter JSON matching one of the shapes above.";
    case "unset":
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

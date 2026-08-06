import { z, type ZodType } from "zod";
import { tryParseJson } from "@/lib/json-utils";
import { analyzePartialJson, formatJsonErrorAt } from "@/lib/field-example-json-completion";
import { fieldExampleUsesJsonEntry } from "@/lib/field-example-schema-hint";
import { withSharedModels } from "./builtin_models";
import { withBuiltinTypeAliases } from "./builtin_types";
import {
  applyFieldCardinalityConstraints,
  fieldToTypeExpr,
  normalizeModelField,
  typeExprToZod,
  withFieldMeta,
  type TypeExpr,
} from "./type_expr";
import type { ModelField, StructureModel, TypeAlias } from "./types";

export type FieldExampleValidation = {
  ok: boolean;
  error?: string;
  errorIndex?: number;
};

function coerceFieldExampleValue(example: string, expr: TypeExpr): unknown {
  const trimmed = example.trim();
  if (expr.kind === "prim") {
    if (expr.name === "text" || expr.name === "datetime" || expr.name === "json") return example;
    if (expr.name === "int") {
      const parsed = tryParseJson(trimmed);
      if (parsed.ok && typeof parsed.value === "number" && Number.isInteger(parsed.value)) {
        return parsed.value;
      }
      const n = Number(trimmed);
      if (Number.isInteger(n) && trimmed.length > 0) return n;
      return trimmed;
    }
    if (expr.name === "float") {
      const parsed = tryParseJson(trimmed);
      if (parsed.ok && typeof parsed.value === "number") return parsed.value;
      const n = Number(trimmed);
      if (Number.isFinite(n) && trimmed.length > 0) return n;
      return trimmed;
    }
    if (expr.name === "bool") {
      const parsed = tryParseJson(trimmed);
      if (parsed.ok && typeof parsed.value === "boolean") return parsed.value;
      if (trimmed === "true") return true;
      if (trimmed === "false") return false;
      return trimmed;
    }
  }
  const parsed = tryParseJson(trimmed);
  return parsed.ok ? parsed.value : trimmed;
}

function formatZodIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "does not match field type";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export function fieldExampleJsonSchema(
  field: ModelField,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): Record<string, unknown> | null {
  const expr = fieldToTypeExpr(field);
  if (expr.kind === "unset") return null;
  const schema = zodSchemaForFieldExample(field, models, typeAliases);
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

export function zodSchemaForFieldExample(
  field: ModelField,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): ZodType {
  const mergedModels = withSharedModels(models);
  const mergedAliases = withBuiltinTypeAliases(typeAliases);
  const f = normalizeModelField(field);
  let schema = withFieldMeta(
    typeExprToZod(fieldToTypeExpr(f), mergedModels, {
      typeAliases: mergedAliases,
      seenAliasNames: new Set(),
    }),
    f,
  );
  if (f.optional) schema = schema.nullish();
  schema = applyFieldCardinalityConstraints(schema, f);
  return schema;
}

export function validateFieldExampleString(
  example: string,
  field: ModelField,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): FieldExampleValidation {
  if (!example.trim()) return { ok: true };
  const schema = zodSchemaForFieldExample(field, models, typeAliases);
  const expr = fieldToTypeExpr(field);
  if (expr.kind === "unset") {
    return { ok: false, error: "complete the field type before adding examples" };
  }
  const result = schema.safeParse(coerceFieldExampleValue(example, expr));
  return result.success ? { ok: true } : { ok: false, error: formatZodIssue(result.error) };
}

// AI : while typing JSON, only error once the prefix can no longer complete to valid JSON
export function validateFieldExampleStringDraft(
  example: string,
  field: ModelField,
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): FieldExampleValidation {
  if (!example.trim()) return { ok: true };

  const expr = fieldToTypeExpr(field);
  if (expr.kind === "unset") {
    return { ok: false, error: "complete the field type before adding examples" };
  }

  if (fieldExampleUsesJsonEntry(expr)) {
    const analysis = analyzePartialJson(example);
    if (analysis.status === "invalid") {
      const message = analysis.error ?? "invalid JSON";
      return {
        ok: false,
        error: formatJsonErrorAt(example, analysis.errorIndex, message),
        errorIndex: analysis.errorIndex,
      };
    }
    if (analysis.status === "empty" || analysis.status === "prefix") {
      return { ok: true };
    }
    return validateFieldExampleString(example, field, models, typeAliases);
  }

  return { ok: true };
}

function validateNegativeExampleSyntax(
  example: string,
  expr: TypeExpr,
): FieldExampleValidation {
  if (!fieldExampleUsesJsonEntry(expr)) return { ok: true };
  const parsed = tryParseJson(example.trim());
  return parsed.ok ? { ok: true } : { ok: false, error: "must be valid JSON" };
}

// AI : counterexamples — syntax only; they intentionally need not match the field type
export function validateNegativeFieldExampleString(
  example: string,
  field: ModelField,
  _models: StructureModel[] = [],
  _typeAliases: TypeAlias[] = [],
): FieldExampleValidation {
  if (!example.trim()) return { ok: true };
  const expr = fieldToTypeExpr(field);
  if (expr.kind === "unset") {
    return { ok: false, error: "complete the field type before adding examples" };
  }
  return validateNegativeExampleSyntax(example, expr);
}

export function validateNegativeFieldExampleStringDraft(
  example: string,
  field: ModelField,
  models: StructureModel[] = [],
  typeAliases: TypeAlias[] = [],
): FieldExampleValidation {
  if (!example.trim()) return { ok: true };

  const expr = fieldToTypeExpr(field);
  if (expr.kind === "unset") {
    return { ok: false, error: "complete the field type before adding examples" };
  }

  if (fieldExampleUsesJsonEntry(expr)) {
    const analysis = analyzePartialJson(example);
    if (analysis.status === "invalid") {
      const message = analysis.error ?? "invalid JSON";
      return {
        ok: false,
        error: formatJsonErrorAt(example, analysis.errorIndex, message),
        errorIndex: analysis.errorIndex,
      };
    }
    if (analysis.status === "empty" || analysis.status === "prefix") {
      return { ok: true };
    }
    return validateNegativeFieldExampleString(example, field, models, typeAliases);
  }

  return { ok: true };
}

// AI : structure field integrity — empty names, dangling refs, duplicate names within a model.
import {
  collectTypeExprRefModelIds,
  fieldToTypeExpr,
  normalizeModelField,
  TypeExprKind,
  type TypeExpr,
} from "@/lib/server/type_expr";
import {
  validateFieldExampleString,
  validateNegativeFieldExampleString,
} from "@/lib/server/field_example_validity";
import { withSharedModels } from "@/lib/structure";
import { isBuiltinTypeAliasName, stripBuiltinTypeAliases, withBuiltinTypeAliases } from "@/lib/server/builtin_types";
import type { ModelField, StructureModel, StructureModelId, TypeAlias } from "@/lib/types";

export const StructureIssueKind = {
  EmptyFieldName: "empty-field-name",
  DuplicateFieldName: "duplicate-field-name",
  DanglingFieldRef: "dangling-field-ref",
  UnknownTypeAlias: "unknown-type-alias",
  EmptyAliasName: "empty-alias-name",
  DuplicateAliasName: "duplicate-alias-name",
  IncompleteTypeExpr: "incomplete-type-expr",
  InvalidFieldExample: "invalid-field-example",
} as const;

export type StructureIssueKind = (typeof StructureIssueKind)[keyof typeof StructureIssueKind];

export type StructureIssue = {
  modelId: StructureModelId;
  kind: StructureIssueKind;
  fieldId?: string;
  fieldName?: string;
  refId?: StructureModelId;
  aliasName?: string;
  exampleIndex?: number;
  negativeExample?: boolean;
  exampleError?: string;
};

function fieldRefIds(field: ModelField): StructureModelId[] {
  const ids = new Set<StructureModelId>();
  if (field.ref) ids.add(field.ref);
  for (const id of collectTypeExprRefModelIds(fieldToTypeExpr(field))) ids.add(id);
  return [...ids];
}

function collectNamedTypeExprs(expr: TypeExpr, out: Set<string>, seen = new Set<string>()): void {
  switch (expr.kind) {
    case TypeExprKind.Named:
      if (!seen.has(expr.name.toLowerCase())) {
        seen.add(expr.name.toLowerCase());
        out.add(expr.name);
      }
      break;
    case TypeExprKind.List:
    case TypeExprKind.Set:
      collectNamedTypeExprs(expr.item, out, seen);
      break;
    case TypeExprKind.Optional:
      collectNamedTypeExprs(expr.inner, out, seen);
      break;
    case TypeExprKind.Map:
      collectNamedTypeExprs(expr.key, out, seen);
      collectNamedTypeExprs(expr.value, out, seen);
      break;
    case TypeExprKind.Union:
      expr.variants.forEach((v) => collectNamedTypeExprs(v, out, seen));
      break;
    case TypeExprKind.Generic:
      expr.args.forEach((a) => collectNamedTypeExprs(a, out, seen));
      break;
    default:
      break;
  }
}

function unknownNamedTypes(expr: TypeExpr, typeAliases: TypeAlias[]): string[] {
  const names = new Set<string>();
  collectNamedTypeExprs(expr, names);
  const aliasNames = new Set(typeAliases.map((t) => t.name.trim().toLowerCase()));
  return [...names].filter((n) => !aliasNames.has(n.trim().toLowerCase()));
}

function aliasByName(typeAliases: TypeAlias[]): Map<string, TypeAlias> {
  const byName = new Map<string, TypeAlias>();
  for (const alias of typeAliases) {
    const key = alias.name.trim().toLowerCase();
    if (key) byName.set(key, alias);
  }
  return byName;
}

// AI : named refs don't embed UNSET — follow alias definitions (cycle-safe).
function typeExprHasUnsetOrAliasUnset(
  expr: TypeExpr,
  typeAliases: TypeAlias[],
  seenAliases = new Set<string>(),
): boolean {
  if (expr.kind === TypeExprKind.Unset) return true;
  if (expr.kind === TypeExprKind.Named) {
    const key = expr.name.trim().toLowerCase();
    if (!key || seenAliases.has(key)) return false;
    const alias = aliasByName(typeAliases).get(key);
    if (!alias) return false;
    seenAliases.add(key);
    return typeExprHasUnsetOrAliasUnset(alias.expr, typeAliases, seenAliases);
  }
  switch (expr.kind) {
    case TypeExprKind.List:
    case TypeExprKind.Set:
      return typeExprHasUnsetOrAliasUnset(expr.item, typeAliases, seenAliases);
    case TypeExprKind.Optional:
      return typeExprHasUnsetOrAliasUnset(expr.inner, typeAliases, seenAliases);
    case TypeExprKind.Map:
      return (
        typeExprHasUnsetOrAliasUnset(expr.key, typeAliases, seenAliases) ||
        typeExprHasUnsetOrAliasUnset(expr.value, typeAliases, seenAliases)
      );
    case TypeExprKind.Union:
      return expr.variants.some((v) => typeExprHasUnsetOrAliasUnset(v, typeAliases, seenAliases));
    case TypeExprKind.Generic:
      return expr.args.some((a) => typeExprHasUnsetOrAliasUnset(a, typeAliases, seenAliases));
    default:
      return false;
  }
}

export function modelFieldExprsUseAlias(
  models: StructureModel[],
  aliasName: string,
  modelIds?: Set<StructureModelId>,
): boolean {
  const key = aliasName.trim().toLowerCase();
  if (!key) return false;
  for (const model of models) {
    if (modelIds && !modelIds.has(model.id)) continue;
    for (const field of model.fields) {
      const names = new Set<string>();
      collectNamedTypeExprs(fieldToTypeExpr(field), names);
      if ([...names].some((n) => n.trim().toLowerCase() === key)) return true;
    }
  }
  return false;
}

export function computeStructureIssues(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): StructureIssue[] {
  // AI : persisted project.typeAliases omit shared builtins — merge for resolution + validation.
  const mergedAliases = withBuiltinTypeAliases(typeAliases);
  const userAliases = stripBuiltinTypeAliases(typeAliases);
  // AI : persisted project.models omit shared Document — include it for ref resolution only.
  const byId = new Set(withSharedModels(models).map((m) => m.id));
  const issues: StructureIssue[] = [];

  for (const model of models) {
    const seenNames = new Map<string, string>();

    for (const rawField of model.fields) {
      const field = normalizeModelField(rawField);
      const name = field.name.trim();
      if (!name) {
        issues.push({ modelId: model.id, kind: StructureIssueKind.EmptyFieldName, fieldId: field.id });
        continue;
      }

      const prev = seenNames.get(name.toLowerCase());
      if (prev) {
        issues.push({
          modelId: model.id,
          kind: StructureIssueKind.DuplicateFieldName,
          fieldId: field.id,
          fieldName: name,
        });
      } else {
        seenNames.set(name.toLowerCase(), field.id);
      }

      for (const refId of fieldRefIds(field)) {
        if (!byId.has(refId)) {
          issues.push({
            modelId: model.id,
            kind: StructureIssueKind.DanglingFieldRef,
            fieldId: field.id,
            fieldName: name,
            refId,
          });
        }
      }

      const fieldExpr = fieldToTypeExpr(field);
      for (const aliasName of unknownNamedTypes(fieldExpr, mergedAliases)) {
        issues.push({
          modelId: model.id,
          kind: StructureIssueKind.UnknownTypeAlias,
          fieldId: field.id,
          fieldName: name,
          aliasName,
        });
      }
      if (typeExprHasUnsetOrAliasUnset(fieldExpr, mergedAliases)) {
        issues.push({
          modelId: model.id,
          kind: StructureIssueKind.IncompleteTypeExpr,
          fieldId: field.id,
          fieldName: name,
        });
      }

      if (!typeExprHasUnsetOrAliasUnset(fieldExpr, mergedAliases)) {
        for (const [exampleIndex, example] of (field.examples ?? []).entries()) {
          const result = validateFieldExampleString(example, field, models, typeAliases);
          if (!result.ok) {
            issues.push({
              modelId: model.id,
              kind: StructureIssueKind.InvalidFieldExample,
              fieldId: field.id,
              fieldName: name,
              exampleIndex,
              negativeExample: false,
              exampleError: result.error,
            });
          }
        }
        for (const [exampleIndex, example] of (field.negativeExamples ?? []).entries()) {
          const result = validateNegativeFieldExampleString(example, field, models, typeAliases);
          if (!result.ok) {
            issues.push({
              modelId: model.id,
              kind: StructureIssueKind.InvalidFieldExample,
              fieldId: field.id,
              fieldName: name,
              exampleIndex,
              negativeExample: true,
              exampleError: result.error,
            });
          }
        }
      }
    }
  }

  const seenAliasNames = new Map<string, string>();
  for (const alias of userAliases) {
    const name = alias.name.trim();
    if (!name) {
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: StructureIssueKind.EmptyAliasName,
        aliasName: alias.name,
      });
      continue;
    }
    if (isBuiltinTypeAliasName(name)) {
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: StructureIssueKind.DuplicateAliasName,
        aliasName: name,
      });
      continue;
    }
    const prev = seenAliasNames.get(name.toLowerCase());
    if (prev) {
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: StructureIssueKind.DuplicateAliasName,
        aliasName: name,
      });
    } else {
      seenAliasNames.set(name.toLowerCase(), alias.id);
    }
  }

  for (const alias of userAliases) {
    for (const refId of collectTypeExprRefModelIds(alias.expr)) {
      if (!byId.has(refId)) {
        issues.push({
          modelId: models[0]?.id ?? ("" as StructureModelId),
          kind: StructureIssueKind.DanglingFieldRef,
          refId,
          aliasName: alias.name,
        });
      }
    }
    for (const unknown of unknownNamedTypes(alias.expr, mergedAliases)) {
      if (unknown.toLowerCase() === alias.name.trim().toLowerCase()) continue;
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: StructureIssueKind.UnknownTypeAlias,
        aliasName: `${alias.name} → ${unknown}`,
      });
    }
    const aliasKey = alias.name.trim().toLowerCase();
    const seenAliases = aliasKey ? new Set<string>([aliasKey]) : new Set<string>();
    if (typeExprHasUnsetOrAliasUnset(alias.expr, mergedAliases, seenAliases)) {
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: StructureIssueKind.IncompleteTypeExpr,
        aliasName: alias.name,
      });
    }
  }

  return issues;
}

export function structureIssueMessage(issue: StructureIssue, models: StructureModel[]): string {
  const modelName = models.find((m) => m.id === issue.modelId)?.name ?? issue.modelId;
  switch (issue.kind) {
    case StructureIssueKind.EmptyFieldName:
      return `${modelName}: field has no name`;
    case StructureIssueKind.DuplicateFieldName:
      return `${modelName}: duplicate field name "${issue.fieldName ?? "?"}"`;
    case StructureIssueKind.DanglingFieldRef:
      if (issue.aliasName) {
        return `type alias "${issue.aliasName}" references missing structure`;
      }
      return `${modelName}.${issue.fieldName ?? "?"} references missing structure`;
    case StructureIssueKind.UnknownTypeAlias:
      if (!issue.fieldName) {
        return issue.aliasName?.includes(" → ")
          ? `type alias ${issue.aliasName}`
          : `unknown type alias "${issue.aliasName ?? "?"}"`;
      }
      return `${modelName}.${issue.fieldName} uses unknown type alias "${issue.aliasName ?? "?"}"`;
    case StructureIssueKind.EmptyAliasName:
      return "type alias has no name";
    case StructureIssueKind.DuplicateAliasName:
      return `duplicate type alias name "${issue.aliasName ?? "?"}"`;
    case StructureIssueKind.IncompleteTypeExpr:
      if (issue.aliasName) {
        return `type alias "${issue.aliasName}" has unfilled UNSET slots`;
      }
      return `${modelName}.${issue.fieldName ?? "?"} has unfilled UNSET slots in its type`;
    case StructureIssueKind.InvalidFieldExample: {
      const label = issue.negativeExample ? "negative example" : "example";
      const n = (issue.exampleIndex ?? 0) + 1;
      return `${modelName}.${issue.fieldName ?? "?"} ${label} ${n} does not match field type — ${issue.exampleError ?? "invalid value"}`;
    }
    default:
      return "structure validation error";
  }
}

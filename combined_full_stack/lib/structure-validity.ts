// AI : structure field integrity — empty names, dangling refs, duplicate names within a model.
import { fieldToTypeExpr, collectTypeExprRefModelIds, type TypeExpr } from "@/lib/server/type_expr";
import { typeExprHasUnset } from "@/lib/type-expr-edit";
import { withSharedModels } from "@/lib/structure";
import type { ModelField, StructureModel, StructureModelId, TypeAlias } from "@/lib/types";

export type StructureIssueKind =
  | "empty-field-name"
  | "duplicate-field-name"
  | "dangling-field-ref"
  | "unknown-type-alias"
  | "empty-alias-name"
  | "duplicate-alias-name"
  | "incomplete-type-expr";

export type StructureIssue = {
  modelId: StructureModelId;
  kind: StructureIssueKind;
  fieldId?: string;
  fieldName?: string;
  refId?: StructureModelId;
  aliasName?: string;
};

function fieldRefIds(field: ModelField): StructureModelId[] {
  const ids = new Set<StructureModelId>();
  if (field.ref) ids.add(field.ref);
  for (const id of collectTypeExprRefModelIds(fieldToTypeExpr(field))) ids.add(id);
  return [...ids];
}

function collectNamedTypeExprs(expr: TypeExpr, out: Set<string>, seen = new Set<string>()): void {
  switch (expr.kind) {
    case "named":
      if (!seen.has(expr.name.toLowerCase())) {
        seen.add(expr.name.toLowerCase());
        out.add(expr.name);
      }
      break;
    case "list":
    case "set":
      collectNamedTypeExprs(expr.item, out, seen);
      break;
    case "optional":
      collectNamedTypeExprs(expr.inner, out, seen);
      break;
    case "map":
      collectNamedTypeExprs(expr.key, out, seen);
      collectNamedTypeExprs(expr.value, out, seen);
      break;
    case "union":
      expr.variants.forEach((v) => collectNamedTypeExprs(v, out, seen));
      break;
    case "generic":
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

export function computeStructureIssues(
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
): StructureIssue[] {
  // AI : persisted project.models omit shared Document — include it for ref resolution only.
  const byId = new Set(withSharedModels(models).map((m) => m.id));
  const issues: StructureIssue[] = [];

  for (const model of models) {
    const seenNames = new Map<string, string>();

    for (const field of model.fields) {
      const name = field.name.trim();
      if (!name) {
        issues.push({ modelId: model.id, kind: "empty-field-name", fieldId: field.id });
        continue;
      }

      const prev = seenNames.get(name.toLowerCase());
      if (prev) {
        issues.push({
          modelId: model.id,
          kind: "duplicate-field-name",
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
            kind: "dangling-field-ref",
            fieldId: field.id,
            fieldName: name,
            refId,
          });
        }
      }

      const fieldExpr = fieldToTypeExpr(field);
      for (const aliasName of unknownNamedTypes(fieldExpr, typeAliases)) {
        issues.push({
          modelId: model.id,
          kind: "unknown-type-alias",
          fieldId: field.id,
          fieldName: name,
          aliasName,
        });
      }
      if (typeExprHasUnset(fieldExpr)) {
        issues.push({
          modelId: model.id,
          kind: "incomplete-type-expr",
          fieldId: field.id,
          fieldName: name,
        });
      }
    }
  }

  const seenAliasNames = new Map<string, string>();
  for (const alias of typeAliases) {
    const name = alias.name.trim();
    if (!name) {
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: "empty-alias-name",
        aliasName: alias.name,
      });
      continue;
    }
    const prev = seenAliasNames.get(name.toLowerCase());
    if (prev) {
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: "duplicate-alias-name",
        aliasName: name,
      });
    } else {
      seenAliasNames.set(name.toLowerCase(), alias.id);
    }
  }

  for (const alias of typeAliases) {
    for (const refId of collectTypeExprRefModelIds(alias.expr)) {
      if (!byId.has(refId)) {
        issues.push({
          modelId: models[0]?.id ?? ("" as StructureModelId),
          kind: "dangling-field-ref",
          refId,
          aliasName: alias.name,
        });
      }
    }
    for (const unknown of unknownNamedTypes(alias.expr, typeAliases)) {
      if (unknown.toLowerCase() === alias.name.trim().toLowerCase()) continue;
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: "unknown-type-alias",
        aliasName: `${alias.name} → ${unknown}`,
      });
    }
    if (typeExprHasUnset(alias.expr)) {
      issues.push({
        modelId: models[0]?.id ?? ("" as StructureModelId),
        kind: "incomplete-type-expr",
        aliasName: alias.name,
      });
    }
  }

  return issues;
}

export function structureIssueMessage(issue: StructureIssue, models: StructureModel[]): string {
  const modelName = models.find((m) => m.id === issue.modelId)?.name ?? issue.modelId;
  switch (issue.kind) {
    case "empty-field-name":
      return `${modelName}: field has no name`;
    case "duplicate-field-name":
      return `${modelName}: duplicate field name "${issue.fieldName ?? "?"}"`;
    case "dangling-field-ref":
      if (issue.aliasName) {
        return `type alias "${issue.aliasName}" references missing structure`;
      }
      return `${modelName}.${issue.fieldName ?? "?"} references missing structure`;
    case "unknown-type-alias":
      if (!issue.fieldName) {
        return issue.aliasName?.includes(" → ")
          ? `type alias ${issue.aliasName}`
          : `unknown type alias "${issue.aliasName ?? "?"}"`;
      }
      return `${modelName}.${issue.fieldName} uses unknown type alias "${issue.aliasName ?? "?"}"`;
    case "empty-alias-name":
      return "type alias has no name";
    case "duplicate-alias-name":
      return `duplicate type alias name "${issue.aliasName ?? "?"}"`;
    case "incomplete-type-expr":
      if (issue.aliasName) {
        return `type alias "${issue.aliasName}" has unfilled UNSET slots`;
      }
      return `${modelName}.${issue.fieldName ?? "?"} has unfilled UNSET slots in its type`;
    default:
      return "structure validation error";
  }
}

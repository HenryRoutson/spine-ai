import { z } from "zod";
import { uid } from "@/lib/id";
import { tryParseTypeExprString } from "@/lib/type-expr-parse";
import { isLockedStructureModel } from "./builtin_models";
import { FIELD_TYPES, FieldType, type ModelField, type StructureModel, type StructureModelId, type TypeAlias, type TypeAliasId } from "./types";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const fieldTypeValues = FIELD_TYPES as [FieldType, ...FieldType[]];
const FIELD_TYPE_SET = new Set<string>(FIELD_TYPES);

export const modelFieldSpecSchema = z.object({
  name: z.string(),
  type: z.union([z.enum(fieldTypeValues), z.string()]),
  optional: z.boolean().default(false),
  description: z.string().default(""),
  ref: z.string().optional(),
  typeExpr: z.string().optional(),
});

export const typeAliasSpecSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  expr: z.string(),
});

export const structureModelSpecSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  fields: z.array(modelFieldSpecSchema),
});

export type StructureAssistantModelSpec = z.infer<typeof structureModelSpecSchema>;
export type TypeAliasSpec = z.infer<typeof typeAliasSpecSchema>;

const LIST_STRUCTURE_HINT = /^list\[(.+)\]$/i;

/** AI : LLMs often emit structureOut "list[Foo]" — normalize to name + outIsList. */
export function parseStructureHint(hint: string | undefined): { name: string; isList: boolean } | undefined {
  if (!hint?.trim()) return undefined;
  const trimmed = hint.trim();
  const listMatch = LIST_STRUCTURE_HINT.exec(trimmed);
  if (listMatch) return { name: listMatch[1]!.trim(), isList: true };
  return { name: trimmed, isList: false };
}

export function wantsValidationFix(message: string): boolean {
  const lower = message.toLowerCase();
  if (!/\bfix\b|\brepair\b|\bresolve\b|\bcorrect\b/.test(lower)) return false;
  return /\bissue|error|invalid|validation|mismatch|pipeline|step|i\/o\b/.test(lower);
}

export function formatValidationBlock(errors: string, label: string): string {
  if (!errors.trim()) return "\nCurrent pipeline: valid (no I/O errors).\n";
  return `\n${label}\n${errors.trim()}\n`;
}

export function resolveStructureIdFromModels(
  hint: string | undefined,
  models: StructureModel[],
): StructureModelId | undefined {
  if (!hint?.trim()) return undefined;
  const key = hint.trim().toLowerCase();
  const byId = models.find((m) => m.id.toLowerCase() === key);
  if (byId) return byId.id;
  const byName = models.find((m) => m.name.toLowerCase() === key);
  return byName?.id;
}

export function resolveStructureIdFromMap(
  hint: string | undefined,
  byName: Map<string, StructureModelId>,
  existing: StructureModel[] = [],
): StructureModelId | undefined {
  const fromExisting = resolveStructureIdFromModels(hint, existing);
  if (fromExisting) return fromExisting;
  if (!hint?.trim()) return undefined;
  const key = hint.trim().toLowerCase();
  const byNameHit = byName.get(key);
  if (byNameHit) return byNameHit;
  for (const id of byName.values()) {
    if (id.toLowerCase() === key) return id;
  }
  return undefined;
}

export function collectTypeAliasNames(
  existing: TypeAlias[],
  specs: TypeAliasSpec[] | null | undefined,
): Set<string> {
  const names = new Set(existing.map((a) => a.name.toLowerCase()));
  for (const spec of specs ?? []) {
    if (spec.name.trim()) names.add(spec.name.trim().toLowerCase());
  }
  return names;
}

export function materializeTypeAliases(
  specs: TypeAliasSpec[],
  existing: TypeAlias[],
  models: StructureModel[],
): TypeAlias[] {
  const existingByName = new Map(existing.map((a) => [a.name.toLowerCase(), a]));
  return specs.map((spec) => {
    const prev = existingByName.get(spec.name.toLowerCase());
    const parsed = tryParseTypeExprString(spec.expr, models);
    return {
      id: (prev?.id ?? uid()) as TypeAliasId,
      name: spec.name,
      description: spec.description,
      expr: parsed.ok ? parsed.expr : { kind: "named", name: spec.expr.trim() || "Any" },
    };
  });
}

export function materializeModelField(
  f: z.infer<typeof modelFieldSpecSchema>,
  ctx: {
    byName: Map<string, StructureModelId>;
    existing: StructureModel[];
    modelsForParse: StructureModel[];
    typeAliasNames: Set<string>;
    prevField?: ModelField;
  },
): ModelField {
  const base = {
    id: ctx.prevField?.id ?? uid(),
    name: f.name,
    optional: f.optional,
    description: f.description,
    example: ctx.prevField?.example,
    // AI : preserve field-level deterministic flag — assistant edits must not reset probabilistic markers.
    deterministic: ctx.prevField?.deterministic,
    testTolerance: ctx.prevField?.testTolerance,
  };

  if (f.typeExpr?.trim()) {
    const parsed = tryParseTypeExprString(f.typeExpr.trim(), ctx.modelsForParse);
    if (parsed.ok) {
      return { ...base, type: FieldType.Json, typeExpr: parsed.expr, ref: undefined };
    }
  }

  const typeStr = String(f.type);
  if (!FIELD_TYPE_SET.has(typeStr)) {
    if (ctx.typeAliasNames.has(typeStr.toLowerCase())) {
      return {
        ...base,
        type: FieldType.Json,
        typeExpr: { kind: "named", name: typeStr },
        ref: undefined,
      };
    }
    const parsed = tryParseTypeExprString(typeStr, ctx.modelsForParse);
    if (parsed.ok) {
      return { ...base, type: FieldType.Json, typeExpr: parsed.expr, ref: undefined };
    }
  }

  return {
    ...base,
    type: typeStr as FieldType,
    ref: resolveStructureIdFromMap(f.ref, ctx.byName, ctx.existing),
  };
}

export function materializeStructureModels(
  specs: StructureAssistantModelSpec[],
  existing: StructureModel[],
  typeAliasNames: Set<string> = new Set(),
): StructureModel[] {
  const existingByName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));
  const byName = new Map<string, StructureModelId>();

  for (const spec of specs) {
    const prev = existingByName.get(spec.name.toLowerCase());
    byName.set(spec.name.toLowerCase(), prev?.id ?? (uid() as StructureModelId));
  }

  const draftModels: StructureModel[] = specs.map((spec) => {
    const prev = existingByName.get(spec.name.toLowerCase());
    const id = byName.get(spec.name.toLowerCase())!;
    return {
      id,
      name: spec.name,
      description: spec.description,
      fields: [],
      auto: prev?.auto,
    };
  });

  return specs.map((spec, i) => {
    const prev = existingByName.get(spec.name.toLowerCase());
    if (prev && isLockedStructureModel(prev)) return prev;
    const id = byName.get(spec.name.toLowerCase())!;
    const prevFieldsByName = new Map(prev?.fields.map((f) => [f.name.toLowerCase(), f]) ?? []);
    const modelShell = draftModels[i]!;
    const modelsForParse = [...existing, ...draftModels.filter((m) => m.id !== id), modelShell];

    const fields: ModelField[] = spec.fields.map((f) =>
      materializeModelField(f, {
        byName,
        existing,
        modelsForParse,
        typeAliasNames,
        prevField: prevFieldsByName.get(f.name.toLowerCase()),
      }),
    );

    return {
      id,
      name: spec.name,
      description: spec.description,
      fields,
      auto: prev?.auto,
      locked: prev?.locked,
      sourceDocId: prev?.sourceDocId,
    };
  }).concat(
    existing.filter(
      (m) =>
        isLockedStructureModel(m) &&
        !specs.some((s) => s.name.toLowerCase() === m.name.toLowerCase()),
    ),
  );
}

import { z } from "zod";
import { FIELD_TYPES, type FieldType, type StructureModel, type StructureModelId } from "./types";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const fieldTypeValues = FIELD_TYPES as [FieldType, ...FieldType[]];

export const modelFieldSpecSchema = z.object({
  name: z.string(),
  type: z.union([z.enum(fieldTypeValues), z.string()]),
  optional: z.boolean(),
  description: z.string(),
  ref: z.string().optional(),
});

export const structureModelSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(modelFieldSpecSchema),
});

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

import { z } from "zod";
import { FIELD_TYPES, type FieldType, type StructureModel, type StructureModelId } from "./types";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const fieldTypeValues = FIELD_TYPES as [FieldType, ...FieldType[]];

export const modelFieldSpecSchema = z.object({
  name: z.string(),
  type: z.union([z.enum(fieldTypeValues), z.string()]),
  optional: z.boolean().default(false),
  description: z.string().default(""),
  ref: z.string().optional(),
});

export const structureModelSpecSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  fields: z.array(modelFieldSpecSchema),
});

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

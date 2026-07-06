// AI : spine type migration — derive inType/outType from legacy fields and keep them in sync.
import { z } from "zod";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import type { ModuleKind, PipelineModule, StructureModelId } from "./types";
import {
  formatTypeExpr,
  isListRoot,
  type TypeExpr,
} from "./type_expr";

export type { TypeExpr } from "./type_expr";
export {
  formatTypeExpr,
  isListRoot,
  stepSpineInType,
  stepSpineOutType,
  typeExprEqual,
  typeExprToPy,
  typeExprToTs,
} from "./type_expr";

const PrimNameSchema = z.enum(["text", "int", "float", "bool", "datetime", "json"]);
const InputTypeSchema = z.enum(["pdf", "excel", "word", "json", "text", "web", "image"]);

// AI : JSON-safe TypeExpr — persisted on PipelineModule.inType / outType.
const TypeExprSchemaInner: z.ZodType<TypeExpr> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("prim"), name: PrimNameSchema }),
    z.object({ kind: z.literal("document") }),
    z.object({ kind: z.literal("quote") }),
    z.object({ kind: z.literal("text_quote") }),
    z.object({ kind: z.literal("list"), item: TypeExprSchemaInner }),
    z.object({ kind: z.literal("ref"), modelId: z.string() }),
    z.object({ kind: z.literal("file"), inputTypes: z.array(InputTypeSchema).min(1) }),
    z.object({ kind: z.literal("unknown") }),
    z.object({ kind: z.literal("optional"), inner: TypeExprSchemaInner }),
    z.object({ kind: z.literal("set"), item: TypeExprSchemaInner }),
    z.object({
      kind: z.literal("map"),
      key: TypeExprSchemaInner,
      value: TypeExprSchemaInner,
    }),
    z.object({ kind: z.literal("union"), variants: z.array(TypeExprSchemaInner).min(2) }),
    z.object({
      kind: z.literal("generic"),
      name: z.string().min(1),
      args: z.array(TypeExprSchemaInner),
    }),
    z.object({ kind: z.literal("named"), name: z.string().min(1) }),
    z.object({ kind: z.literal("unset") }),
  ]) as z.ZodType<TypeExpr>,
);

export const TypeExprSchema = TypeExprSchemaInner;

function refType(modelId: StructureModelId | undefined): TypeExpr | undefined {
  return modelId ? { kind: "ref", modelId } : undefined;
}

function listOf(item: TypeExpr): TypeExpr {
  return { kind: "list", item };
}

function codedTransform(m: PipelineModule): boolean {
  return !!m.code?.trim() || (m.kind === "custom-code" && customCodeEntriesForModule(m).length > 0);
}

function legacyEmitsList(m: PipelineModule): boolean {
  if (m.kind === "llm-batch") return true;
  return !!m.outIsList;
}

// AI : legacy derivation when inType/outType not yet persisted.
export function deriveOutType(m: PipelineModule): TypeExpr | undefined {
  if (m.kind === "output" || m.kind === "assert" || m.kind === "human-review") {
    const id = m.inStructureId ?? m.outStructureId;
    const base = refType(id);
    if (!base) return undefined;
    // AI : output/assert/human-review may materialize a list snapshot — preserve legacy outIsList in outType.
    return legacyEmitsList(m) ? listOf(base) : base;
  }
  if (!m.outStructureId) return undefined;
  const base = refType(m.outStructureId);
  if (!base) return undefined;
  if (m.kind === "llm-batch") return listOf(base);
  if (m.kind === "transform" && !codedTransform(m) && !legacyEmitsList(m)) {
    return base;
  }
  if (legacyEmitsList(m)) return listOf(base);
  return base;
}

export function deriveInType(m: PipelineModule): TypeExpr | undefined {
  if (!m.inStructureId) return undefined;
  const base = refType(m.inStructureId);
  if (!base) return undefined;
  if (m.kind === "llm-batch") return listOf(base);
  return base;
}

export function resolveOutIsList(m: PipelineModule): boolean {
  if (m.outType) return isListRoot(m.outType);
  return legacyEmitsList(m);
}

export function syncLegacyFromSpineTypes(m: PipelineModule): PipelineModule {
  const outType = m.outType ?? deriveOutType(m);
  const inType = m.inType ?? deriveInType(m);
  const outIsList = outType ? isListRoot(outType) : m.outIsList;
  return {
    ...m,
    ...(outType ? { outType } : {}),
    ...(inType ? { inType } : {}),
    ...(outIsList ? { outIsList: true } : outIsList === false ? { outIsList: undefined } : {}),
  };
}

export function migrateModuleSpineTypes(m: PipelineModule): PipelineModule {
  const derived = deriveOutType(m);
  const outType = reconcileSpineOutType(m, derived);
  const inType = m.inType ?? deriveInType(m);
  return syncLegacyFromSpineTypes({ ...m, ...(outType ? { outType } : {}), ...(inType ? { inType } : {}) });
}

// AI : sync may change outStructureId while outType still references the old target — prefer derived.
function reconcileSpineOutType(m: PipelineModule, derived: TypeExpr | undefined): TypeExpr | undefined {
  if (!derived) return m.outType;
  if (!m.outType) return derived;
  if (!m.outStructureId) return m.outType;
  const persistedRef = refFromType(m.outType);
  if (persistedRef === m.outStructureId) return m.outType;
  const derivedRef = refFromType(derived);
  if (derivedRef === m.outStructureId) return derived;
  return m.outType;
}

export function migrateModulesSpineTypes(modules: PipelineModule[]): PipelineModule[] {
  return modules.map(migrateModuleSpineTypes);
}

export function refFromType(expr: TypeExpr | undefined): StructureModelId | undefined {
  if (!expr) return undefined;
  if (expr.kind === "ref") return expr.modelId;
  if (expr.kind === "list" && expr.item.kind === "ref") return expr.item.modelId;
  return undefined;
}

export function patchSpineOutList(
  m: PipelineModule,
  isList: boolean,
): Pick<PipelineModule, "outType" | "outIsList"> {
  const modelId = m.outStructureId ?? refFromType(m.outType);
  if (!modelId) return { outIsList: isList || undefined };
  const base: TypeExpr = { kind: "ref", modelId };
  const outType = isList ? listOf(base) : base;
  return { outType, outIsList: isList || undefined };
}

export function formatModuleSpineOut(m: PipelineModule, models: Parameters<typeof formatTypeExpr>[1] = []): string {
  const t = m.outType ?? deriveOutType(m);
  return t ? formatTypeExpr(t, models) : "?";
}

export function formatModuleSpineIn(m: PipelineModule, models: Parameters<typeof formatTypeExpr>[1] = []): string {
  const t = m.inType ?? deriveInType(m);
  return t ? formatTypeExpr(t, models) : "?";
}

export function spineOutLabel(m: PipelineModule, models: Parameters<typeof formatTypeExpr>[1] = []): string {
  return formatModuleSpineOut(m, models);
}

export function spineInLabel(m: PipelineModule, models: Parameters<typeof formatTypeExpr>[1] = []): string {
  return formatModuleSpineIn(m, models);
}

export function llmStepEmitsList(m: PipelineModule): boolean {
  if (m.kind === "llm-batch") return true;
  return resolveOutIsList(m);
}

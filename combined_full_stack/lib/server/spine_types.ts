// AI : spine type migration — derive inType/outType and strip legacy outIsList on load.
// AI : TODO (linter-first) — deriveOutType is interim; canonical spine types live in generated pipeline_types.py/.rs.
import { z } from "zod";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { InputType, type ModuleKind, type PipelineModule, type StructureModelId } from "./types";
import {
  formatTypeExpr,
  isListRoot,
  PrimName,
  stepEmitsList,
  type TypeExpr,
} from "./type_expr";

export type { TypeExpr } from "./type_expr";
export {
  formatTypeExpr,
  isListRoot,
  stepEmitsList,
  stepSpineInType,
  stepSpineOutType,
  typeExprEqual,
  typeExprToPy,
  typeExprToTs,
} from "./type_expr";

const PrimNameSchema = z.nativeEnum(PrimName);
const InputTypeSchema = z.nativeEnum(InputType);

// AI : JSON-safe TypeExpr — persisted on PipelineModule.inType / outType.
const TypeExprSchemaInner: z.ZodType<TypeExpr> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("prim"), name: PrimNameSchema }),
    z.object({ kind: z.literal("document") }),
    z.object({ kind: z.literal("quote") }),
    z.object({ kind: z.literal("text_quote") }),
    z.object({ kind: z.literal("list"), item: TypeExprSchemaInner }),
    z.object({
      kind: z.literal("ref"),
      modelId: z.string(),
      args: z.array(TypeExprSchemaInner).optional(),
    }),
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

type LegacyModule = PipelineModule & { outIsList?: boolean };

function readLegacyOutIsList(m: PipelineModule): boolean {
  return !!(m as LegacyModule).outIsList;
}

function stripLegacyOutIsList(m: PipelineModule): PipelineModule {
  const { outIsList: _legacy, ...rest } = m as LegacyModule;
  return rest;
}

function refType(modelId: StructureModelId | undefined): TypeExpr | undefined {
  return modelId ? { kind: "ref", modelId } : undefined;
}

export function listOf(item: TypeExpr): TypeExpr {
  return { kind: "list", item };
}

function codedTransform(m: PipelineModule): boolean {
  return !!m.code?.trim() || (m.kind === "custom-code" && customCodeEntriesForModule(m).length > 0);
}

function legacyEmitsList(m: PipelineModule): boolean {
  if (m.kind === "llm-batch" || m.kind === "example-select") return true;
  return readLegacyOutIsList(m);
}

// AI : derive spine out type when outType not yet persisted (incl. one-time legacy outIsList read).
export function deriveOutType(m: PipelineModule): TypeExpr | undefined {
  // AI : TODO (n8n-stage-F-spine) — ModuleKind.N8n: typically outStructureId / json item shape from node output.
  if (m.kind === "merge" && m.outType) return m.outType;
  if (m.kind === "chatbot") {
    const id = m.outStructureId;
    return id ? refType(id) : undefined;
  }
  if (m.kind === "output" || m.kind === "assert" || m.kind === "human-review") {
    const id = m.inStructureId ?? m.outStructureId;
    const base = refType(id);
    if (!base) return undefined;
    return legacyEmitsList(m) ? listOf(base) : base;
  }
  if (!m.outStructureId) return undefined;
  const base = refType(m.outStructureId);
  if (!base) return undefined;
  if (m.kind === "llm-batch" || m.kind === "example-select") return listOf(base);
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
  if (m.kind === "llm-batch" || m.kind === "example-select") return listOf(base);
  if (m.kind === "quote" && m.outType && isListRoot(m.outType)) return listOf(base);
  return base;
}

/** @deprecated use stepEmitsList */
export function resolveOutIsList(m: PipelineModule): boolean {
  return stepEmitsList(m);
}

export function ensureSpineTypes(m: PipelineModule): PipelineModule {
  const outType = m.outType ?? deriveOutType(m);
  const inType = m.inType ?? deriveInType(m);
  return stripLegacyOutIsList({
    ...m,
    ...(outType ? { outType } : {}),
    ...(inType ? { inType } : {}),
  });
}

export function migrateModuleSpineTypes(m: PipelineModule): PipelineModule {
  const derived = deriveOutType(m);
  const outType = reconcileSpineOutType(m, derived);
  const inType = m.inType ?? deriveInType(m);
  return ensureSpineTypes({ ...m, ...(outType ? { outType } : {}), ...(inType ? { inType } : {}) });
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

export function patchSpineOutList(m: PipelineModule, isList: boolean): Pick<PipelineModule, "outType"> {
  const modelId = m.outStructureId ?? refFromType(m.outType);
  if (!modelId) return {};
  const base: TypeExpr = { kind: "ref", modelId };
  return { outType: isList ? listOf(base) : base };
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
  return stepEmitsList(m);
}

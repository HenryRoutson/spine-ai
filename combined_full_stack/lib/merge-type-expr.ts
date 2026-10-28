// AI : derive spine TypeExpr / StructureModel after a structural merge — mirrors lib/merger.ts semantics.
import {
  MergeDictStrategy,
  MergeListStrategy,
  MergeScalarStrategy,
  type MergeLayerPolicy,
  type MergePolicy,
  type ModelField,
  FieldType,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
} from "@/lib/types";
import { fieldToTypeExpr, isListRoot, stepSpineOutType, type TypeExpr } from "@/lib/server/type_expr";
import { labelAsStateKey } from "@/lib/server/pipeline_state";

type PathSegment = string | number;
type Path = PathSegment[];

type ResolvedLayer = {
  list: MergeListStrategy;
  dict: MergeDictStrategy;
  scalar: MergeScalarStrategy;
};

type MergeTypeCtx = {
  models: StructureModel[];
  derived: Map<StructureModelId, StructureModel>;
  mergeStepId?: string;
};

const DEFAULT_LAYER: ResolvedLayer = {
  list: MergeListStrategy.Concat,
  dict: MergeDictStrategy.Deep,
  scalar: MergeScalarStrategy.Last,
};

function modelById(ctx: MergeTypeCtx, id: StructureModelId): StructureModel | undefined {
  return ctx.derived.get(id) ?? ctx.models.find((m) => m.id === id);
}

function resolveLayer(raw: MergeLayerPolicy | undefined): ResolvedLayer {
  return {
    list: raw?.list ?? DEFAULT_LAYER.list,
    dict: raw?.dict ?? DEFAULT_LAYER.dict,
    scalar: raw?.scalar ?? DEFAULT_LAYER.scalar,
  };
}

class MergePolicyResolver {
  private readonly defaultPolicy: ResolvedLayer;
  private readonly rules: { pattern: string; policy: ResolvedLayer }[];

  constructor(policy: MergePolicy | undefined) {
    this.defaultPolicy = resolveLayer(policy?.default);
    this.rules = (policy?.rules ?? []).map((r) => ({
      pattern: r.path,
      policy: resolveLayer(r.policy),
    }));
  }

  resolve(path: Path): ResolvedLayer {
    let matched: ResolvedLayer | undefined;
    let matchedDepth = -1;
    for (const { pattern, policy } of this.rules) {
      const depth = patternMatchDepth(pattern, path);
      if (depth !== null && depth > matchedDepth) {
        matched = policy;
        matchedDepth = depth;
      }
    }
    return matched ?? this.defaultPolicy;
  }
}

function isScalarExpr(expr: TypeExpr): boolean {
  return (
    expr.kind === "prim" ||
    expr.kind === "document" ||
    expr.kind === "quote" ||
    expr.kind === "text_quote" ||
    expr.kind === "unknown" ||
    expr.kind === "unset"
  );
}

function scalarMergeType(left: TypeExpr, right: TypeExpr, layer: ResolvedLayer): TypeExpr {
  if (layer.scalar === MergeScalarStrategy.First) return left;
  if (layer.scalar === MergeScalarStrategy.Error && !typeExprLooseEqual(left, right)) {
    return widenTypes(left, right);
  }
  return right;
}

function typeExprLooseEqual(a: TypeExpr, b: TypeExpr): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "ref" && b.kind === "ref") return a.modelId === b.modelId;
  if (a.kind === "prim" && b.kind === "prim") return a.name === b.name;
  if (a.kind === "list" && b.kind === "list") return typeExprLooseEqual(a.item, b.item);
  return a.kind === b.kind;
}

function widenTypes(a: TypeExpr, b: TypeExpr): TypeExpr {
  if (typeExprLooseEqual(a, b)) return a;
  if (a.kind === "unknown" || a.kind === "unset") return b;
  if (b.kind === "unknown" || b.kind === "unset") return a;
  if (a.kind === "union") {
    const variants = [...a.variants];
    if (!variants.some((v) => typeExprLooseEqual(v, b))) variants.push(b);
    return variants.length === 1 ? variants[0]! : { kind: "union", variants };
  }
  if (b.kind === "union") {
    const variants = [...b.variants];
    if (!variants.some((v) => typeExprLooseEqual(v, a))) variants.unshift(a);
    return variants.length === 1 ? variants[0]! : { kind: "union", variants };
  }
  return { kind: "union", variants: [a, b] };
}

function mergeFieldsDeep(
  left: ModelField,
  right: ModelField,
  resolver: MergePolicyResolver,
  path: Path,
  ctx: MergeTypeCtx,
): ModelField {
  const mergedExpr = deriveMergeTypeExpr(
    fieldToTypeExpr(left),
    fieldToTypeExpr(right),
    resolver,
    [...path, left.name],
    ctx,
  );
  return {
    ...left,
    optional: left.optional || right.optional,
    typeExpr: mergedExpr,
    ref: mergedExpr.kind === "ref" ? mergedExpr.modelId : mergedExpr.kind === "list" && mergedExpr.item.kind === "ref" ? mergedExpr.item.modelId : left.ref,
  };
}

function mergeFieldsShallow(left: ModelField, right: ModelField): ModelField {
  return {
    ...right,
    optional: left.optional || right.optional,
    typeExpr: fieldToTypeExpr(right),
  };
}

function mergeModelFields(
  left: StructureModel,
  right: StructureModel,
  layer: ResolvedLayer,
  path: Path,
  resolver: MergePolicyResolver,
  ctx: MergeTypeCtx,
): ModelField[] {
  const byName = new Map<string, ModelField>();
  for (const f of left.fields) byName.set(f.name, f);
  for (const f of right.fields) {
    const prev = byName.get(f.name);
    if (!prev) {
      byName.set(f.name, f);
      continue;
    }
    byName.set(
      f.name,
      layer.dict === MergeDictStrategy.Shallow
        ? mergeFieldsShallow(prev, f)
        : mergeFieldsDeep(prev, f, resolver, path, ctx),
    );
  }
  return [...byName.values()];
}

function derivedModelId(leftId: StructureModelId, rightId: StructureModelId, stepId?: string): StructureModelId {
  const base = stepId ? `sm_merge_${stepId}` : `sm_merge_${leftId}_${rightId}`;
  return base as StructureModelId;
}

function ensureMergedModel(
  leftId: StructureModelId,
  rightId: StructureModelId,
  layer: ResolvedLayer,
  resolver: MergePolicyResolver,
  path: Path,
  ctx: MergeTypeCtx,
): StructureModelId {
  if (layer.dict === MergeDictStrategy.Replace) return rightId;
  if (leftId === rightId) return leftId;

  const left = modelById(ctx, leftId);
  const right = modelById(ctx, rightId);
  if (!left || !right) return rightId ?? leftId;

  const id = derivedModelId(leftId, rightId, ctx.mergeStepId);
  const existing = ctx.derived.get(id);
  const fields = mergeModelFields(left, right, layer, path, resolver, ctx);
  const name = existing?.name ?? `Merged_${left.name}_${right.name}`;
  const model: StructureModel = {
    id,
    name,
    description: "Auto-derived merge output structure.",
    auto: true,
    fields,
  };
  ctx.derived.set(id, model);
  return id;
}

function upsertDerivedModels(models: StructureModel[], derived: StructureModel[]): StructureModel[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  for (const m of derived) byId.set(m.id, m);
  return [...byId.values()];
}

function mergeListTypes(
  left: Extract<TypeExpr, { kind: "list" }>,
  right: Extract<TypeExpr, { kind: "list" }>,
  layer: ResolvedLayer,
  resolver: MergePolicyResolver,
  path: Path,
  ctx: MergeTypeCtx,
): TypeExpr {
  const strategy = layer.list;
  if (strategy === MergeListStrategy.Replace || strategy === MergeListStrategy.ReplaceAssert) {
    return right;
  }
  if (strategy === MergeListStrategy.PrependAssert) {
    return left;
  }
  if (strategy === MergeListStrategy.Intersect || strategy === MergeListStrategy.IntersectAssert) {
    // AI : intersect keeps left item shape; zip/union/concat still derive merged item via *
    return { kind: "list", item: left.item };
  }
  // AI : list strategies that recurse into elements resolve child policies at path.*
  const item = deriveMergeTypeExpr(left.item, right.item, resolver, [...path, "*"], ctx);
  return { kind: "list", item };
}

export function deriveMergeTypeExpr(
  left: TypeExpr,
  right: TypeExpr,
  resolver: MergePolicyResolver,
  path: Path,
  ctx: MergeTypeCtx,
): TypeExpr {
  const layer = resolver.resolve(path);

  if (left.kind === "unset") return right;
  if (right.kind === "unset") return left;
  if (left.kind === "unknown") return right;
  if (right.kind === "unknown") return left;

  if (left.kind === "optional" || right.kind === "optional") {
    const l = left.kind === "optional" ? left.inner : left;
    const r = right.kind === "optional" ? right.inner : right;
    const inner = deriveMergeTypeExpr(l, r, resolver, path, ctx);
    return left.kind === "optional" || right.kind === "optional"
      ? { kind: "optional", inner }
      : inner;
  }

  if (left.kind === "list" && right.kind === "list") {
    return mergeListTypes(left, right, layer, resolver, path, ctx);
  }
  if (left.kind === "list" || right.kind === "list") {
    return { kind: "unknown" };
  }

  if (left.kind === "ref" && right.kind === "ref") {
    const modelId = ensureMergedModel(left.modelId, right.modelId, layer, resolver, path, ctx);
    return { kind: "ref", modelId };
  }
  if (left.kind === "ref" || right.kind === "ref") {
    return right.kind === "ref" ? right : left;
  }

  if (isScalarExpr(left) && isScalarExpr(right)) {
    return scalarMergeType(left, right, layer);
  }

  if (left.kind === "set" && right.kind === "set") {
    return { kind: "set", item: deriveMergeTypeExpr(left.item, right.item, resolver, path, ctx) };
  }
  if (left.kind === "map" && right.kind === "map") {
    return {
      kind: "map",
      key: deriveMergeTypeExpr(left.key, right.key, resolver, path, ctx),
      value: deriveMergeTypeExpr(left.value, right.value, resolver, path, ctx),
    };
  }

  if (left.kind === right.kind) {
    return layer.scalar === MergeScalarStrategy.First ? left : right;
  }

  return widenTypes(left, right);
}

export function deriveMergeSpineOutType(
  inType: TypeExpr,
  policy: MergePolicy | undefined,
  models: StructureModel[],
  mergeStepId?: string,
): { outType: TypeExpr; models: StructureModel[] } {
  const resolver = new MergePolicyResolver(policy);
  const ctx: MergeTypeCtx = { models, derived: new Map(), mergeStepId };

  let outType: TypeExpr;
  if (isListRoot(inType)) {
    // AI : merge step receives list[T] as multiple operands — fold item types.
    const mergedItem = deriveMergeTypeExpr(inType.item, inType.item, resolver, [], ctx);
    outType = { kind: "list", item: mergedItem };
  } else {
    outType = deriveMergeTypeExpr(inType, inType, resolver, [], ctx);
  }

  const derivedModels = [...ctx.derived.values()];
  return {
    outType,
    models: derivedModels.length ? upsertDerivedModels(models, derivedModels) : models,
  };
}

// AI : merge two spine types — e.g. combine-side + pipeline-state shapes before a merge step.
export function deriveMergePairType(
  left: TypeExpr,
  right: TypeExpr,
  policy: MergePolicy | undefined,
  models: StructureModel[],
  mergeStepId?: string,
): { outType: TypeExpr; models: StructureModel[] } {
  const resolver = new MergePolicyResolver(policy);
  const ctx: MergeTypeCtx = { models, derived: new Map(), mergeStepId };
  const outType = deriveMergeTypeExpr(left, right, resolver, [], ctx);
  const derivedModels = [...ctx.derived.values()];
  return {
    outType,
    models: derivedModels.length ? upsertDerivedModels(models, derivedModels) : models,
  };
}

function wrapListFieldType(
  listExpr: Extract<TypeExpr, { kind: "list" }>,
  fieldName: string,
  outModelId: StructureModelId | undefined,
  ctx: MergeTypeCtx,
  stepId?: string,
): TypeExpr {
  const outModel = outModelId ? modelById(ctx, outModelId) : undefined;
  const field = outModel?.fields.find((f) => f.name === fieldName);
  const itemExpr = field ? fieldToTypeExpr(field) : listExpr;
  const wrapId = (`sm_merge_wrap_${stepId ?? "step"}_${fieldName}`) as StructureModelId;
  const wrapModel: StructureModel = {
    id: wrapId,
    name: `Wrap_${fieldName}`,
    description: "Auto-derived merge spine operand.",
    auto: true,
    fields: [
      {
        id: `f_wrap_${fieldName}`,
        name: fieldName,
        type: field?.type ?? FieldType.ListModel,
        ref: field?.ref,
        optional: false,
        description: field?.description ?? "",
        typeExpr: itemExpr,
      },
    ],
  };
  ctx.derived.set(wrapId, wrapModel);
  return { kind: "ref", modelId: wrapId };
}

function spineOperandType(
  m: PipelineModule,
  spineType: TypeExpr,
  ctx: MergeTypeCtx,
): TypeExpr {
  const wrap = m.mergeWrapListField?.trim();
  if (wrap && spineType.kind === "list") {
    return wrapListFieldType(spineType, wrap, m.outStructureId, ctx, m.id);
  }
  return spineType;
}

function stateOperandType(
  m: PipelineModule,
  modules: PipelineModule[] | undefined,
): TypeExpr | undefined {
  const label = m.mergeStateLabel?.trim();
  if (!label || !modules?.length) return undefined;
  const stateMod = modules.find((mod) => labelAsStateKey(mod.label) === labelAsStateKey(label));
  return stateMod ? stepSpineOutType(stateMod) : undefined;
}

export function deriveMergeStepTypes(
  m: PipelineModule,
  prev: PipelineModule | undefined,
  models: StructureModel[],
  policy: MergePolicy,
  modules?: PipelineModule[],
): { module: PipelineModule; models: StructureModel[] } {
  if (m.mergeCustom?.trim()) return { module: m, models };

  const spineType =
    (prev && stepSpineOutType(prev)) ??
    (m.inStructureId ? ({ kind: "ref", modelId: m.inStructureId } as TypeExpr) : undefined);
  if (!spineType) return { module: m, models };

  const stateType = stateOperandType(m, modules);
  if (stateType) {
    const ctx: MergeTypeCtx = { models, derived: new Map(), mergeStepId: m.id };
    const rightType = spineOperandType(m, spineType, ctx);
    const modelsWithDerived = upsertDerivedModels(models, [...ctx.derived.values()]);
    const { outType, models: pairModels } = deriveMergePairType(
      stateType,
      rightType,
      policy,
      modelsWithDerived,
      m.id,
    );
    const derivedModels = [...ctx.derived.values(), ...pairModels.filter((dm) => dm.auto && !ctx.derived.has(dm.id))];
    const nextModels = derivedModels.length ? upsertDerivedModels(modelsWithDerived, derivedModels) : modelsWithDerived;
    const refId =
      m.outStructureId ??
      (outType.kind === "ref"
        ? outType.modelId
        : outType.kind === "list" && outType.item.kind === "ref"
          ? outType.item.modelId
          : undefined);
    const moduleOutType: TypeExpr = m.outStructureId
      ? { kind: "ref", modelId: m.outStructureId }
      : outType;
    return {
      models: m.outStructureId ? models : nextModels,
      module: {
        ...m,
        inStructureId: m.inStructureId ?? refFromInType(spineType),
        outStructureId: refId ?? m.outStructureId,
        inType: spineType,
        outType: moduleOutType,
      },
    };
  }

  const { outType, models: nextModels } = deriveMergeSpineOutType(spineType, policy, models, m.id);

  const refId =
    m.outStructureId ??
    (outType.kind === "ref"
      ? outType.modelId
      : outType.kind === "list" && outType.item.kind === "ref"
        ? outType.item.modelId
        : undefined);
  const moduleOutType: TypeExpr = m.outStructureId
    ? { kind: "ref", modelId: m.outStructureId }
    : outType;

  return {
    models: m.outStructureId ? models : nextModels,
    module: {
      ...m,
      inStructureId: m.inStructureId ?? refFromInType(spineType),
      outStructureId: refId ?? m.outStructureId,
      inType: spineType,
      outType: moduleOutType,
    },
  };
}

function refFromInType(expr: TypeExpr): StructureModelId | undefined {
  if (expr.kind === "ref") return expr.modelId;
  if (expr.kind === "list" && expr.item.kind === "ref") return expr.item.modelId;
  return undefined;
}

function patternMatchDepth(pattern: string, path: Path): number | null {
  const patternParts = pattern.split(".").filter(Boolean);
  if (!patternParts.length) return path.length ? null : 0;
  if (patternParts.includes("**")) return globstarMatchFrom(patternParts, path, 0, 0);
  if (patternParts.length > path.length) return null;
  const offset = path.length - patternParts.length;
  if (suffixMatch(patternParts, path.slice(offset))) return patternParts.length;
  return null;
}

function globstarMatchFrom(pattern: string[], path: Path, pi: number, si: number): number | null {
  if (pi === pattern.length) return si === path.length ? path.length : null;
  if (pattern[pi] === "**") {
    let best: number | null = null;
    for (let span = si; span <= path.length; span++) {
      const depth = globstarMatchFrom(pattern, path, pi + 1, span);
      if (depth !== null && (best === null || depth > best)) best = depth;
    }
    return best;
  }
  if (si >= path.length) return null;
  if (pattern[pi] !== "*" && String(pattern[pi]) !== String(path[si])) return null;
  return globstarMatchFrom(pattern, path, pi + 1, si + 1);
}

function suffixMatch(pattern: string[], path: Path): boolean {
  if (pattern.length !== path.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const pat = pattern[i]!;
    const seg = path[i]!;
    if (pat === "*") continue;
    if (String(pat) !== String(seg)) return false;
  }
  return true;
}

// AI : recursive structural merger — TypeScript port of atomic_code/merger/merger.py.
// AI : runs in-browser for merge steps and is importable from server export paths.

import {
  MergeDictStrategy,
  MergeListStrategy,
  MergeScalarStrategy,
  type MergeLayerPolicy,
  type MergePolicy,
} from "@/lib/types";

type PathSegment = string | number;
type Path = PathSegment[];
type ComparisonKey = string | number | boolean | null;
type KeyFn = (item: unknown) => ComparisonKey;

type ResolvedLayerPolicy = {
  list: MergeListStrategy;
  dict: MergeDictStrategy;
  scalar: MergeScalarStrategy;
  keyFn: KeyFn | undefined;
};

const DEFAULT_LAYER: ResolvedLayerPolicy = {
  list: MergeListStrategy.Concat,
  dict: MergeDictStrategy.Deep,
  scalar: MergeScalarStrategy.Last,
  keyFn: undefined,
};

export const DEFAULT_MERGE_POLICY: MergePolicy = {
  default: {
    list: MergeListStrategy.Concat,
    dict: MergeDictStrategy.Deep,
    scalar: MergeScalarStrategy.Last,
  },
};

function resolveLayer(raw: MergeLayerPolicy | undefined): ResolvedLayerPolicy {
  return {
    list: raw?.list ?? DEFAULT_LAYER.list,
    dict: raw?.dict ?? DEFAULT_LAYER.dict,
    scalar: raw?.scalar ?? DEFAULT_LAYER.scalar,
    keyFn: raw?.itemKey ? itemKeyFn(raw.itemKey) : undefined,
  };
}

function itemKeyFn(keyPath: string): KeyFn {
  return (item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const value = (item as Record<string, unknown>)[keyPath];
      if (value === undefined || value === null) {
        throw new TypeError(`itemKey "${keyPath}" missing on ${JSON.stringify(item)}`);
      }
      return value as ComparisonKey;
    }
    throw new TypeError(`itemKey "${keyPath}" requires object list items`);
  };
}

class MergePolicyResolver {
  private readonly defaultPolicy: ResolvedLayerPolicy;
  private readonly rules: { pattern: string; policy: ResolvedLayerPolicy }[];

  constructor(policy: MergePolicy | undefined) {
    this.defaultPolicy = resolveLayer(policy?.default);
    this.rules = (policy?.rules ?? []).map((r) => ({
      pattern: r.path,
      policy: resolveLayer(r.policy),
    }));
  }

  resolve(path: Path): ResolvedLayerPolicy {
    let matched: ResolvedLayerPolicy | undefined;
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

export function merge(left: unknown, right: unknown, policy?: MergePolicy): unknown {
  return mergeAll(policy, left, right);
}

export function mergeAll(policy: MergePolicy | undefined, ...values: unknown[]): unknown {
  const resolver = new MergePolicyResolver(policy);
  const present = values.filter((v) => v !== null && v !== undefined);
  if (!present.length) return null;
  if (present.length === 1) return present[0];
  let result: unknown = present[0];
  for (const nxt of present.slice(1)) {
    result = mergePair(result, nxt, resolver, []);
  }
  return result;
}

export function normalizeMergeInput(input: unknown): unknown[] {
  if (Array.isArray(input)) return input.filter((v) => v !== null && v !== undefined);
  if (input === null || input === undefined) return [];
  return [input];
}

export function runMergeStep(input: unknown, policy?: MergePolicy): unknown {
  return mergeAll(policy, ...normalizeMergeInput(input));
}

function mergePair(
  left: unknown,
  right: unknown,
  resolver: MergePolicyResolver,
  path: Path,
): unknown {
  if (left === null || left === undefined) return right;
  if (right === null || right === undefined) return left;

  const layer = resolver.resolve(path);

  if (isPlainObject(left) && isPlainObject(right)) {
    return mergeDicts(left, right, resolver, path, layer);
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return mergeLists(left, right, layer, path);
  }
  if (isScalar(left) && isScalar(right)) {
    return mergeScalars(left, right, layer);
  }
  if (typeof left === typeof right) {
    return layer.scalar === MergeScalarStrategy.First ? left : right;
  }

  throw new TypeError(
    `cannot merge ${typeof left} with ${typeof right} at path ${pathLabel(path)}`,
  );
}

function mergeDicts(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  resolver: MergePolicyResolver,
  path: Path,
  layer: ResolvedLayerPolicy,
): Record<string, unknown> {
  if (layer.dict === MergeDictStrategy.Replace) return { ...right };
  if (layer.dict === MergeDictStrategy.Shallow) return { ...left, ...right };

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const childPath: Path = [...path, key];
    if (key in left && key in right) {
      out[key] = mergePair(left[key], right[key], resolver, childPath);
    } else if (key in left) {
      out[key] = left[key];
    } else {
      out[key] = right[key];
    }
  }
  return out;
}

function mergeLists(left: unknown[], right: unknown[], layer: ResolvedLayerPolicy, path: Path): unknown[] {
  const strategy = layer.list;

  if (strategy === MergeListStrategy.Replace) return [...right];
  if (strategy === MergeListStrategy.Prepend) return [...right, ...left];
  if (strategy === MergeListStrategy.Concat) return [...left, ...right];
  if (strategy === MergeListStrategy.ConcatDedupe) {
    return dedupePreserveOrder([...left, ...right], layer.keyFn);
  }
  if (strategy === MergeListStrategy.ConcatAssertNoDuplicates) {
    return assertNoDuplicates([...left, ...right], layer.keyFn, path);
  }
  if (strategy === MergeListStrategy.Union) {
    return setOpLists(left, right, layer.keyFn, "union");
  }
  if (strategy === MergeListStrategy.Intersect) {
    return setOpLists(left, right, layer.keyFn, "intersect");
  }

  throw new Error(`unknown list strategy: ${strategy}`);
}

function mergeScalars(left: unknown, right: unknown, layer: ResolvedLayerPolicy): unknown {
  if (layer.scalar === MergeScalarStrategy.First) return left;
  if (layer.scalar === MergeScalarStrategy.Last) return right;
  throw new TypeError("scalar conflict under MergeScalarStrategy.Error");
}

function setOpLists(
  left: unknown[],
  right: unknown[],
  keyFn: KeyFn | undefined,
  op: "union" | "intersect",
): unknown[] {
  const leftKeys = left.map((item) => comparisonKey(item, keyFn));
  const rightKeys = right.map((item) => comparisonKey(item, keyFn));
  const leftSet = new Set(leftKeys);
  const rightSet = new Set(rightKeys);

  let orderedKeys: ComparisonKey[];
  if (op === "union") {
    const wanted = new Set([...leftSet, ...rightSet]);
    orderedKeys = unionKeyOrder(leftKeys, rightKeys, wanted);
  } else {
    const wanted = new Set([...leftSet].filter((k) => rightSet.has(k)));
    orderedKeys = [];
    const seen = new Set<ComparisonKey>();
    for (const k of leftKeys) {
      if (wanted.has(k) && !seen.has(k)) {
        seen.add(k);
        orderedKeys.push(k);
      }
    }
  }

  const keyToItem = new Map<ComparisonKey, unknown>();
  for (let i = 0; i < left.length; i++) keyToItem.set(leftKeys[i]!, left[i]);
  for (let i = 0; i < right.length; i++) keyToItem.set(rightKeys[i]!, right[i]);

  return orderedKeys.map((k) => keyToItem.get(k)!);
}

function unionKeyOrder(
  leftKeys: ComparisonKey[],
  rightKeys: ComparisonKey[],
  wanted: Set<ComparisonKey>,
): ComparisonKey[] {
  const out: ComparisonKey[] = [];
  const seen = new Set<ComparisonKey>();
  for (const ck of [...leftKeys, ...rightKeys]) {
    if (wanted.has(ck) && !seen.has(ck)) {
      seen.add(ck);
      out.push(ck);
    }
  }
  return out;
}

function dedupePreserveOrder(items: unknown[], keyFn: KeyFn | undefined): unknown[] {
  const seen = new Set<ComparisonKey>();
  const out: unknown[] = [];
  for (const item of items) {
    const ck = comparisonKey(item, keyFn);
    if (seen.has(ck)) continue;
    seen.add(ck);
    out.push(item);
  }
  return out;
}

function assertNoDuplicates(items: unknown[], keyFn: KeyFn | undefined, path: Path): unknown[] {
  const seen = new Set<ComparisonKey>();
  const out: unknown[] = [];
  for (const item of items) {
    const ck = comparisonKey(item, keyFn);
    if (seen.has(ck)) {
      throw new TypeError(`duplicate list item at path ${pathLabel(path)} (key=${String(ck)})`);
    }
    seen.add(ck);
    out.push(item);
  }
  return out;
}

function comparisonKey(item: unknown, keyFn: KeyFn | undefined): ComparisonKey {
  if (keyFn) return keyFn(item);
  if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return item;
  }
  if (Array.isArray(item)) {
    return JSON.stringify(["__list__", item.map((x) => comparisonKey(x, undefined))]);
  }
  if (isPlainObject(item)) {
    const entries = Object.entries(item)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, comparisonKey(v, undefined)]);
    return JSON.stringify(["__dict__", entries]);
  }
  throw new TypeError(
    `unhashable item ${String(item)}; set itemKey on the merge rule or use concat instead`,
  );
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function patternMatchDepth(pattern: string, path: Path): number | null {
  const patternParts = pattern.split(".").filter(Boolean);
  if (!patternParts.length) return path.length ? null : 0;

  if (patternParts[0] === "**") {
    const suffix = patternParts.slice(1);
    if (!suffix.length) return path.length;
    let best: number | null = null;
    for (let start = 0; start <= path.length; start++) {
      if (suffixMatch(suffix, path.slice(start))) {
        const depth = start + suffix.length;
        if (best === null || depth > best) best = depth;
      }
    }
    return best;
  }

  if (patternParts.length > path.length) return null;
  const offset = path.length - patternParts.length;
  if (suffixMatch(patternParts, path.slice(offset))) return patternParts.length;
  return null;
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

function pathLabel(path: Path): string {
  if (!path.length) return "<root>";
  return path.map(String).join(".");
}

export function buildMergeTypeScript(policy: MergePolicy | undefined, custom?: string): string {
  const trimmed = custom?.trim();
  if (trimmed) {
    return trimmed.startsWith("(") || trimmed.startsWith("input") ? trimmed : `(input) => (${trimmed})`;
  }
  const policyJson = JSON.stringify(policy ?? DEFAULT_MERGE_POLICY);
  return `${mergeRuntimeHelpers()}
const __mergePair = ${mergePairSource()};
const __resolve = ${policyResolverSource()};
(input) => {
  const resolver = new __resolve(${policyJson});
  const values = Array.isArray(input) ? input.filter((v) => v != null) : (input != null ? [input] : []);
  if (!values.length) return null;
  if (values.length === 1) return values[0];
  let result = values[0];
  for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);
  return result;
}`;
}

// AI : inlined runtime for browser new Function() — keep in sync with mergePair / resolver above.
function mergePairSource(): string {
  return `function(left, right, resolver, path) {
  if (left == null) return right;
  if (right == null) return left;
  const layer = resolver.resolve(path);
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const isScalar = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  if (isObj(left) && isObj(right)) {
    if (layer.dict === "replace") return { ...right };
    if (layer.dict === "shallow") return { ...left, ...right };
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const out = {};
    for (const key of keys) {
      const child = [...path, key];
      if (key in left && key in right) out[key] = __mergePair(left[key], right[key], resolver, child);
      else out[key] = key in left ? left[key] : right[key];
    }
    return out;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const s = layer.list;
    if (s === "replace") return [...right];
    if (s === "prepend") return [...right, ...left];
    if (s === "concat") return [...left, ...right];
    if (s === "concat_dedupe") return __dedupe([...left, ...right], layer.keyFn);
    if (s === "concat_assert_no_duplicates") return __assertNoDupes([...left, ...right], layer.keyFn, path);
    if (s === "union") return __setOp(left, right, layer.keyFn, "union");
    if (s === "intersect") return __setOp(left, right, layer.keyFn, "intersect");
    throw new Error("unknown list strategy: " + s);
  }
  if (isScalar(left) && isScalar(right)) {
    if (layer.scalar === "first") return left;
    if (layer.scalar === "last") return right;
    throw new TypeError("scalar conflict");
  }
  if (typeof left === typeof right) return layer.scalar === "first" ? left : right;
  throw new TypeError("cannot merge " + typeof left + " with " + typeof right);
}`;
}

function policyResolverSource(): string {
  return `class {
  constructor(policy) {
    const def = policy?.default ?? {};
    this.default = {
      list: def.list ?? "concat",
      dict: def.dict ?? "deep",
      scalar: def.scalar ?? "last",
      keyFn: def.itemKey ? (item) => item[def.itemKey] : undefined,
    };
    this.rules = (policy?.rules ?? []).map((r) => ({
      pattern: r.path,
      policy: {
        list: r.policy?.list ?? this.default.list,
        dict: r.policy?.dict ?? this.default.dict,
        scalar: r.policy?.scalar ?? this.default.scalar,
        keyFn: r.policy?.itemKey ? (item) => item[r.policy.itemKey] : undefined,
      },
    }));
  }
  resolve(path) {
    let matched, depth = -1;
    for (const { pattern, policy } of this.rules) {
      const d = __patternDepth(pattern, path);
      if (d != null && d > depth) { matched = policy; depth = d; }
    }
    return matched ?? this.default;
  }
}`;
}

// AI : helper fns referenced by generated mergePair source — appended in buildMergeTypeScript wrapper.
export function mergeRuntimeHelpers(): string {
  return `
function __cmpKey(item, keyFn) {
  if (keyFn) return keyFn(item);
  if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
  return JSON.stringify(item);
}
function __dedupe(items, keyFn) {
  const seen = new Set(), out = [];
  for (const item of items) {
    const k = __cmpKey(item, keyFn);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
function __assertNoDupes(items, keyFn, path) {
  const seen = new Set(), out = [];
  const label = path.length ? path.join(".") : "<root>";
  for (const item of items) {
    const k = __cmpKey(item, keyFn);
    if (seen.has(k)) throw new TypeError("duplicate list item at path " + label + " (key=" + String(k) + ")");
    seen.add(k);
    out.push(item);
  }
  return out;
}
function __setOp(left, right, keyFn, op) {
  const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
  const ls = new Set(lk), rs = new Set(rk);
  const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
  const order = [];
  const seen = new Set();
  for (const k of [...lk, ...rk]) {
    if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
  }
  const map = new Map();
  left.forEach((item, i) => map.set(lk[i], item));
  right.forEach((item, i) => map.set(rk[i], item));
  return order.map((k) => map.get(k));
}
function __suffixMatch(pattern, path) {
  if (pattern.length !== path.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
  }
  return true;
}
function __patternDepth(pattern, path) {
  const parts = pattern.split(".").filter(Boolean);
  if (!parts.length) return path.length ? null : 0;
  if (parts[0] === "**") {
    const suffix = parts.slice(1);
    if (!suffix.length) return path.length;
    let best = null;
    for (let start = 0; start <= path.length; start++) {
      if (__suffixMatch(suffix, path.slice(start))) {
        const d = start + suffix.length;
        if (best == null || d > best) best = d;
      }
    }
    return best;
  }
  if (parts.length > path.length) return null;
  const offset = path.length - parts.length;
  return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
}`;
}

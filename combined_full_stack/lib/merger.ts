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

const DEFAULT_MERGE_LAYER: MergeLayerPolicy = {
  list: MergeListStrategy.Concat,
  dict: MergeDictStrategy.Deep,
  scalar: MergeScalarStrategy.Last,
};

const DEFAULT_LAYER: ResolvedLayerPolicy = {
  list: DEFAULT_MERGE_LAYER.list ?? MergeListStrategy.Concat,
  dict: DEFAULT_MERGE_LAYER.dict ?? MergeDictStrategy.Deep,
  scalar: DEFAULT_MERGE_LAYER.scalar ?? MergeScalarStrategy.Last,
  keyFn: undefined,
};

export const DEFAULT_MERGE_POLICY: MergePolicy = {
  default: DEFAULT_MERGE_LAYER,
};

export const EMPTY_MERGE_LAYER_POLICY: MergeLayerPolicy = DEFAULT_MERGE_LAYER;

function resolveLayer(raw: MergeLayerPolicy | undefined): ResolvedLayerPolicy {
  return {
    list: raw?.list ?? DEFAULT_LAYER.list,
    dict: raw?.dict ?? DEFAULT_LAYER.dict,
    scalar: raw?.scalar ?? DEFAULT_LAYER.scalar,
    keyFn: raw?.itemKey ? itemKeyFn(raw.itemKey) : undefined,
  };
}

function itemKeyFn(keyPath: string): KeyFn {
  const parts = keyPath.split(".").filter(Boolean);
  return (item: unknown) => {
    let cur: unknown = item;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || Array.isArray(cur) || !(part in (cur as object))) {
        throw new TypeError(`itemKey "${keyPath}" missing on ${JSON.stringify(item)}`);
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (cur === undefined || cur === null) {
      throw new TypeError(`itemKey "${keyPath}" missing on ${JSON.stringify(item)}`);
    }
    if (typeof cur === "object") {
      throw new TypeError(`itemKey "${keyPath}" must be a scalar, got ${JSON.stringify(cur)}`);
    }
    return cur as ComparisonKey;
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
    return mergeLists(left, right, resolver, path, layer);
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

function mergeLists(
  left: unknown[],
  right: unknown[],
  resolver: MergePolicyResolver,
  path: Path,
  layer: ResolvedLayerPolicy,
): unknown[] {
  const strategy = layer.list;

  if (strategy === MergeListStrategy.Replace) return [...right];
  if (strategy === MergeListStrategy.Prepend) return [...right, ...left];
  if (strategy === MergeListStrategy.Concat) return [...left, ...right];
  if (strategy === MergeListStrategy.Zip) return zipMergeLists(left, right, resolver, path);
  if (strategy === MergeListStrategy.ConcatDedupe) {
    return dedupeMergeOrder([...left, ...right], layer.keyFn, resolver, path);
  }
  if (strategy === MergeListStrategy.ConcatAssertNoDuplicates) {
    return assertNoDuplicates([...left, ...right], layer.keyFn, path);
  }
  if (strategy === MergeListStrategy.Union) {
    return setOpLists(left, right, layer.keyFn, resolver, path, "union");
  }
  if (strategy === MergeListStrategy.UnionAssert) {
    return assertUnionNoOverlap(left, right, layer.keyFn, path);
  }
  if (strategy === MergeListStrategy.Intersect) {
    return setOpLists(left, right, layer.keyFn, resolver, path, "intersect");
  }
  if (strategy === MergeListStrategy.IntersectAssert) {
    return assertIntersectSubset(left, right, layer.keyFn, path);
  }
  if (strategy === MergeListStrategy.ReplaceAssert) {
    return assertReplaceEmptyLeft(left, right, path);
  }
  if (strategy === MergeListStrategy.PrependAssert) {
    return assertPrependEmptyRight(left, right, path);
  }

  throw new Error(`unknown list strategy: ${strategy}`);
}

function pathForListItem(path: Path, ck: ComparisonKey, index: number): Path {
  // AI : prefer stable identity so rules like users.*.roles / users.alice.roles work
  if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
  return [...path, index];
}

function zipMergeLists(
  left: unknown[],
  right: unknown[],
  resolver: MergePolicyResolver,
  path: Path,
): unknown[] {
  const n = Math.max(left.length, right.length);
  const out: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const child: Path = [...path, i];
    if (i < left.length && i < right.length) {
      out.push(mergePair(left[i], right[i], resolver, child));
    } else if (i < left.length) {
      out.push(left[i]);
    } else {
      out.push(right[i]);
    }
  }
  return out;
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
  resolver: MergePolicyResolver,
  path: Path,
  op: "union" | "intersect",
): unknown[] {
  // AI : matching keys recursively merge so nested path policies still apply
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
  const keyIndex = new Map<ComparisonKey, number>();
  for (let i = 0; i < left.length; i++) {
    const ck = leftKeys[i]!;
    if (!keyToItem.has(ck)) {
      keyToItem.set(ck, left[i]);
      keyIndex.set(ck, i);
    } else {
      const child = pathForListItem(path, ck, keyIndex.get(ck)!);
      keyToItem.set(ck, mergePair(keyToItem.get(ck), left[i], resolver, child));
    }
  }
  for (let i = 0; i < right.length; i++) {
    const ck = rightKeys[i]!;
    if (!keyToItem.has(ck)) {
      keyToItem.set(ck, right[i]);
      keyIndex.set(ck, left.length + i);
    } else {
      const child = pathForListItem(path, ck, keyIndex.get(ck)!);
      keyToItem.set(ck, mergePair(keyToItem.get(ck), right[i], resolver, child));
    }
  }

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

function dedupeMergeOrder(
  items: unknown[],
  keyFn: KeyFn | undefined,
  resolver: MergePolicyResolver,
  path: Path,
): unknown[] {
  const seen = new Map<ComparisonKey, number>();
  const out: unknown[] = [];
  for (const item of items) {
    const ck = comparisonKey(item, keyFn);
    if (seen.has(ck)) {
      const idx = seen.get(ck)!;
      const child = pathForListItem(path, ck, idx);
      out[idx] = mergePair(out[idx], item, resolver, child);
      continue;
    }
    seen.set(ck, out.length);
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

function assertUnionNoOverlap(
  left: unknown[],
  right: unknown[],
  keyFn: KeyFn | undefined,
  path: Path,
): unknown[] {
  const leftKeys = left.map((item) => comparisonKey(item, keyFn));
  const leftSet = new Set(leftKeys);
  for (let i = 0; i < right.length; i++) {
    const ck = comparisonKey(right[i]!, keyFn);
    if (leftSet.has(ck)) {
      throw new TypeError(
        `union key overlap at path ${pathLabel(path)} (key=${String(ck)})`,
      );
    }
  }
  return [...left, ...right];
}

function assertIntersectSubset(
  left: unknown[],
  right: unknown[],
  keyFn: KeyFn | undefined,
  path: Path,
): unknown[] {
  const rightSet = new Set(right.map((item) => comparisonKey(item, keyFn)));
  for (const item of left) {
    const ck = comparisonKey(item, keyFn);
    if (!rightSet.has(ck)) {
      throw new TypeError(
        `intersect: left item not in right at path ${pathLabel(path)} (key=${String(ck)})`,
      );
    }
  }
  return left;
}

function assertReplaceEmptyLeft(left: unknown[], right: unknown[], path: Path): unknown[] {
  if (left.length) {
    throw new TypeError(
      `replace assert: left list must be empty at path ${pathLabel(path)} (got ${left.length} items)`,
    );
  }
  return [...right];
}

function assertPrependEmptyRight(left: unknown[], right: unknown[], path: Path): unknown[] {
  if (right.length) {
    throw new TypeError(
      `prepend assert: right list must be empty at path ${pathLabel(path)} (got ${right.length} items)`,
    );
  }
  return [...left];
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
  if (patternParts.includes("**")) return globstarMatchDepth(patternParts, path);
  if (patternParts.length > path.length) return null;
  const offset = path.length - patternParts.length;
  if (suffixMatch(patternParts, path.slice(offset))) return patternParts.length;
  return null;
}

function globstarMatchDepth(pattern: string[], path: Path): number | null {
  return globstarMatchFrom(pattern, path, 0, 0);
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

function pathLabel(path: Path): string {
  if (!path.length) return "<root>";
  return path.map(String).join(".");
}

export type MergeCodegenOptions = {
  stateLabel?: string;
  wrapListField?: string;
};

function mergeFoldBody(policyJson: string, valuesExpr: string, reuseValues = false): string {
  const valuesLine = reuseValues ? "" : `  const values = ${valuesExpr};\n`;
  return `${valuesLine}  const resolver = new __resolve(${policyJson});
  if (!values.length) return null;
  if (values.length === 1) return values[0];
  let result = values[0];
  for (let i = 1; i < values.length; i++) result = __mergePair(result, values[i], resolver, []);
  return result;`;
}

export function buildMergeTypeScript(
  policy: MergePolicy | undefined,
  custom?: string,
  opts?: MergeCodegenOptions,
): string {
  const trimmed = custom?.trim();
  if (trimmed) {
    return trimmed.startsWith("(") || trimmed.startsWith("input") ? trimmed : `(input) => (${trimmed})`;
  }
  const policyJson = JSON.stringify(policy ?? DEFAULT_MERGE_POLICY);
  const stateLabel = opts?.stateLabel?.trim();
  const wrapField = opts?.wrapListField?.trim();
  const runtime = `${mergeRuntimeHelpers()}
const __mergePair = ${mergePairSource()};
const __resolve = ${policyResolverSource()};`;

  if (stateLabel || wrapField) {
    const wrapKey = wrapField ? JSON.stringify(wrapField) : '""';
    const stateKey = stateLabel ? JSON.stringify(stateLabel) : '""';
    return `${runtime}
(input, state) => {
  let spine = input;
  if (${wrapKey} && Array.isArray(spine)) spine = { [${wrapKey}]: spine };
  const values = [];
  if (${stateKey}) {
    const fromState = (state ?? {})[${stateKey}];
    if (fromState != null) values.push(fromState);
  }
  if (spine != null) values.push(spine);
${mergeFoldBody(policyJson, "values", true)}
}`;
  }

  return `${runtime}
(input) => {
${mergeFoldBody(
  policyJson,
  "Array.isArray(input) ? input.filter((v) => v != null) : (input != null ? [input] : [])",
)}
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
    if (s === "zip") return __zipMerge(left, right, resolver, path);
    if (s === "concat_dedupe") return __dedupeMerge([...left, ...right], layer.keyFn, resolver, path);
    if (s === "concat_assert_no_duplicates") return __assertNoDupes([...left, ...right], layer.keyFn, path);
    if (s === "union") return __setOp(left, right, layer.keyFn, resolver, path, "union");
    if (s === "union_assert") return __assertUnionNoOverlap(left, right, layer.keyFn, path);
    if (s === "intersect") return __setOp(left, right, layer.keyFn, resolver, path, "intersect");
    if (s === "intersect_assert") return __assertIntersectSubset(left, right, layer.keyFn, path);
    if (s === "replace_assert") return __assertReplaceEmptyLeft(left, right, path);
    if (s === "prepend_assert") return __assertPrependEmptyRight(left, right, path);
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
      keyFn: def.itemKey ? __itemKeyFn(def.itemKey) : undefined,
    };
    this.rules = (policy?.rules ?? []).map((r) => ({
      pattern: r.path,
      policy: {
        list: r.policy?.list ?? this.default.list,
        dict: r.policy?.dict ?? this.default.dict,
        scalar: r.policy?.scalar ?? this.default.scalar,
        keyFn: r.policy?.itemKey ? __itemKeyFn(r.policy.itemKey) : undefined,
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
function __itemKeyFn(keyPath) {
  const parts = String(keyPath).split(".").filter(Boolean);
  return (item) => {
    let cur = item;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || !(part in cur)) throw new TypeError("itemKey \\"" + keyPath + "\\" missing");
      cur = cur[part];
    }
    if (cur == null) throw new TypeError("itemKey \\"" + keyPath + "\\" missing");
    return cur;
  };
}
function __cmpKey(item, keyFn) {
  if (keyFn) return keyFn(item);
  if (item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return item;
  return JSON.stringify(item);
}
function __pathForItem(path, ck, index) {
  if (typeof ck === "string" || typeof ck === "number") return [...path, ck];
  return [...path, index];
}
function __zipMerge(left, right, resolver, path) {
  const n = Math.max(left.length, right.length), out = [];
  for (let i = 0; i < n; i++) {
    const child = [...path, i];
    if (i < left.length && i < right.length) out.push(__mergePair(left[i], right[i], resolver, child));
    else out.push(i < left.length ? left[i] : right[i]);
  }
  return out;
}
function __dedupeMerge(items, keyFn, resolver, path) {
  const seen = new Map(), out = [];
  for (const item of items) {
    const k = __cmpKey(item, keyFn);
    if (seen.has(k)) {
      const idx = seen.get(k);
      out[idx] = __mergePair(out[idx], item, resolver, __pathForItem(path, k, idx));
      continue;
    }
    seen.set(k, out.length);
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
function __setOp(left, right, keyFn, resolver, path, op) {
  const lk = left.map((i) => __cmpKey(i, keyFn)), rk = right.map((i) => __cmpKey(i, keyFn));
  const ls = new Set(lk), rs = new Set(rk);
  const wanted = op === "union" ? new Set([...ls, ...rs]) : new Set([...lk].filter((k) => rs.has(k)));
  const order = [];
  const seen = new Set();
  for (const k of [...lk, ...rk]) {
    if (wanted.has(k) && !seen.has(k)) { seen.add(k); order.push(k); }
  }
  const map = new Map(), idx = new Map();
  left.forEach((item, i) => {
    const k = lk[i];
    if (!map.has(k)) { map.set(k, item); idx.set(k, i); }
    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
  });
  right.forEach((item, i) => {
    const k = rk[i];
    if (!map.has(k)) { map.set(k, item); idx.set(k, left.length + i); }
    else map.set(k, __mergePair(map.get(k), item, resolver, __pathForItem(path, k, idx.get(k))));
  });
  return order.map((k) => map.get(k));
}
function __assertUnionNoOverlap(left, right, keyFn, path) {
  const lk = left.map((i) => __cmpKey(i, keyFn));
  const ls = new Set(lk);
  const label = path.length ? path.join(".") : "<root>";
  for (const item of right) {
    const k = __cmpKey(item, keyFn);
    if (ls.has(k)) throw new TypeError("union key overlap at path " + label + " (key=" + String(k) + ")");
  }
  return [...left, ...right];
}
function __assertIntersectSubset(left, right, keyFn, path) {
  const rs = new Set(right.map((i) => __cmpKey(i, keyFn)));
  const label = path.length ? path.join(".") : "<root>";
  for (const item of left) {
    const k = __cmpKey(item, keyFn);
    if (!rs.has(k)) throw new TypeError("intersect: left item not in right at path " + label + " (key=" + String(k) + ")");
  }
  return left;
}
function __assertReplaceEmptyLeft(left, right, path) {
  const label = path.length ? path.join(".") : "<root>";
  if (left.length) throw new TypeError("replace assert: left list must be empty at path " + label + " (got " + left.length + " items)");
  return [...right];
}
function __assertPrependEmptyRight(left, right, path) {
  const label = path.length ? path.join(".") : "<root>";
  if (right.length) throw new TypeError("prepend assert: right list must be empty at path " + label + " (got " + right.length + " items)");
  return [...left];
}
function __suffixMatch(pattern, path) {
  if (pattern.length !== path.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== "*" && String(pattern[i]) !== String(path[i])) return false;
  }
  return true;
}
function __globstarFrom(pattern, path, pi, si) {
  if (pi === pattern.length) return si === path.length ? path.length : null;
  if (pattern[pi] === "**") {
    let best = null;
    for (let span = si; span <= path.length; span++) {
      const d = __globstarFrom(pattern, path, pi + 1, span);
      if (d != null && (best == null || d > best)) best = d;
    }
    return best;
  }
  if (si >= path.length) return null;
  if (pattern[pi] !== "*" && String(pattern[pi]) !== String(path[si])) return null;
  return __globstarFrom(pattern, path, pi + 1, si + 1);
}
function __patternDepth(pattern, path) {
  const parts = pattern.split(".").filter(Boolean);
  if (!parts.length) return path.length ? null : 0;
  if (parts.includes("**")) return __globstarFrom(parts, path, 0, 0);
  if (parts.length > path.length) return null;
  const offset = path.length - parts.length;
  return __suffixMatch(parts, path.slice(offset)) ? parts.length : null;
}`;
}

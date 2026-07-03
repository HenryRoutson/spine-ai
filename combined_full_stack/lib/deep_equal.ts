// AI : stable deep equality for assert steps — ignores key order; optional key stripping.

import { tryParseJson } from "@/lib/json-utils";

export type DeepEqualOpts = {
  ignoreKeys?: string[];
};

// AI : document.content often holds JSON.stringify output — expand object/array strings so key order does not fail tests.
function expandEmbeddedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expandEmbeddedJson);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = expandEmbeddedJson(v);
    }
    return out;
  }
  if (typeof value !== "string") return value;
  const parsed = tryParseJson(value, { trim: true });
  if (!parsed.ok || parsed.value === null || typeof parsed.value !== "object") return value;
  return expandEmbeddedJson(parsed.value);
}

function stripIgnoredKeys(value: unknown, ignore: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((v) => stripIgnoredKeys(v, ignore));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (ignore.has(k)) continue;
      out[k] = stripIgnoredKeys(v, ignore);
    }
    return out;
  }
  return value;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
    return out;
  }
  return value;
}

export function deepEqual(a: unknown, b: unknown, opts?: DeepEqualOpts): boolean {
  const ignore = new Set(opts?.ignoreKeys ?? []);
  const left = sortKeys(stripIgnoredKeys(expandEmbeddedJson(a), ignore));
  const right = sortKeys(stripIgnoredKeys(expandEmbeddedJson(b), ignore));
  return JSON.stringify(left) === JSON.stringify(right);
}

export function deepEqualDiffPath(a: unknown, b: unknown, path = ""): string | undefined {
  if (a === b) return undefined;
  if (typeof a !== typeof b) return path || "(root)";
  if (a === null || b === null) return path || "(root)";
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length`;
    for (let i = 0; i < a.length; i++) {
      const d = deepEqualDiffPath(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return undefined;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of [...keys].sort()) {
      if (!(k in ao) || !(k in bo)) return path ? `${path}.${k}` : k;
      const d = deepEqualDiffPath(ao[k], bo[k], path ? `${path}.${k}` : k);
      if (d) return d;
    }
    return undefined;
  }
  if (typeof a === "string" && typeof b === "string") {
    const expandedA = expandEmbeddedJson(a);
    const expandedB = expandEmbeddedJson(b);
    if (expandedA !== a || expandedB !== b) return deepEqualDiffPath(expandedA, expandedB, path);
    return a === b ? undefined : path || "(root)";
  }
  return path || "(root)";
}

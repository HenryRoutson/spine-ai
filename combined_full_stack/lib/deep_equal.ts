// AI : stable deep equality for assert steps — ignores key order; optional key stripping.

export type DeepEqualOpts = {
  ignoreKeys?: string[];
};

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
  const left = sortKeys(stripIgnoredKeys(a, ignore));
  const right = sortKeys(stripIgnoredKeys(b, ignore));
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
  return path || "(root)";
}

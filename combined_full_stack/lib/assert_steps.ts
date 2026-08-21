import type { CustomCodeLanguage, PipelineModule } from "@/lib/types";
import { parseCustomCodeEntry, type ParsedCustomCodeEntry } from "@/lib/custom_code_entries";
import { deepEqual, deepEqualDiffPath, type DeepEqualOpts } from "@/lib/deep_equal";

// AI : assert steps read prior step outputs via step["Label"] / state["Label"] and pass the spine through unchanged.
// AI : expected(label) reads golden JSON from seed expectedOutputs — wired through ClientStepSpec at run time.
export type ExpectedOutputsMap = Record<string, unknown>;

export function parseAssertReferencedLabels(code: string): string[] {
  const labels = new Set<string>();
  const bracketRe = /(?:step|state)\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;
  const callRe = /(?:step|state)\s*\(\s*(["'`])([^"'`]+)\1\s*\)/g;
  for (const m of code.matchAll(bracketRe)) labels.add(m[2]!);
  for (const m of code.matchAll(callRe)) labels.add(m[2]!);
  return [...labels];
}

export function assertEntriesForModule(m: PipelineModule): ParsedCustomCodeEntry[] {
  if (m.kind !== "assert") return [];
  return (m.fallbackList ?? []).map(parseCustomCodeEntry).filter((e): e is ParsedCustomCodeEntry => e !== null);
}

function assertHelpersNeeded(code: string): Set<string> {
  const needs = new Set<string>();
  if (/\bstep\s*\(/.test(code)) needs.add("step");
  if (/\blen\s*\(/.test(code)) needs.add("len");
  if (/\bassert\s*\(/.test(code)) needs.add("assert");
  if (/\bassertEqual\s*\(/.test(code)) {
    needs.add("assertEqual");
    needs.add("expected");
    needs.add("deepEqual");
    needs.add("stripKeys");
  }
  if (/\bexpected\s*\(/.test(code)) needs.add("expected");
  if (/\bstripKeys\s*\(/.test(code)) needs.add("stripKeys");
  if (/\b__deepEqual\s*\(/.test(code)) needs.add("deepEqual");
  return needs;
}

function assertHelpersTs(expectationsLiteral: string, code: string, typed: boolean): string {
  const needs = assertHelpersNeeded(code);
  const parts: string[] = [];
  if (needs.has("expected") || needs.has("assertEqual")) {
    parts.push(`const expectations = ${expectationsLiteral};`);
  }

  if (needs.has("step")) {
    parts.push(typed
      ? `const step = (label: string): any => {
  if (!(label in state)) throw new Error(\`assert: unknown step label "\${label}"\`);
  return (state as Record<string, unknown>)[label];
};`
      : `const step = (label) => {
  if (!(label in state)) throw new Error(\`assert: unknown step label "\${label}"\`);
  return state[label];
};`);
  }

  if (needs.has("expected")) {
    parts.push(typed
      ? `const expected = (label: string): any => {
  if (!(label in expectations)) throw new Error(\`assert: no expected output for step "\${label}"\`);
  return (expectations as Record<string, unknown>)[label];
};`
      : `const expected = (label) => {
  if (!(label in expectations)) throw new Error(\`assert: no expected output for step "\${label}"\`);
  return expectations[label];
};`);
  }

  if (needs.has("len")) {
    parts.push(typed
      ? `const len = (v: unknown, key?: string): number => {
  const x =
    key !== undefined && v !== null && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)[key]
      : v;
  if (Array.isArray(x)) return x.length;
  if (x == null) return 0;
  if (typeof x === "string") return x.length;
  return 1;
};`
      : `const len = (v, key) => {
  const x =
    key !== undefined && v !== null && typeof v === "object" && !Array.isArray(v)
      ? v[key]
      : v;
  if (Array.isArray(x)) return x.length;
  if (x == null) return 0;
  if (typeof x === "string") return x.length;
  return 1;
};`);
  }

  if (needs.has("assert")) {
    parts.push(typed
      ? `const assert = (cond: unknown, msg?: string): void => {
  if (!cond) throw new Error(msg ?? "assert failed");
};`
      : `const assert = (cond, msg) => {
  if (!cond) throw new Error(msg ?? "assert failed");
};`);
  }

  if (needs.has("stripKeys")) {
    parts.push(typed
      ? `const stripKeys = (v: unknown, keys: string | string[]): unknown => {
  const ignore = new Set(Array.isArray(keys) ? keys : [keys]);
  if (Array.isArray(v)) return v.map((x) => stripKeys(x, [...ignore]));
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (ignore.has(k)) continue;
      out[k] = stripKeys(val, [...ignore]);
    }
    return out;
  }
  return v;
};`
      : `const stripKeys = (v, keys) => {
  const ignore = new Set(Array.isArray(keys) ? keys : [keys]);
  if (Array.isArray(v)) return v.map((x) => stripKeys(x, [...ignore]));
  if (v !== null && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (ignore.has(k)) continue;
      out[k] = stripKeys(val, [...ignore]);
    }
    return out;
  }
  return v;
};`);
  }

  if (needs.has("assertEqual")) {
    parts.push(typed
      ? `const assertEqual = (actual: unknown, expOrLabel: unknown, ignoreKeys?: string[]): void => {
  const exp = typeof expOrLabel === "string" ? expected(expOrLabel) : expOrLabel;
  const left = ignoreKeys?.length ? stripKeys(actual, ignoreKeys) : actual;
  const right = ignoreKeys?.length ? stripKeys(exp, ignoreKeys) : exp;
  if (!__deepEqual(left, right)) {
    throw new Error(\`assertEqual failed\${typeof expOrLabel === "string" ? \` for "\${expOrLabel}"\` : ""}\`);
  }
};`
      : `const assertEqual = (actual, expOrLabel, ignoreKeys) => {
  const exp = typeof expOrLabel === "string" ? expected(expOrLabel) : expOrLabel;
  const left = ignoreKeys?.length ? stripKeys(actual, ignoreKeys) : actual;
  const right = ignoreKeys?.length ? stripKeys(exp, ignoreKeys) : exp;
  if (!__deepEqual(left, right)) {
    throw new Error(\`assertEqual failed\${typeof expOrLabel === "string" ? \` for "\${expOrLabel}"\` : ""}\`);
  }
};`);
  }

  return `\n${parts.join("\n")}\n`;
}

// AI : injected into browser assert fn — mirrors lib/deep_equal.ts without importing it in new Function().
const DEEP_EQUAL_FN = `
function __deepEqual(a, b) {
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v !== null && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}
`;

const DEEP_EQUAL_FN_TYPED = `
function __deepEqual(a: unknown, b: unknown): boolean {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}
`;

function withAssertSuccessReturn(body: string): string {
  if (/\breturn\s+true\b/.test(body)) return body;
  return body.replace(/\}\s*$/, "  return true;\n}");
}

function wrapAssertTypeScriptInner(
  code: string,
  expectations: ExpectedOutputsMap,
  typed: boolean,
  inputTs = "unknown",
): string {
  const helpers = assertHelpersTs(JSON.stringify(expectations), code, typed);
  const needsDeepEqual = assertHelpersNeeded(code).has("deepEqual");
  const deepEqualFn = needsDeepEqual ? (typed ? DEEP_EQUAL_FN_TYPED : DEEP_EQUAL_FN) : "";
  const trimmed = code.trim();
  const inputParam = typed && !/\binput\b/.test(trimmed) ? "_input" : "input";
  const stateParam = typed && !/\b(state|step)\b/.test(trimmed) ? "_state" : "state";
  const params = typed ? `(${inputParam}: ${inputTs}, ${stateParam}: PipelineState)` : "(input, state)";

  if (!trimmed) return `${params} => {${deepEqualFn}${helpers} return true; }`;
  if (/^\s*\(/.test(trimmed)) {
    if (trimmed.includes("const step =") || trimmed.includes("function step(")) {
      return typed
        ? `${params} => {${deepEqualFn}${helpers}${withAssertSuccessReturn(trimmed.replace(/^\(\s*([^)]*)\s*\)\s*=>\s*\{?/, "").replace(/\}\s*$/, ""))}}`
        : withAssertSuccessReturn(trimmed);
    }
    if (typed) {
      const inner = trimmed.replace(/^\(\s*([^)]*)\s*\)\s*=>\s*\{/, `{${deepEqualFn}${helpers}`);
      return `${params} => ${withAssertSuccessReturn(inner)}`;
    }
    return withAssertSuccessReturn(
      trimmed.replace(/^\(\s*([^)]*)\)\s*=>\s*\{/, `($1) => {${deepEqualFn}${helpers}`),
    );
  }
  return `${params} => {${deepEqualFn}${helpers}
${trimmed}
  return true;
}`;
}

export function wrapAssertTypeScript(code: string, expectations: ExpectedOutputsMap = {}): string {
  return wrapAssertTypeScriptInner(code, expectations, false);
}

// AI : typed wrapper for pipeline TS export — must stay valid under tsc strict + noUnusedLocals.
export function wrapAssertTypeScriptForExport(
  code: string,
  expectations: ExpectedOutputsMap = {},
  inputTs = "unknown",
): string {
  return wrapAssertTypeScriptInner(code, expectations, true, inputTs);
}

// AI : Python assert — never shadow builtin len; user code uses len_of().
export function wrapAssertPython(code: string, expectations: ExpectedOutputsMap = {}): string {
  const trimmed = code.trim();
  const expectationsLiteral = JSON.stringify(expectations);
  const helpers = `import json
_builtin_len = len
expectations = json.loads(${JSON.stringify(expectationsLiteral)})

def _assert_step(state, label):
    if label not in state:
        raise ValueError(f'assert: unknown step label "{label}"')
    return state[label]

def _assert_expected(label):
    if label not in expectations:
        raise ValueError(f'assert: no expected output for step "{label}"')
    return expectations[label]

def _assert_len_of(v, key=None):
    x = v.get(key) if key is not None and isinstance(v, dict) else v
    if isinstance(x, list):
        return _builtin_len(x)
    if x is None:
        return 0
    if isinstance(x, str):
        return _builtin_len(x)
    return 1

def _assert_equal(actual, exp_or_label, ignore_keys=None):
    exp = _assert_expected(exp_or_label) if isinstance(exp_or_label, str) else exp_or_label
    ignore = set(ignore_keys or [])
    def strip(v):
        if isinstance(v, list):
            return [strip(x) for x in v]
        if isinstance(v, dict):
            return {k: strip(val) for k, val in v.items() if k not in ignore}
        return v
    left = strip(actual) if ignore else actual
    right = strip(exp) if ignore else exp
    if json.dumps(left, sort_keys=True, default=str) != json.dumps(right, sort_keys=True, default=str):
        raise ValueError(f'assertEqual failed for {exp_or_label!r}')

expected = _assert_expected
assert_equal = _assert_equal
`;
  const body = trimmed
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : ""))
    .join("\n");
  if (/^\s*def\s+transform\s*\(/.test(trimmed)) {
    if (trimmed.includes("_assert_step")) return trimmed;
    return `${helpers}\n${trimmed}`;
  }
  return `${helpers}
def transform(input, state=None):
    state = state or {}
    step = lambda label: _assert_step(state, label)
    len_of = _assert_len_of
${body}
    return True
`;
}

export function wrapAssertCode(
  code: string,
  language: CustomCodeLanguage,
  expectations: ExpectedOutputsMap = {},
): string {
  return language === "python" ? wrapAssertPython(code, expectations) : wrapAssertTypeScript(code, expectations);
}

// AI : server-side helper for scripts validating fixture files.
export function assertDeepEqual(actual: unknown, expected: unknown, opts?: DeepEqualOpts): void {
  if (!deepEqual(actual, expected, opts)) {
    const path = deepEqualDiffPath(actual, expected);
    throw new Error(`assertDeepEqual failed${path ? ` at ${path}` : ""}`);
  }
}

export const DEFAULT_ASSERT_TS = `const nStudents = len(step("Student Submissions"));
const nQuestions = len(step("Marking Questions List"));
const nOut = len(step("Final Output"));
if (nStudents * nQuestions !== nOut) {
  throw new Error(\`expected \${nStudents}×\${nQuestions}=\${nStudents * nQuestions} grades, got \${nOut}\`);
}`;

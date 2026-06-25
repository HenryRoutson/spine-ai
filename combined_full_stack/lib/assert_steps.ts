import type { CustomCodeLanguage, PipelineModule } from "@/lib/types";
import { parseCustomCodeEntry, type ParsedCustomCodeEntry } from "@/lib/custom_code_entries";

// AI : assert steps read prior step outputs via step["Label"] / state["Label"] and pass the spine through unchanged.

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

const ASSERT_HELPERS_TS = `
const step = (label) => {
  if (!(label in state)) throw new Error(\`assert: unknown step label "\${label}"\`);
  return state[label];
};
const len = (v, key) => {
  const x =
    key !== undefined && v !== null && typeof v === "object" && !Array.isArray(v)
      ? v[key]
      : v;
  if (Array.isArray(x)) return x.length;
  if (x == null) return 0;
  if (typeof x === "string") return x.length;
  return 1;
};
`;

export function wrapAssertTypeScript(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "(input, state) => {}";
  if (/^\s*\(/.test(trimmed)) {
    if (trimmed.includes("const step =") || trimmed.includes("function step(")) return trimmed;
    return trimmed.replace(/^\(\s*([^)]*)\)\s*=>\s*\{/, `($1) => {${ASSERT_HELPERS_TS}`);
  }
  return `(input, state) => {${ASSERT_HELPERS_TS}
${trimmed}
}`;
}

// AI : Python assert — never shadow builtin len; user code uses len_of().
export function wrapAssertPython(code: string): string {
  const trimmed = code.trim();
  const helpers = `_builtin_len = len

def _assert_step(state, label):
    if label not in state:
        raise ValueError(f'assert: unknown step label "{label}"')
    return state[label]

def _assert_len_of(v, key=None):
    x = v.get(key) if key is not None and isinstance(v, dict) else v
    if isinstance(x, list):
        return _builtin_len(x)
    if x is None:
        return 0
    if isinstance(x, str):
        return _builtin_len(x)
    return 1
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

export function wrapAssertCode(code: string, language: CustomCodeLanguage): string {
  return language === "python" ? wrapAssertPython(code) : wrapAssertTypeScript(code);
}

export const DEFAULT_ASSERT_TS = `const nStudents = len(step("Student Submissions"));
const nQuestions = len(step("Marking Questions List"));
const nOut = len(step("Final Output"));
if (nStudents * nQuestions !== nOut) {
  throw new Error(\`expected \${nStudents}×\${nQuestions}=\${nStudents * nQuestions} grades, got \${nOut}\`);
}`;

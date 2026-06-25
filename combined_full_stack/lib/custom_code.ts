// AI : user-authored transform/custom steps — runs in the browser during inference (no server vm).
// AI : unsandboxed in the user's tab is fine: they already control their browser; this keeps
// AI : arbitrary code off the server and away from OPENROUTER_API_KEY / process.env.
// AI : custom TS / lambda signature becomes `(input, state: PipelineState) => output`
// AI : where `state` is every prior step's output keyed by label (see lib/server/pipeline_state.ts).
// AI : Back-compat: if the compiled fn arity is 1, pass only `input` until migration completes.
// AI : Python uses Pyodide in-browser; signature `def transform(input, state=None):`.

import type { ParsedCustomCodeEntry } from "@/lib/custom_code_entries";
import type { CustomCodeLanguage } from "@/lib/types";
import type { PipelineState } from "@/lib/run-types";
import { wrapAssertCode } from "@/lib/assert_steps";

export type { CustomCodeLanguage, CustomCodeEntry } from "@/lib/types";
export type { ParsedCustomCodeEntry } from "@/lib/custom_code_entries";
export {
  codeOfEntry,
  customCodeEntriesForModule,
  languageOfEntry,
  makeCustomCodeEntry,
  migrateCustomCodeModule,
  normalizeCustomCodeFallbackList,
  parseCustomCodeEntry,
} from "@/lib/custom_code_entries";

export type CustomFn = (input: unknown, state?: PipelineState) => unknown | Promise<unknown>;

const CUSTOM_CODE_TIMEOUT_MS = 15_000;
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

export type CustomCodeAttemptFailure = {
  attemptIndex: number;
  language: CustomCodeLanguage;
  code: string;
  error: string;
  stack?: string;
  input: unknown;
};

export type CustomCodeRunResult = {
  output: unknown;
  attemptIndex: number;
  language: CustomCodeLanguage;
  failures: CustomCodeAttemptFailure[];
};

export class CustomCodeExhaustedError extends Error {
  constructor(readonly failures: CustomCodeAttemptFailure[]) {
    const last = failures[failures.length - 1];
    super(`custom code failed after ${failures.length} attempt(s): ${last?.error ?? "unknown"}`);
    this.name = "CustomCodeExhaustedError";
  }
}

export function numberedCodeBlock(code: string): string {
  return code
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4)} | ${line}`)
    .join("\n");
}

export function formatCustomCodeFailureLog(f: CustomCodeAttemptFailure, tag = "custom-code"): string {
  const inputJson = JSON.stringify(f.input, null, 2);
  return [
    `${tag} attempt ${f.attemptIndex + 1} (${f.language}) failed: ${f.error}`,
    "--- code ---",
    numberedCodeBlock(f.code),
    "--- input (reproduce) ---",
    inputJson,
  ].join("\n");
}

export function compileCustomFn(code: string): CustomFn {
  const trimmed = code.trim();
  const isExpression = /^\s*(\(|function\b|async\b)/.test(trimmed);
  let src: string;
  if (isExpression) {
    src = `(${trimmed})`;
  } else {
    // AI : seed steps prefix helper consts then a trailing `(arg)=>…` — invoke it with input.
    const mainArrow =
      trimmed.match(/;\s*(\([^)]*\)\s*=>[\s\S]+)$/) ?? trimmed.match(/\n\s*(\([^)]*\)\s*=>[\s\S]+)$/);
    if (mainArrow) {
      const arrowStart = trimmed.lastIndexOf(mainArrow[1]!);
      const preamble = trimmed.slice(0, arrowStart).replace(/[;\s]*$/, "");
      const arrow = trimmed.slice(arrowStart);
      src = preamble
        ? `((input) => { ${preamble}; return (${arrow})(input); })`
        : `((input) => { return (${arrow})(input); })`;
    } else {
      src = `((input) => { ${trimmed} })`;
    }
  }
  const fn = new Function(`return ${src}`)();
  if (typeof fn !== "function") throw new Error("custom code must evaluate to a function (input) => output");
  return fn as CustomFn;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function runCustomFn(code: string, input: unknown, state?: PipelineState): Promise<unknown> {
  const fn = compileCustomFn(code);
  const result = fn.length >= 2 ? fn(input, state ?? {}) : fn(input);
  const settled = result instanceof Promise ? await withTimeout(result, CUSTOM_CODE_TIMEOUT_MS, "custom code") : result;
  if (settled === undefined) {
    throw new Error("custom code returned undefined — add a trailing (input) => output arrow or an explicit return");
  }
  return settled;
}

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { set: (k: string, v: unknown) => void };
};

let pyodideReady: Promise<PyodideLike> | undefined;

async function getPyodide(): Promise<PyodideLike> {
  pyodideReady ??= (async () => {
    const { loadPyodide } = await import("pyodide");
    const py = await loadPyodide({ indexURL: PYODIDE_CDN });
    return py as unknown as PyodideLike;
  })();
  return pyodideReady;
}

function pythonSource(code: string): string {
  if (/^\s*def\s+\w+/.test(code)) return code;
  const body = code
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : ""))
    .join("\n");
  return `def transform(input, state=None):\n${body}`;
}

export async function runPythonFn(code: string, input: unknown, state?: PipelineState): Promise<unknown> {
  const pyodide = await getPyodide();
  await pyodide.runPythonAsync(pythonSource(code));
  pyodide.globals.set("_forge_input", input);
  pyodide.globals.set("_forge_state", state ?? {});
  const raw = await withTimeout(
    pyodide.runPythonAsync(`
import json
_r = transform(_forge_input, _forge_state)
json.dumps(_r, default=str)
`),
    CUSTOM_CODE_TIMEOUT_MS,
    "python custom code",
  );
  if (typeof raw !== "string") throw new Error("python custom code did not return JSON");
  return JSON.parse(raw) as unknown;
}

async function runCustomEntry(
  entry: ParsedCustomCodeEntry,
  input: unknown,
  state?: PipelineState,
): Promise<unknown> {
  if (entry.language === "python") return runPythonFn(entry.code, input, state);
  return runCustomFn(entry.code, input, state);
}

export async function runCustomCodeWithFallbacks(
  entries: ParsedCustomCodeEntry[],
  input: unknown,
  state?: PipelineState,
): Promise<CustomCodeRunResult> {
  if (!entries.length) throw new Error("custom code step has no code entries");
  const failures: CustomCodeAttemptFailure[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    try {
      const output = await runCustomEntry(entry, input, state);
      return { output, attemptIndex: i, language: entry.language, failures };
    } catch (err) {
      failures.push({
        attemptIndex: i,
        language: entry.language,
        code: entry.code,
        error: (err as Error).message,
        stack: (err as Error).stack,
        input,
      });
    }
  }
  throw new CustomCodeExhaustedError(failures);
}

export async function runAssertWithFallbacks(
  entries: ParsedCustomCodeEntry[],
  input: unknown,
  state?: PipelineState,
): Promise<CustomCodeRunResult> {
  if (!entries.length) throw new Error("assert step has no code entries");
  const failures: CustomCodeAttemptFailure[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const wrapped = { ...entry, code: wrapAssertCode(entry.code, entry.language) };
    try {
      const result = await runCustomEntry(wrapped, input, state);
      if (result === false) throw new Error("assert returned false");
      return { output: input, attemptIndex: i, language: entry.language, failures };
    } catch (err) {
      failures.push({
        attemptIndex: i,
        language: entry.language,
        code: entry.code,
        error: (err as Error).message,
        stack: (err as Error).stack,
        input,
      });
    }
  }
  throw new CustomCodeExhaustedError(failures);
}

export function isUserCodeStep(kind: string, code?: string): boolean {
  return kind === "custom-code" || kind === "assert" || (kind === "transform" && !!code?.trim());
}

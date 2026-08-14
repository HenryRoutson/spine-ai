// AI : user-authored transform/custom steps — runs in the browser during inference (no server vm).
// AI : unsandboxed in the user's tab is fine: they already control their browser; this keeps
// AI : arbitrary code off the server and away from OPENROUTER_API_KEY / process.env.
// AI : custom TS / lambda signature becomes `(input, state: PipelineState) => output`
// AI : where `state` is every prior step's output keyed by label (see lib/server/pipeline_state.ts).
// AI : Back-compat: if the compiled fn arity is 1, pass only `input` until migration completes.
// AI : Python uses Pyodide in-browser; signature `def transform(input, state=None):`.

import { invariant } from "@/lib/assert";
import { customCodeEntriesForModule, type ParsedCustomCodeEntry } from "@/lib/custom_code_entries";
import { DEFAULT_CUSTOM_CODE_MAX_RUN_MS, type max_run_ms } from "@/lib/custom-code-max-run";
import { ModuleKind, type CustomCodeLanguage, type PipelineModule } from "@/lib/types";
import type { PipelineState } from "@/lib/run-types";
import { assertEntriesForModule, wrapAssertCode } from "@/lib/assert_steps";
import type { CodeLineProfile } from "@/lib/code-exec-ui";
import {
  createForgeTrace,
  formatLineProfileLog,
  instrumentArrowSource,
  instrumentCodeLines,
  makeAsyncFunctionSource,
  type CodeTraceEvent,
  type ForgeTraceFinish,
  type ForgeTraceFn,
  type InstrumentCodeOpts,
} from "@/lib/custom_code_trace";
import { previewCustomCodeInput, truncateClientStepText, MAX_CLIENT_LOG_LINE_CHARS } from "@/lib/client-step-payload";

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

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
// AI : TODO security — Pyodide loads from CDN; pin SRI or self-host to reduce supply-chain risk.

export type CustomCodeAttemptFailure = {
  attemptIndex: number;
  language: CustomCodeLanguage;
  code: string;
  error: string;
  stack?: string;
  input: unknown;
  lineMs?: CodeLineProfile;
  lastLine?: number;
  lastSlot?: number;
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

export class CustomCodeTimeoutError extends Error {
  constructor(
    readonly maxRunMs: max_run_ms,
    readonly code: string,
    readonly finish: ForgeTraceFinish,
    label = "custom code",
  ) {
    const { lineMs, lastLine, lastSlot } = finish;
    const lines = code.split("\n");
    const lastText = lastLine != null ? (lines[lastLine - 1] ?? "").trim() : "";
    const lastLabel =
      lastLine == null
        ? "last line: (unknown — no instrumented line entered)"
        : lastSlot != null
          ? `last executing: L${lastLine}.${lastSlot} λ ${lastText.slice(0, 96)}`
          : `last executing: L${lastLine} ${lastText.slice(0, 96)}`;
    super(
      [
        `${label} timed out after ${maxRunMs}ms`,
        lastLabel,
        formatLineProfileLog(code, lineMs),
      ].join("\n"),
    );
    this.name = "CustomCodeTimeoutError";
  }
}

export function numberedCodeBlock(code: string): string {
  return code
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4)} | ${line}`)
    .join("\n");
}

export function formatCustomCodeFailureLog(f: CustomCodeAttemptFailure, tag = "custom-code"): string {
  const parts = [
    `${tag} attempt ${f.attemptIndex + 1} (${f.language}) failed: ${f.error}`,
    "--- code ---",
    numberedCodeBlock(f.code),
    "--- input (reproduce) ---",
    previewCustomCodeInput(f.input),
  ];
  if (f.stack?.trim()) {
    parts.push("--- stack ---", f.stack.trim());
  }
  return truncateClientStepText(parts.join("\n"), MAX_CLIENT_LOG_LINE_CHARS);
}

// AI : wrap raw user code into a self-invoking `(input, state) => output` source string.
// AI : pure string transform — does NOT evaluate. Both compile (browser) and syntax-check (server) share it.
function trailingArrowParams(arrow: string): string[] {
  const head = arrow.trim().replace(/^async\s+/, "");
  const grouped = head.match(/^\(([^)]*)\)/)?.[1]?.trim();
  if (grouped !== undefined) {
    if (!grouped) return ["input"];
    return grouped.split(",").map((p) => p.trim()).filter(Boolean);
  }
  // AI : astring emits `async doc =>` (no parens) after visual instrument.
  const ident = head.match(/^([A-Za-z_$][\w$]*)\s*=>/);
  return ident ? [ident[1]!] : ["input"];
}

export type CustomCodeParts = {
  preamble: string;
  arrow: string;
};

export function splitCustomCodeParts(code: string): CustomCodeParts | undefined {
  const trimmed = code.trim();
  // AI : allow `(doc) =>` and astring's `async doc =>` (single ident, no parens).
  const mainArrow =
    trimmed.match(/;\s*((?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>[\s\S]+)$/) ??
    trimmed.match(/\n\s*((?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>[\s\S]+)$/);
  if (!mainArrow) return undefined;
  const arrowStart = trimmed.lastIndexOf(mainArrow[1]!);
  const preamble = trimmed.slice(0, arrowStart).replace(/[;\s]*$/, "");
  const arrow = trimmed.slice(arrowStart);
  if (!preamble) return undefined;
  return { preamble, arrow };
}

// AI : visual line profiler — instrument only the trailing arrow, not generated merge/chunk runtime.
export function instrumentCustomCodeLines(code: string, opts: InstrumentCodeOpts = {}): string {
  const parts = splitCustomCodeParts(code);
  if (!parts) return instrumentCodeLines(code, opts);
  const arrowInst = instrumentArrowSource(parts.arrow, opts);
  return `${parts.preamble}\n${arrowInst}`;
}

// AI : merge/chunk codegen is preamble helpers + trailing arrow — line profiler must not instrument helpers.
export function buildCustomFnSource(code: string): string {
  const trimmed = code.trim();
  const parts = splitCustomCodeParts(trimmed);
  if (parts) {
    const { preamble, arrow } = parts;
    const args = trailingArrowParams(arrow);
    const outerParams = args.join(", ");
    const callArgs = args.join(", ");
    return `(${outerParams}) => { ${preamble}; return (${arrow})(${callArgs}); }`;
  }
  const isExpression = /^\s*(\(|function\b|async\b)/.test(trimmed);
  if (isExpression) return `(${trimmed})`;
  return `((input) => { ${trimmed} })`;
}

// AI : SECURITY — only call in the browser during inference. `new Function(...)()` EXECUTES the
// AI : user source (expression-form code runs its comma/IIFE side effects immediately), so this must
// AI : never run on the server. Server-side validation uses assertCustomFnSyntax (parse only).
export function compileCustomFn(code: string): CustomFn {
  const src = buildCustomFnSource(code);
  const fn = new Function(`return ${src}`)();
  invariant(typeof fn === "function", "custom code must evaluate to a function (input) => output");
  return fn as CustomFn;
}

export type CustomCodeTraceOpts = {
  onTrace?: (event: CodeTraceEvent) => void;
  maxRunMs?: max_run_ms;
  // AI : original user source for timeout/line profiles (instrumented body has different lines).
  profileCode?: string;
};

// AI : traced compile — __forgeTrace is injected per source line for inference step preview.
function compileTracedCustomFn(code: string, onTrace: (event: CodeTraceEvent) => void, visual: boolean): CustomFn {
  const paint = visual
    ? () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    : undefined
  const traceFn = createForgeTrace(onTrace, paint)
  const built = buildCustomFnSource(code)
  // AI : visual instrumentation already async-ifies the trailing arrow — don't double-wrap the outer fn.
  const innerAsync = splitCustomCodeParts(code)?.arrow.trimStart().startsWith("async ")
  const src = visual && !innerAsync ? makeAsyncFunctionSource(built) : built
  const fn = new Function("__forgeTrace", `return ${src}`)(traceFn)
  invariant(typeof fn === "function", "custom code must evaluate to a function (input) => output");
  const wrapped = fn as CustomFn & { __forgeTrace?: ReturnType<typeof createForgeTrace> };
  wrapped.__forgeTrace = traceFn;
  return wrapped;
}

// AI : SECURITY — syntax-only validation. Constructing a Function parses the body and throws on
// AI : SyntaxError, but never executes it. Safe to run on the server (no RCE from user pipelines).
// AI : TODO security — expression-form code can still pass syntax while doing harm in the browser at
// AI : inference time; consider AST allowlist if pipelines become multi-tenant hostile.
export function assertCustomFnSyntax(code: string): void {
  const src = buildCustomFnSource(code);
  // eslint-disable-next-line no-new-func -- parse-only; body is never invoked, so user code cannot run.
  new Function(`return ${src}`);
}

// AI : static pipeline validation — TS parsed (never executed); Python skipped (needs Pyodide).
export function tryCompileCustomCodeEntry(
  entry: ParsedCustomCodeEntry,
  opts?: { assert?: boolean; expectedOutputs?: import("@/lib/assert_steps").ExpectedOutputsMap },
): string | undefined {
  const raw = entry.code.trim();
  if (!raw) return "code is empty";
  if (entry.language === "python") return undefined; // AI : TODO (linter-first) — pyright on generated pipeline.py + inlined user fn, not Pyodide syntax-only.
  const code = opts?.assert ? wrapAssertCode(raw, entry.language, opts.expectedOutputs ?? {}) : raw;
  try {
    assertCustomFnSyntax(code);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : "code does not compile";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: max_run_ms, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isTimeoutMessage(msg: string, ms: max_run_ms): boolean {
  return msg.includes(`timed out after ${ms}ms`);
}

export async function runCustomFn(
  code: string,
  input: unknown,
  state?: PipelineState,
  opts?: CustomCodeTraceOpts,
): Promise<unknown> {
  const maxRunMs = opts?.maxRunMs ?? DEFAULT_CUSTOM_CODE_MAX_RUN_MS;
  const profileCode = opts?.profileCode ?? code;
  const fn = opts?.onTrace ? compileTracedCustomFn(code, opts.onTrace, true) : compileCustomFn(code);
  const trace: ForgeTraceFn | undefined =
    "__forgeTrace" in fn ? (fn as CustomFn & { __forgeTrace?: ForgeTraceFn }).__forgeTrace : undefined;
  let finished: ForgeTraceFinish | undefined;
  const finishOnce = (): ForgeTraceFinish => {
    if (finished) return finished;
    finished = trace?.finish() ?? { lineMs: {} };
    return finished;
  };
  try {
    const result = fn.length >= 2 ? fn(input, state ?? {}) : fn(input);
    const settled = await withTimeout(Promise.resolve(result), maxRunMs, "custom code");
    if (settled === undefined) {
      throw new Error("custom code returned undefined — add a trailing (input) => output arrow or an explicit return");
    }
    return settled;
  } catch (err) {
    if (err instanceof CustomCodeTimeoutError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (isTimeoutMessage(msg, maxRunMs)) {
      throw new CustomCodeTimeoutError(maxRunMs, profileCode, finishOnce());
    }
    throw err;
  } finally {
    finishOnce();
  }
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

export async function runPythonFn(
  code: string,
  input: unknown,
  state?: PipelineState,
  opts?: CustomCodeTraceOpts,
): Promise<unknown> {
  const maxRunMs = opts?.maxRunMs ?? DEFAULT_CUSTOM_CODE_MAX_RUN_MS;
  const pyodide = await getPyodide();
  await pyodide.runPythonAsync(pythonSource(code));
  pyodide.globals.set("_forge_input", input);
  pyodide.globals.set("_forge_state", state ?? {});
  try {
    const raw = await withTimeout(
      pyodide.runPythonAsync(`
import json
_r = transform(_forge_input, _forge_state)
json.dumps(_r, default=str)
`),
      maxRunMs,
      "python custom code",
    );
    if (typeof raw !== "string") throw new Error("python custom code did not return JSON");
    const parsed = JSON.parse(raw) as unknown;
    invariant(parsed !== undefined, "python custom code returned undefined");
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isTimeoutMessage(msg, maxRunMs)) {
      throw new CustomCodeTimeoutError(maxRunMs, code, { lineMs: {} }, "python custom code");
    }
    throw err;
  }
}

async function runCustomEntry(
  entry: ParsedCustomCodeEntry,
  input: unknown,
  state?: PipelineState,
  opts?: CustomCodeTraceOpts,
): Promise<unknown> {
  const entryOpts: CustomCodeTraceOpts = { ...opts, profileCode: entry.code };
  if (entry.language === "python") return runPythonFn(entry.code, input, state, entryOpts);
  const code = opts?.onTrace ? instrumentCustomCodeLines(entry.code, { visual: true }) : entry.code;
  return runCustomFn(code, input, state, entryOpts);
}

function failureFromErr(
  i: number,
  entry: ParsedCustomCodeEntry,
  input: unknown,
  err: unknown,
): CustomCodeAttemptFailure {
  const timeout = err instanceof CustomCodeTimeoutError ? err : undefined;
  return {
    attemptIndex: i,
    language: entry.language,
    code: entry.code,
    error: (err as Error).message,
    stack: (err as Error).stack,
    input,
    lineMs: timeout?.finish.lineMs,
    lastLine: timeout?.finish.lastLine,
    lastSlot: timeout?.finish.lastSlot,
  };
}

export async function runCustomCodeWithFallbacks(
  entries: ParsedCustomCodeEntry[],
  input: unknown,
  state?: PipelineState,
  opts?: CustomCodeTraceOpts,
): Promise<CustomCodeRunResult> {
  if (!entries.length) throw new Error("custom code step has no code entries");
  const failures: CustomCodeAttemptFailure[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    try {
      const output = await runCustomEntry(entry, input, state, opts);
      return { output, attemptIndex: i, language: entry.language, failures };
    } catch (err) {
      failures.push(failureFromErr(i, entry, input, err));
    }
  }
  throw new CustomCodeExhaustedError(failures);
}

export async function runAssertWithFallbacks(
  entries: ParsedCustomCodeEntry[],
  input: unknown,
  state?: PipelineState,
  expectedOutputs?: import("@/lib/assert_steps").ExpectedOutputsMap,
  opts?: CustomCodeTraceOpts,
): Promise<CustomCodeRunResult> {
  if (!entries.length) throw new Error("assert step has no code entries");
  const failures: CustomCodeAttemptFailure[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const userCode =
      opts?.onTrace && entry.language !== "python"
        ? instrumentCustomCodeLines(entry.code, { visual: true })
        : entry.code;
    const wrapped = { ...entry, code: wrapAssertCode(userCode, entry.language, expectedOutputs ?? {}) };
    const entryOpts: CustomCodeTraceOpts = { ...opts, profileCode: entry.code };
    try {
      const result =
        entry.language === "python"
          ? await runPythonFn(wrapped.code, input, state, entryOpts)
          : await runCustomFn(wrapped.code, input, state, entryOpts);
      if (result === false) throw new Error("assert returned false");
      invariant(result === true || result === input, "assert must return true or pass input through unchanged");
      return { output: input, attemptIndex: i, language: entry.language, failures };
    } catch (err) {
      failures.push(failureFromErr(i, entry, input, err));
    }
  }
  throw new CustomCodeExhaustedError(failures);
}

export function isUserCodeStep(kind: string, code?: string): boolean {
  return (
    kind === ModuleKind.CustomCode ||
    kind === ModuleKind.Assert ||
    (kind === ModuleKind.Transform && !!code?.trim())
  );
}

export function firstUserCodeEntry(module: PipelineModule): ParsedCustomCodeEntry | undefined {
  if (!isUserCodeStep(module.kind, module.code)) return undefined;
  const entries =
    module.kind === ModuleKind.Assert ? assertEntriesForModule(module) : customCodeEntriesForModule(module);
  return entries[0];
}

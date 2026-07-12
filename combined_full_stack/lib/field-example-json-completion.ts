import { tryParseJson } from "@/lib/json-utils";

export type PartialJsonAnalysis =
  | { status: "empty" }
  | { status: "complete"; value: unknown }
  | { status: "prefix"; value: unknown }
  | { status: "invalid"; error: string; errorIndex: number };

type JsonScanEnd =
  | { ok: true; inString: boolean; needsValue: boolean; stack: ("{" | "[")[]; endsWithComma: boolean }
  | { ok: false; error: string; index: number };

const DUMMY_KEY = "__";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stripDummyKeys(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === DUMMY_KEY) continue;
    next[key] = stripDummyKeys(val);
  }
  return next;
}

function stackClosers(stack: ("{" | "[")[]): string[] {
  if (stack.length === 0) return [""];
  const closers = [...stack].reverse().map((ch) => (ch === "{" ? "}" : "]")).join("");
  return [closers];
}

function lastNonWsToken(text: string): string {
  const m = text.trimEnd().match(/(?:[,\[\{:]\s*|^\s*)(-?\d*\.?\d*|[a-zA-Z][a-zA-Z0-9._-]*|"[^"]*)$/);
  return m?.[1]?.replace(/^"/, "") ?? "";
}

function scanJsonEndState(text: string): JsonScanEnd {
  let inString = false;
  let escape = false;
  const stack: ("{" | "[")[] = [];
  let needsValue = true;
  let endsWithComma = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    endsWithComma = false;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        needsValue = false;
        continue;
      }
      continue;
    }
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") continue;
    if (ch === '"') {
      inString = true;
      needsValue = false;
      continue;
    }
    if (ch === "{") {
      stack.push("{");
      needsValue = true;
      continue;
    }
    if (ch === "[") {
      stack.push("[");
      needsValue = true;
      continue;
    }
    if (ch === "}") {
      if (needsValue) return { ok: false, error: "expected value before }", index: i };
      if (stack.pop() !== "{") return { ok: false, error: "unexpected }", index: i };
      needsValue = false;
      continue;
    }
    if (ch === "]") {
      if (needsValue) return { ok: false, error: "expected value before ]", index: i };
      if (stack.pop() !== "[") return { ok: false, error: "unexpected ]", index: i };
      needsValue = false;
      continue;
    }
    if (ch === ":") {
      if (needsValue) return { ok: false, error: "unexpected :", index: i };
      needsValue = true;
      continue;
    }
    if (ch === ",") {
      if (needsValue) return { ok: false, error: "unexpected comma", index: i };
      needsValue = true;
      endsWithComma = true;
      continue;
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let j = i + 1;
      while (j < text.length && /[\d.eE+-]/.test(text[j]!)) j++;
      i = j - 1;
      needsValue = false;
      continue;
    }
    if ("tfn".includes(ch)) {
      const rest = text.slice(i);
      const keyword = rest.match(/^(true|false|null)/);
      if (keyword) {
        i += keyword[0]!.length - 1;
        needsValue = false;
        continue;
      }
      const partial = rest.match(/^([a-z]+)/i);
      if (partial && ["true", "false", "null"].some((kw) => kw.startsWith(partial[1]!))) {
        i += partial[1]!.length - 1;
        needsValue = false;
        continue;
      }
      return { ok: false, error: `unexpected character ${JSON.stringify(ch)}`, index: i };
    }
    return { ok: false, error: `unexpected character ${JSON.stringify(ch)}`, index: i };
  }

  return { ok: true, inString, needsValue, stack, endsWithComma };
}

function generateCompletionSuffixes(text: string): string[] {
  const state = scanJsonEndState(text);
  if (!state.ok) return [];

  const out = new Set<string>();
  const stringClose = state.inString ? ['"'] : [""];
  const valueFills = state.needsValue
    ? ["null", "0", '""', "true", "false", "[]", "{}", `"${DUMMY_KEY}":null`, `"${DUMMY_KEY}":0`]
    : [""];

  for (const closeStr of stringClose) {
    for (const fill of valueFills) {
      for (const closer of stackClosers(state.stack)) {
        out.add(closeStr + fill + closer);
      }
    }
  }

  const tail = lastNonWsToken(text);
  const keywordFinish =
    tail === "tru"
      ? "e"
      : tail === "fals"
        ? "e"
        : tail === "fal"
          ? "se"
          : tail === "fa"
            ? "lse"
            : tail === "nul"
              ? "l"
              : tail === "nu"
                ? "ll"
                : null;
  if (keywordFinish) {
    for (const closer of stackClosers(state.stack)) {
      out.add(keywordFinish + closer);
    }
  }

  return [...out];
}

function findUnrecoverableJsonIndex(text: string): number {
  for (let end = 1; end <= text.length; end++) {
    const chunk = text.slice(0, end);
    const state = scanJsonEndState(chunk);
    if (!state.ok) return state.index;
    if (!chunk.trim()) continue;
    if (tryParseJson(chunk.trim()).ok) continue;
    if (generateCompletionSuffixes(chunk).some((suffix) => tryParseJson(chunk + suffix).ok)) continue;
    return end - 1;
  }
  return Math.max(0, text.length - 1);
}

export function jsonErrorLocation(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const column = index - before.lastIndexOf("\n");
  return { line, column };
}

export function formatJsonErrorAt(text: string, index: number, message: string): string {
  const { line, column } = jsonErrorLocation(text, index);
  const ch = text[index] ?? "";
  const chLabel = ch === "\n" ? "newline" : ch === "\t" ? "tab" : JSON.stringify(ch);
  return `${message} at line ${line}, column ${column} — character ${chLabel}`;
}

export function analyzePartialJson(text: string): PartialJsonAnalysis {
  const trimmed = text.trim();
  if (!trimmed) return { status: "empty" };

  const endState = scanJsonEndState(text);
  if (!endState.ok) {
    return { status: "invalid", error: endState.error, errorIndex: endState.index };
  }

  const complete = tryParseJson(trimmed);
  if (complete.ok) return { status: "complete", value: complete.value };

  for (const suffix of generateCompletionSuffixes(text)) {
    const parsed = tryParseJson(text + suffix);
    if (parsed.ok) return { status: "prefix", value: stripDummyKeys(parsed.value) };
  }

  const errorIndex = findUnrecoverableJsonIndex(text);
  return { status: "invalid", error: "invalid JSON", errorIndex };
}

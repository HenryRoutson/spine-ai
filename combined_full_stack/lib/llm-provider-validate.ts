// AI : browser-side validation for custom LLM provider TypeScript — parse-only, never executes user fetch logic.
export type LlmProviderValidation = { ok: true; providerId: string } | { ok: false; error: string };

export const CUSTOM_PROVIDER_RUNTIME_LANGUAGE = "typescript" as const;

function skipBalanced(source: string, openIdx: number, open: string, close: string): number {
  if (source[openIdx] !== open) return openIdx;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return source.length - 1;
}

function stripTypeOrInterfaceBlocks(code: string, keyword: "type" | "interface"): string {
  let out = code;
  const lead = new RegExp(`^(?:export\\s+)?${keyword}\\s+\\w+[\\s\\S]*?`, "gm");
  let match: RegExpExecArray | null;
  while ((match = lead.exec(out)) !== null) {
    const start = match.index;
    let i = match.index + match[0].length;
    if (keyword === "type") {
      while (i < out.length && /\s/.test(out[i]!)) i++;
      if (out[i] === "=") {
        i++;
        while (i < out.length && /\s/.test(out[i]!)) i++;
      }
    }
    if (out[i] === "{") i = skipBalanced(out, i, "{", "}") + 1;
    else while (i < out.length && out[i] !== ";") i++;
    if (out[i] === ";") i++;
    out = out.slice(0, start) + out.slice(i);
    lead.lastIndex = start;
  }
  return out;
}

function stripAsCasts(code: string): string {
  let out = code;
  let idx = 0;
  while ((idx = out.indexOf(" as ", idx)) !== -1) {
    let i = idx + 4;
    while (i < out.length && /\s/.test(out[i]!)) i++;
    if (out[i] === "{") {
      const end = skipBalanced(out, i, "{", "}") + 1;
      out = out.slice(0, idx) + out.slice(end);
      continue;
    }
    const idMatch = out.slice(i).match(/^[\w.$[\]|&<>,?\s]+/);
    if (idMatch) {
      out = out.slice(0, idx) + out.slice(i + idMatch[0].length);
      continue;
    }
    idx += 4;
  }
  return out;
}

function stripFunctionSignatureTypes(code: string): string {
  return code.replace(
    /((?:async\s+)?function\s+\w+\s*\([\s\S]*?\))(?:\s*:\s*[\w.$[\]|&<>,?\s]+)?(?=\s*\{)/g,
    (_, params: string) => params.replace(/(\w+)\s*:\s*[^,)]+/g, "$1"),
  );
}

// AI : TS provider modules use type aliases + annotations — strip before JS parse check.
export function stripTypeScriptForParseCheck(code: string): string {
  let out = code;
  out = stripTypeOrInterfaceBlocks(out, "type");
  out = stripTypeOrInterfaceBlocks(out, "interface");
  out = out.replace(/^export\s+(?=(const|async function|function|class)\b)/gm, "");
  out = out.replace(/\breadonly\s+/g, "");
  out = stripAsCasts(out);
  out = stripFunctionSignatureTypes(out);
  out = out.replace(/(\w+)\s*:\s*[A-Za-z_$][\w.$[\]|&,\s]*(?=\s*=)/g, "$1");
  out = out.replace(/\)\s*:\s*Promise<[^>]+>\s*(?=\{)/g, ") ");
  out = out.replace(/\)\s*:\s*[A-Za-z_$][\w.$[\]|&]*\s*(?=\{)/g, ") ");
  return out;
}

function extractProviderId(code: string): string | null {
  const idRe = /\bid\s*:\s*["'`]([a-z][a-z0-9_-]*)["'`]/i;
  return code.match(idRe)?.[1] ?? null;
}

function hasChatMethod(code: string): boolean {
  return (
    /\bchat\s*\(\s*[^)]*\)\s*(:\s*Promise<[^>]+>)?\s*\{/.test(code) ||
    /\basync\s+chat\s*\(/.test(code) ||
    /\bchat\s*:\s*(?:async\s+)?(?:function\b|[\w(])/.test(code)
  );
}

export function validateCustomLlmProviderCode(code: string): LlmProviderValidation {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Provider code is empty" };
  if (!trimmed.includes("export") && !/\b(const|async function|function)\s+\w+/.test(trimmed)) {
    return { ok: false, error: "Runtime provider must be TypeScript — export a provider object with chat()" };
  }
  if (!hasChatMethod(trimmed)) {
    return { ok: false, error: "Missing chat(prompt, providerModel, jsonMode) — required LlmProvider method" };
  }
  if (!/\bcapabilities\s*:/.test(trimmed)) {
    return { ok: false, error: "Missing capabilities: { batch, streaming, vision }" };
  }
  const providerId = extractProviderId(trimmed);
  if (!providerId) return { ok: false, error: 'Missing provider id — set id: "your_provider_id"' };
  if (!/^[a-z][a-z0-9_-]*$/.test(providerId)) {
    return { ok: false, error: "Provider id must be lowercase alphanumeric with _ or -" };
  }
  try {
    // eslint-disable-next-line no-new-func -- parse-only syntax check on TS-stripped source
    new Function(stripTypeScriptForParseCheck(trimmed));
  } catch (e) {
    return { ok: false, error: `Syntax error: ${(e as Error).message}` };
  }
  return { ok: true, providerId };
}

// AI : wrap Spine n8n pieces + custom-code as Windmill `main` scripts (inline body, not new Function).
import { buildCustomFnSource } from "@/lib/custom_code"
import { CustomCodeLanguage } from "@/lib/types"

export function bunMainForN8n(code: string, params: Record<string, unknown>): string {
  const body = code.trim() || "return items;"
  return `export async function main(input: unknown) {
  function toItems(raw: unknown) {
    if (raw == null) return [{ json: {} }];
    if (Array.isArray(raw)) {
      return raw.map((row) => ({
        json: row && typeof row === "object" && !Array.isArray(row) ? row : { value: row },
      }));
    }
    if (typeof raw === "object") return [{ json: raw }];
    return [{ json: { value: raw } }];
  }
  const fromSpine = toItems(input);
  const $parameter = ${JSON.stringify(params)};
  const params = $parameter;
  const $input = { all: () => fromSpine, first: () => fromSpine[0], item: fromSpine[0] };
  const $json = fromSpine[0]?.json ?? {};
  const items = fromSpine;
  const result = await (async () => {
${body
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n")}
  })();
  const list = Array.isArray(result) ? result : fromSpine;
  const jsons = list.map((row: unknown) => {
    if (row && typeof row === "object" && "json" in row && (row as { json?: unknown }).json && typeof (row as { json: unknown }).json === "object") {
      return (row as { json: Record<string, unknown> }).json;
    }
    if (row && typeof row === "object" && !Array.isArray(row)) return row;
    return { value: row };
  });
  return Array.isArray(input) ? jsons : (jsons[0] ?? {});
}
`
}

export function bunMainForCustomTs(code: string): string {
  const src = buildCustomFnSource(code)
  return `export async function main(input: unknown, state?: Record<string, unknown>) {
  const fn = ${src};
  return await Promise.resolve(fn(input, state));
}
`
}

export function pythonMainForCustom(code: string): string {
  const trimmed = code.trim()
  const transform = /^\s*def\s+\w+/.test(trimmed)
    ? trimmed
    : `def transform(input, state=None):\n${trimmed
        .split("\n")
        .map((line) => (line.trim() ? `    ${line}` : ""))
        .join("\n")}`
  return `${transform}

def main(input, state=None):
    return transform(input, state)
`
}

export function windmillLanguageForCustom(language: CustomCodeLanguage): "bun" | "python3" {
  return language === CustomCodeLanguage.Python ? "python3" : "bun"
}

export function windmillContentForCustom(language: CustomCodeLanguage, code: string): string {
  return language === CustomCodeLanguage.Python ? pythonMainForCustom(code) : bunMainForCustomTs(code)
}
